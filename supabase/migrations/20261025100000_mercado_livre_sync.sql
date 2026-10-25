-- Fase 3c, etapa 3c.3 (VND-30): pedido pago no Mercado Livre vira venda na Pólia.
-- Plano: docs/plano-fase3c-mercado-livre.md §2, §3 e §5.
--
-- Caminho: aviso orders_v2 → edge function ml-webhook (põe o pedido em
-- canal_eventos) → pg_cron a cada minuto chama disparar_ml_sync() → edge function
-- ml-sync busca o pedido e chama registrar_venda_canal (com tarifa e frete) ou
-- cancelar_venda_canal. A varredura de 15 minutos (no ml-sync) cobre aviso perdido.
--
-- Três ajustes de quebra:
-- 1. disparar_tiktok_sync só olha a fila do TikTok (antes, pedido do Mercado
--    Livre na fila fazia o tiktok-sync rodar à toa todo minuto);
-- 2. receber_venda tira também o frete pago pela vendedora (vendas.custo_envio)
--    do lançamento do Financeiro, como já tira a tarifa;
-- 3. segredo, conferência e cron próprios do ml-sync.

-- ── 1. tiktok-sync só com trabalho do TikTok ──────────────────────────────
create or replace function public.disparar_tiktok_sync()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  segredo text;
begin
  if not exists (
       select 1 from canal_eventos
        where canal = 'tiktok_shop' and processado_em is null and tentativas < 5
     )
     and not exists (
       select 1 from canal_fila_estoque
        where canal = 'tiktok_shop' and pendente and tentativas < 5
     )
     and not exists (
       select 1 from canal_conexoes
        where canal = 'tiktok_shop' and status = 'conectada'
          and coalesce(greatest(ultimo_sync, varredura_tentada_em), '-infinity')
              < now() - interval '15 minutes'
     ) then
    return;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'tiktok_sync_secret';
  if segredo is not null then
    perform net.http_post(
      url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/tiktok-sync',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-tiktok-sync-secret', segredo)
    );
  end if;
end;
$fn$;
revoke all on function public.disparar_tiktok_sync() from public, anon, authenticated;

-- ── 2. receber_venda sem o frete da vendedora ─────────────────────────────
-- vendas.frete (pago pela cliente) continua no total; custo_envio é o que o
-- canal cobrou DELA pelo envio e sai do que entra na conta, como a tarifa.
create or replace function public.receber_venda(p_venda_id uuid, p_data date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venda public.vendas;
  v_lancamento_id uuid;
  v_valor numeric;
begin
  select * into v_venda from vendas
    where id = p_venda_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Venda não encontrada' using errcode = 'no_data_found';
  end if;
  if v_venda.status <> 'a_receber' then
    raise exception 'Venda não está a receber' using errcode = 'check_violation';
  end if;

  v_valor := v_venda.total - v_venda.taxa_canal - coalesce(v_venda.custo_envio, 0);
  if v_valor > 0 then
    insert into lancamentos (user_id, tipo, valor, data, descricao, categoria, id_externo)
    values (
      v_venda.user_id, 'entrada', v_valor, coalesce(p_data, v_venda.data),
      left(concat_ws(' · ', 'Venda', v_venda.canal, v_venda.cliente_nome), 200),
      v_venda.categoria, 'venda:' || p_venda_id
    ) returning id into v_lancamento_id;
  end if;

  update vendas set status = 'recebida', lancamento_id = v_lancamento_id where id = p_venda_id;
  return v_lancamento_id;
end;
$$;

-- ── 3. cron do ml-sync ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'ml_sync_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'ml_sync_secret');
  end if;
end $$;

create or replace function public.conferir_segredo_ml_sync(p_segredo text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $fn$
  select coalesce(
    (select decrypted_secret = p_segredo from vault.decrypted_secrets where name = 'ml_sync_secret'),
    false
  );
$fn$;
revoke all on function public.conferir_segredo_ml_sync(text) from public, anon, authenticated;
grant execute on function public.conferir_segredo_ml_sync(text) to service_role;

-- Trabalho = pedido do Mercado Livre na fila, ou conta conectada sem varredura há 15 minutos.
create or replace function public.disparar_ml_sync()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  segredo text;
begin
  if not exists (
       select 1 from canal_eventos
        where canal = 'mercado_livre' and processado_em is null and tentativas < 5
     )
     and not exists (
       select 1 from canal_conexoes
        where canal = 'mercado_livre' and status = 'conectada'
          and coalesce(greatest(ultimo_sync, varredura_tentada_em), '-infinity')
              < now() - interval '15 minutes'
     ) then
    return;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'ml_sync_secret';
  if segredo is not null then
    perform net.http_post(
      url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/ml-sync',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-ml-sync-secret', segredo)
    );
  end if;
end;
$fn$;
revoke all on function public.disparar_ml_sync() from public, anon, authenticated;

select cron.unschedule('ml-sync') where exists (select 1 from cron.job where jobname = 'ml-sync');
select cron.schedule('ml-sync', '* * * * *', $$select public.disparar_ml_sync()$$);
