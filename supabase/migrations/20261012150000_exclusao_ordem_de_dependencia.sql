-- 12/10/2026: exclusão de conta Grátis travava no gatilho de cota do quadro.
--
-- excluir_dados_da_usuaria apagava as tabelas em ordem alfabética: metas antes
-- de tarefas. O ON DELETE SET NULL de tarefas.meta_id vira UPDATE nas tarefas,
-- e o gatilho quadro_excedente_tarefas (BEFORE INSERT OR UPDATE) recusa UPDATE
-- em quadro acima da cota do plano Grátis: "Este quadro passou do limite do
-- plano Grátis". A exclusão inteira voltava atrás. Pegava a exclusão pelo
-- office e a da própria usuária em /configuracoes (mesma função).
--
-- Correção: apagar em ordem de dependência, filha antes da mãe, pra nenhuma
-- linha da usuária ser atualizada no caminho. O resto da função é igual à
-- migração 20261012120000.

CREATE OR REPLACE FUNCTION public.excluir_dados_da_usuaria(alvo uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := alvo;
  pendentes text[];
  restantes text[];
  tabela text;
  vinculo record;
  apagou boolean;
  forcar boolean := false;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sem usuária pra excluir';
  END IF;

  -- 1) Filhas que não têm user_id próprio (cascateiam, mas explícito por garantia).
  DELETE FROM public.quadro_colunas
   WHERE quadro_id IN (SELECT id FROM public.quadros WHERE user_id = uid);
  DELETE FROM public.ticket_messages
   WHERE ticket_id IN (SELECT id FROM public.tickets WHERE user_id = uid);

  -- 2) Toda tabela base de public com coluna user_id uuid (ver 20260915150000).
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

  -- Passadas em ordem de dependência: a tabela que outra pendente ainda
  -- referencia espera a filha sair primeiro (tarefas antes de metas). Apagar a
  -- mãe antes faz o ON DELETE SET NULL virar UPDATE na filha, e esse UPDATE
  -- passa pelos gatilhos de cota do plano Grátis (assert_quadro_dentro_da_cota),
  -- que barravam a exclusão inteira de conta Grátis com quadro acima do limite
  -- (12/10/2026). Se uma passada não apaga nada (ciclo de FK), a seguinte força
  -- a ordem e o que bater em FK volta pra fila, como antes.
  FOR passo IN 1..30 LOOP
    EXIT WHEN coalesce(array_length(pendentes, 1), 0) = 0;
    restantes := '{}'::text[];
    apagou := false;
    FOREACH tabela IN ARRAY pendentes LOOP
      IF NOT forcar AND EXISTS (
        SELECT 1
          FROM pg_constraint con
          JOIN pg_class filha ON filha.oid = con.conrelid
          JOIN pg_namespace fn ON fn.oid = filha.relnamespace
         WHERE con.contype = 'f'
           AND con.confrelid = format('public.%I', tabela)::regclass
           AND fn.nspname = 'public'
           AND filha.relname <> tabela
           AND filha.relname = ANY (pendentes)
      ) THEN
        restantes := restantes || tabela;
        CONTINUE;
      END IF;
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', tabela) USING uid;
        apagou := true;
      EXCEPTION
        WHEN foreign_key_violation THEN
          restantes := restantes || tabela;
      END;
    END LOOP;
    EXIT WHEN forcar AND NOT apagou;
    forcar := NOT apagou;
    pendentes := restantes;
  END LOOP;

  IF coalesce(array_length(pendentes, 1), 0) > 0 THEN
    RAISE EXCEPTION 'Exclusão travada por chave estrangeira nestas tabelas: %',
      array_to_string(pendentes, ', ');
  END IF;

  -- 3) FKs que apontam pro perfil e impediriam o DELETE final (ex.:
  --    blog_posts.autor_id, sem ON DELETE). Coluna obrigatória: a linha sai.
  --    Coluna opcional: o registro fica e a ligação com a pessoa some.
  FOR vinculo IN
    SELECT con.conrelid::regclass::text AS tabela,
           att.attname::text            AS coluna,
           con.confdeltype              AS acao,
           att.attnotnull               AS obrigatoria
      FROM pg_constraint con
      JOIN pg_attribute att
        ON att.attrelid = con.conrelid
       AND att.attnum = ANY (con.conkey::int2[])
     WHERE con.contype = 'f'
       AND con.confrelid = 'public.profiles'::regclass
       AND array_length(con.conkey::int2[], 1) = 1
  LOOP
    IF vinculo.acao IN ('a', 'r') OR (vinculo.acao = 'n' AND vinculo.obrigatoria) THEN
      IF vinculo.obrigatoria THEN
        EXECUTE format('DELETE FROM %s WHERE %I = $1', vinculo.tabela, vinculo.coluna)
          USING uid;
      ELSE
        EXECUTE format('UPDATE %s SET %I = NULL WHERE %I = $1',
                       vinculo.tabela, vinculo.coluna, vinculo.coluna)
          USING uid;
      END IF;
    END IF;
  END LOOP;

  -- 4) Perfil por último.
  DELETE FROM public.profiles WHERE id = uid;
END;
$function$;
