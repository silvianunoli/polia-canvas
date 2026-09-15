-- Exclusão de conta (LGPD art. 18) — para de depender de lista escrita à mão.
--
-- POR QUE ESTA MIGRAÇÃO EXISTE
-- excluir_dados_do_usuario() era uma LISTA FIXA de tabelas, escrita em
-- 09/07/2026 e reescrita em 25/07 e 03/09 toda vez que uma faxina derrubava
-- alguma tabela da lista. Entre uma faxina e outra, toda tabela nova com
-- user_id entrou no banco sem entrar na lista: ia_uso, ia_geracoes, ia_raiox,
-- ia_plano_conteudo (27/07) e as office_* nunca foram apagadas na exclusão de
-- conta. Lista fixa + schema que anda = exclusão que quebra ou deixa rastro,
-- sempre em silêncio.
--
-- Agora a função descobre sozinha o que apagar:
--   1) filhas sem user_id próprio (quadro_colunas, ticket_messages);
--   2) TODA tabela base de public com coluna user_id do tipo uuid;
--   3) toda FK que aponta pra profiles(id) e que travaria o DELETE do perfil;
--   4) o perfil, por último.
--
-- BUG ESPECÍFICO QUE ISSO CORRIGE
-- admin_audit_log.admin_id é NOT NULL e a FK dele é ON DELETE SET NULL
-- (migração 20260709151500, tabela retroativa da era Lovable). As duas coisas
-- juntas são impossíveis: apagar o perfil de quem tem linha no log de
-- auditoria faz o Postgres tentar gravar NULL numa coluna NOT NULL e estourar
-- 23502 (null value in column "admin_id"). Como só admin escreve nesse log, a
-- conta que não conseguia ser apagada era justamente a de quem administra.
-- A intenção declarada na FK é preservar o log e esquecer quem fez a ação,
-- então quem cede é o NOT NULL.

alter table public.admin_audit_log
  alter column admin_id drop not null;

comment on column public.admin_audit_log.admin_id is
  'Admin que fez a ação. Nulo quando a conta do admin foi excluída: a FK é ON DELETE SET NULL de propósito, o log da ação fica, a autoria some.';

CREATE OR REPLACE FUNCTION public.excluir_dados_do_usuario()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  pendentes text[];
  restantes text[];
  tabela text;
  vinculo record;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sem usuário autenticado';
  END IF;

  -- 1) Filhas que não têm user_id próprio (cascateiam, mas explícito por garantia).
  DELETE FROM public.quadro_colunas
   WHERE quadro_id IN (SELECT id FROM public.quadros WHERE user_id = uid);
  DELETE FROM public.ticket_messages
   WHERE ticket_id IN (SELECT id FROM public.tickets WHERE user_id = uid);

  -- 2) Toda tabela base de public com coluna user_id uuid. A varredura é o
  --    ponto da migração: tabela nova entra sozinha, tabela dropada sai
  --    sozinha, ninguém precisa lembrar de editar esta função de novo.
  SELECT coalesce(array_agg(c.relname::text ORDER BY c.relname), '{}'::text[])
    INTO pendentes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND a.attname = 'user_id'
     AND a.attnum > 0
     AND NOT a.attisdropped
     AND a.atttypid = 'uuid'::regtype;

  -- A ordem certa entre elas não é conhecida de antemão (clientes aponta pra
  -- produtos, tarefas aponta pra metas e pra quadros). Em vez de fixar uma
  -- ordem que envelhece, roda em passadas: o que bater em FK volta pra fila e
  -- tenta de novo depois que a filha já saiu. Cinco passadas cobrem com folga
  -- a profundidade real do schema.
  FOR passo IN 1..5 LOOP
    EXIT WHEN coalesce(array_length(pendentes, 1), 0) = 0;
    restantes := '{}'::text[];
    FOREACH tabela IN ARRAY pendentes LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', tabela) USING uid;
      EXCEPTION
        WHEN foreign_key_violation THEN
          -- Só FK volta pra fila. Qualquer outro erro sobe inteiro, com o
          -- SQLSTATE original, pra aparecer no log de quem chamou.
          restantes := restantes || tabela;
      END;
    END LOOP;
    pendentes := restantes;
  END LOOP;

  IF coalesce(array_length(pendentes, 1), 0) > 0 THEN
    RAISE EXCEPTION 'Exclusão travada por chave estrangeira nestas tabelas: %',
      array_to_string(pendentes, ', ');
  END IF;

  -- 3) FKs que apontam pro perfil e que impediriam (ou estourariam) o DELETE
  --    final. Resolve na mão antes, em vez de deixar o Postgres recusar.
  FOR vinculo IN
    SELECT con.conrelid::regclass::text AS tabela,
           att.attname::text            AS coluna,
           con.confdeltype              AS acao,
           att.attnotnull               AS obrigatoria
      FROM pg_constraint con
      -- conkey é int2vector (subscrito começa em 0, não em 1): nada de
      -- conkey[1] aqui, senão o match some sem avisar. Com a FK restrita a uma
      -- coluna só, ANY() acha exatamente a coluna certa. O cast pra int2[] é
      -- explícito só pra não depender da coerção implícita de int2vector.
      JOIN pg_attribute att
        ON att.attrelid = con.conrelid
       AND att.attnum = ANY (con.conkey::int2[])
     WHERE con.contype = 'f'
       AND con.confrelid = 'public.profiles'::regclass
       AND array_length(con.conkey::int2[], 1) = 1
  LOOP
    -- 'a' (NO ACTION) e 'r' (RESTRICT) não fazem nada sozinhos: o DELETE do
    -- perfil falharia. 'n' (SET NULL) numa coluna NOT NULL é a armadilha do
    -- admin_audit_log descrita no topo. 'c' (CASCADE) e 'd' (SET DEFAULT)
    -- resolvem sozinhos e ficam de fora.
    IF vinculo.acao IN ('a', 'r') OR (vinculo.acao = 'n' AND vinculo.obrigatoria) THEN
      IF vinculo.obrigatoria THEN
        -- Coluna obrigatória não aceita esquecer a autoria: a linha inteira sai.
        EXECUTE format('DELETE FROM %s WHERE %I = $1', vinculo.tabela, vinculo.coluna)
          USING uid;
      ELSE
        -- Coluna opcional: o registro fica, a ligação com a pessoa some.
        EXECUTE format('UPDATE %s SET %I = NULL WHERE %I = $1',
                       vinculo.tabela, vinculo.coluna, vinculo.coluna)
          USING uid;
      END IF;
    END IF;
  END LOOP;

  -- 4) Perfil por último.
  DELETE FROM public.profiles WHERE id = uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.excluir_dados_do_usuario() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_dados_do_usuario() TO authenticated;
