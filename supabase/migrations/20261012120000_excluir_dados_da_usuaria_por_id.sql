-- 12/10/2026: o office passa a excluir o cadastro de uma usuária.
--
-- excluir_dados_do_usuario() só sabe apagar quem está logada (auth.uid()), então
-- o polia-admin não tinha como reaproveitar a varredura à prova de drift da
-- migração 20260915150000. O corpo vira excluir_dados_da_usuaria(alvo), que
-- recebe o id, e a função antiga passa a ser só uma casca que chama a nova com
-- auth.uid(). Mesma lógica nos dois caminhos: tabela nova continua entrando
-- sozinha na exclusão, venha ela da própria usuária ou do office.
--
-- Trava: excluir_dados_da_usuaria(uuid) não pode ser chamada por anon nem por
-- authenticated, senão qualquer pessoa logada apagaria a conta de outra via
-- PostgREST. Só service_role executa, e no polia-admin a server function checa
-- is_admin antes. A casca antiga é SECURITY DEFINER (dona postgres), então
-- continua conseguindo chamar a nova mesmo sem o grant pra authenticated.

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

  -- Passadas: o que bater em FK volta pra fila e tenta depois que a filha saiu.
  FOR passo IN 1..5 LOOP
    EXIT WHEN coalesce(array_length(pendentes, 1), 0) = 0;
    restantes := '{}'::text[];
    FOREACH tabela IN ARRAY pendentes LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', tabela) USING uid;
      EXCEPTION
        WHEN foreign_key_violation THEN
          restantes := restantes || tabela;
      END;
    END LOOP;
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

REVOKE ALL ON FUNCTION public.excluir_dados_da_usuaria(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_dados_da_usuaria(uuid) TO service_role;

-- A casca de sempre: a própria usuária, em /configuracoes do polia-app.
CREATE OR REPLACE FUNCTION public.excluir_dados_do_usuario()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sem usuário autenticado';
  END IF;
  PERFORM public.excluir_dados_da_usuaria(auth.uid());
END;
$function$;
