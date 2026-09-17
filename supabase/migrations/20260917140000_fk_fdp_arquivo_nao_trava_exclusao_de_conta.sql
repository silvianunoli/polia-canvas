-- Exclusão de conta: a FK de fdp_arquivo parava o DELETE em auth.users.
--
-- O MESMO BUG DE 15/09, NUM LUGAR QUE NINGUÉM OLHOU
-- A migração 20260915150000 consertou admin_audit_log.admin_id com o raciocínio
-- "NOT NULL/RESTRICT é impossível junto de exclusão de conta", e a função
-- excluir_dados_do_usuario() passou a varrer sozinha as FKs que apontam pra
-- public.profiles. Duas coisas ficaram de fora daquela varredura:
--   1) FK que aponta pra auth.users, não pra profiles — a função apaga o perfil,
--      quem apaga o login é o auth.admin.deleteUser() do servidor, depois;
--   2) schema que não é public.
-- fdp_arquivo.social_posts.aprovado_por é exatamente as duas coisas ao mesmo
-- tempo, e por isso passou batido numa investigação anterior que só olhou public.
--
--   constraint social_posts_aprovado_por_fkey
--   FOREIGN KEY (aprovado_por) REFERENCES auth.users(id)
--   -- sem ON DELETE: NO ACTION, ou seja, recusa o DELETE
--
-- Resultado: a usuária clicava em excluir conta, os dados dela iam embora, o
-- DELETE do login batia na FK e voltava "Database error deleting user". Sobrava
-- a casca de login órfã (auth.users sem linha em profiles).
--
-- fdp_arquivo NÃO é schema da Pólia: é o arquivo morto da Fábrica de Posts,
-- outro projeto, hospedado no mesmo banco. Nenhum arquivo de polia-app
-- referencia esse schema. Por isso todo bloco aqui é guardado por to_regclass:
-- num banco limpo (supabase db reset, CI) o schema não existe e a migração
-- precisa passar batida em vez de estourar.
--
-- A intenção é a mesma do admin_audit_log: o registro sobrevive, a autoria some.
-- Post arquivado de um produto morto não vale segurar o direito de exclusão de
-- ninguém (LGPD art. 18).

-- 1) A FK conhecida, nomeada, para não depender da varredura genérica abaixo.
do $$
begin
  if to_regclass('fdp_arquivo.social_posts') is null then
    raise notice 'fdp_arquivo.social_posts nao existe neste banco: nada a fazer.';
    return;
  end if;

  -- ON DELETE SET NULL numa coluna NOT NULL é a armadilha do admin_audit_log:
  -- não falha agora, falha na hora da exclusão, com 23502. Quem cede é o NOT NULL.
  alter table fdp_arquivo.social_posts
    alter column aprovado_por drop not null;

  -- Postgres não deixa trocar o ON DELETE de uma FK existente com
  -- ALTER CONSTRAINT (só DEFERRABLE/INITIALLY se ajustam assim). Drop + recreate.
  alter table fdp_arquivo.social_posts
    drop constraint if exists social_posts_aprovado_por_fkey;

  alter table fdp_arquivo.social_posts
    add constraint social_posts_aprovado_por_fkey
    foreign key (aprovado_por) references auth.users(id) on delete set null;

  raise notice 'social_posts_aprovado_por_fkey recriada com ON DELETE SET NULL.';
end
$$;

comment on column fdp_arquivo.social_posts.aprovado_por is
  'Quem aprovou o post. Nulo quando a conta foi excluída: a FK é ON DELETE SET NULL de proposito, o post arquivado fica, a autoria some. Ver migracao 20260917140000.';

-- 2) Varredura do resto do schema, mesma lógica: nenhuma outra FK de fdp_arquivo
--    pode travar a exclusão de uma conta. Escopo fechado de propósito — só este
--    schema, só FK de uma coluna só, só quem aponta pra auth.users(id) ou
--    public.profiles(id), só quando a ação é NO ACTION ('a') ou RESTRICT ('r').
--    CASCADE e SET NULL já resolvem sozinhos e não são tocados.
do $$
declare
  fk record;
  achou boolean := false;
begin
  if to_regnamespace('fdp_arquivo') is null then
    return;
  end if;

  for fk in
    select con.conname                  as nome,
           con.conrelid::regclass::text as tabela,
           att.attname::text            as coluna,
           con.confrelid::regclass::text as alvo,
           alvo_att.attname::text       as coluna_alvo
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      -- conkey é int2vector (subscrito começa em 0): nada de conkey[1] aqui,
      -- senão o match some sem avisar. Mesmo cuidado da migração 20260915150000.
      join pg_attribute att
        on att.attrelid = con.conrelid
       and att.attnum = any (con.conkey::int2[])
      join pg_attribute alvo_att
        on alvo_att.attrelid = con.confrelid
       and alvo_att.attnum = any (con.confkey::int2[])
     where con.contype = 'f'
       and nsp.nspname = 'fdp_arquivo'
       and con.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
       and array_length(con.conkey::int2[], 1) = 1
       and con.confdeltype in ('a', 'r')
  loop
    achou := true;
    execute format('alter table %s alter column %I drop not null', fk.tabela, fk.coluna);
    execute format('alter table %s drop constraint %I', fk.tabela, fk.nome);
    execute format(
      'alter table %s add constraint %I foreign key (%I) references %s(%I) on delete set null',
      fk.tabela, fk.nome, fk.coluna, fk.alvo, fk.coluna_alvo
    );
    raise notice 'FK solta corrigida: %.% (%) -> % agora e ON DELETE SET NULL.',
      fk.tabela, fk.coluna, fk.nome, fk.alvo;
  end loop;

  if not achou then
    raise notice 'Nenhuma outra FK de fdp_arquivo trava exclusao de conta.';
  end if;
end
$$;
