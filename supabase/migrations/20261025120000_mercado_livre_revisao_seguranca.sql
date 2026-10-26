-- Revisão de segurança da Fase 3c (Mercado Livre, VND-30), etapa 3c.5. Três ajustes:
-- 1. trava com dono: só quem pegou solta, e a trava do token ganha 60 s (antes,
--    uma renovação lenta passava dos 30 s, outra parte pegava a trava e gastava
--    o token de renovação de uso único de novo; o finally da primeira ainda
--    soltava a trava da segunda);
-- 2. aviso do Mercado Livre entra na fila por uma função que não ressuscita
--    evento que já desistiu, não zera as tentativas e para em 500 pendentes por
--    vendedora (o aviso não é assinado; sem isso, ids inventados enchiam a fila);
-- 3. receber_venda com pg_temp por último no search_path, como as da 3a.5.

-- ── 1. trava com dono ─────────────────────────────────────────────────────
alter table public.canal_sync_travas add column if not exists dono uuid;

create or replace function public.pegar_trava_com_dono(p_chave text, p_segundos integer)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_dono uuid := gen_random_uuid();
  v_pegou uuid;
begin
  if p_chave is null or char_length(p_chave) > 100 or p_segundos is null
     or p_segundos < 1 or p_segundos > 600 then
    raise exception 'Trava inválida' using errcode = 'check_violation';
  end if;
  insert into canal_sync_travas (canal, ate, dono)
  values (p_chave, now() + make_interval(secs => p_segundos), v_dono)
  on conflict (canal) do update set ate = excluded.ate, dono = excluded.dono
    where canal_sync_travas.ate < now()
  returning dono into v_pegou;
  return v_pegou;
end;
$fn$;

create or replace function public.soltar_trava_com_dono(p_chave text, p_dono uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $fn$
  -- Um segundo para trás: livre já para a próxima, mesmo na mesma transação.
  update canal_sync_travas set ate = now() - interval '1 second', dono = null
   where canal = p_chave and dono = p_dono;
$fn$;

revoke all on function public.pegar_trava_com_dono(text, integer) from public, anon, authenticated;
revoke all on function public.soltar_trava_com_dono(text, uuid) from public, anon, authenticated;
grant execute on function public.pegar_trava_com_dono(text, integer) to service_role;
grant execute on function public.soltar_trava_com_dono(text, uuid) to service_role;

-- ── 2. aviso na fila sem ressuscitar nem encher ──────────────────────────
-- Pedido novo entra. Pedido já na fila volta a ficar pendente (mudou de status),
-- mas mantém as tentativas; o que já desistiu (5 tentativas) continua desistido.
create or replace function public.enfileirar_evento_canal(
  p_canal text,
  p_shop_id text,
  p_id_externo text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_pendentes integer;
begin
  if p_canal not in ('tiktok_shop', 'shopee', 'mercado_livre')
     or nullif(btrim(p_shop_id), '') is null or char_length(p_shop_id) > 100
     or nullif(btrim(p_id_externo), '') is null or char_length(p_id_externo) > 100 then
    raise exception 'Evento inválido' using errcode = 'check_violation';
  end if;
  select count(*) into v_pendentes from canal_eventos
   where canal = p_canal and shop_id = p_shop_id and processado_em is null;
  if v_pendentes >= 500 then
    return false;
  end if;
  insert into canal_eventos (canal, shop_id, id_externo)
  values (p_canal, p_shop_id, p_id_externo)
  on conflict (canal, shop_id, id_externo) do update
     set processado_em = null, recebido_em = now()
   where canal_eventos.tentativas < 5;
  return true;
end;
$fn$;
revoke all on function public.enfileirar_evento_canal(text, text, text) from public, anon, authenticated;
grant execute on function public.enfileirar_evento_canal(text, text, text) to service_role;

-- ── 3. receber_venda com pg_temp ──────────────────────────────────────────
alter function public.receber_venda(uuid, date) set search_path = public, pg_temp;
