-- public.v_user: tabela orfa com RLS desligada (rls_disabled_in_public),
-- exposta a leitura/escrita por anon. Só coluna id (uuid), 1 linha, sem FK
-- dependente, sem referência em nenhuma migração nem em src/supabase (fora
-- de types.ts, que é gerado). Sem uso confirmado — remove.
drop table if exists public.v_user;
