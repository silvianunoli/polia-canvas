-- Raio-x do mês: cada geração fica salva (07/10/2026, pedido da Sil).
--
-- Até aqui ia_raiox tinha UNIQUE (user_id, mes) e o código gravava com upsert,
-- então cada geração nova apagava a anterior do mesmo mês. Agora o código
-- INSERE uma linha por geração e a tela lista as versões do mês, a mais
-- recente primeiro.
--
-- Ordem segura: o código novo (raiox.functions.ts e raiox-mensal-cron) já
-- funciona ANTES desta migração: o insert num mês que já tem linha volta
-- 23505 e cai no update da linha existente (comportamento antigo). Depois
-- desta migração o insert passa direto e o histórico começa a acumular.
-- Atenção: código ANTIGO (upsert com onConflict "user_id,mes") quebra depois
-- desta migração, porque o upsert precisa da UNIQUE. Publicar o Worker e a
-- edge function raiox-mensal-cron ANTES de aplicar.
--
-- Mantém todos os dados: só troca a restrição por um índice não único.

-- O nome da constraint veio do default do Postgres (ia_raiox_user_id_mes_key);
-- procura pela definição pra não depender do nome.
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.ia_raiox'::regclass
      and c.contype = 'u'
      and (
        select array_agg(a.attname::text order by a.attname::text)
        from unnest(c.conkey) as k(attnum)
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
      ) = array['mes', 'user_id']
  loop
    execute format('alter table public.ia_raiox drop constraint %I', r.conname);
  end loop;
end
$$;

-- Leitura da tela: todas as versões de um mês da usuária, mais recente primeiro.
create index if not exists ia_raiox_user_mes_criado_idx
  on public.ia_raiox (user_id, mes, criado_em desc);

comment on table public.ia_raiox is
  'Raio-x do mês pela IA. Uma linha por geração (desde 20261008200000): o mesmo (user_id, mes) pode ter várias versões; a mais recente é a de maior criado_em. Escrita só pelo servidor (service role); a dona lê todas as suas.';
