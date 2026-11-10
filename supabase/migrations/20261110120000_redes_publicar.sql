-- Agenda das redes, fase 4 (ONE-156): o publicador.
-- Edge function redes-publicar, chamada pelo cron a cada minuto só quando há
-- trabalho. Regras e passos em supabase/functions/_shared/redesPublicar.ts.
--
-- APLICAR pelo MCP apply_migration, só com o ok da Sil, junto com o deploy da
-- função (sem a função no ar, o cron chama um endereço que não existe). Idempotente.

-- ── 1. colunas do publicador ───────────────────────────────────────────────
alter table public.redes_post_destinos
  -- TikTok: publish_id. Instagram: id do contêiner (antes de publicar).
  add column if not exists envio_id text
    check (envio_id is null or char_length(envio_id) <= 200),
  -- Hora do pedido que publica (init do TikTok, media_publish do Instagram),
  -- gravada ANTES da chamada. Com ela preenchida e sem resposta guardada, o
  -- publicador nunca reenvia: pede pra conferir na rede.
  add column if not exists envio_iniciado_em timestamptz,
  -- Trava da rodada que está mexendo no destino.
  add column if not exists trava_ate timestamptz,
  -- Próxima conferência (processamento na rede, ou nova tentativa antes de enviar).
  add column if not exists conferir_em timestamptz;

create index if not exists redes_post_destinos_fila_idx
  on public.redes_post_destinos (conferir_em)
  where status = 'publicando';

-- O TikTok só baixa foto de endereço verificado: o Worker entrega a foto em
-- one.usepolia.com.br/api/redes/midia/{token}, e só enquanto o token vale.
alter table public.redes_post_midias
  add column if not exists publico_token text
    check (publico_token is null or publico_token ~ '^[a-f0-9]{64}$'),
  add column if not exists publico_ate timestamptz;

create unique index if not exists redes_post_midias_publico_token_idx
  on public.redes_post_midias (publico_token)
  where publico_token is not null;

-- O navegador lê as próprias linhas (select da 20261030120000), mas o token do
-- link e as colunas internas do publicador não são da conta dela.
revoke select on public.redes_post_midias, public.redes_post_destinos from authenticated;
grant select (id, post_id, user_id, ordem, tipo, caminho, mime, bytes, largura, altura, duracao_s, created_at)
  on public.redes_post_midias to authenticated;
grant select (id, post_id, user_id, rede, status, tt_privacidade, tt_permite_comentario,
              tt_permite_dueto, tt_permite_stitch, tt_divulga_marca, tt_marca_propria,
              tt_conteudo_de_marca, conteudo_ia, consentiu_em, publicando_desde, publicado_em,
              externo_id, externo_url, erro, tentativas, created_at, updated_at)
  on public.redes_post_destinos to authenticated;

-- ── 2. tomar a fila ────────────────────────────────────────────────────────
-- Numa transação: o post agendado vencido vira "publicando" (o Cancelar só
-- cancela "agendado", então não disputa com esta função) e os destinos
-- pendentes dele também. Depois, trava e devolve os destinos que precisam de
-- passo agora. skip locked: duas rodadas ao mesmo tempo não pegam a mesma linha.
create or replace function public.redes_publicar_tomar(p_limite integer default 10, p_trava_s integer default 420)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  -- Post vencido sem destino pendente (a conta foi desconectada antes do
  -- horário) não tem o que publicar: sai da fila, senão o cron chamaria a
  -- função todo minuto.
  update public.redes_posts p
     set status = 'cancelado', updated_at = now()
   where p.status = 'agendado'
     and p.agendado_para <= now()
     and not exists (
       select 1 from public.redes_post_destinos d
        where d.post_id = p.id and d.status = 'pendente'
     );

  with vencidos as (
    select id from public.redes_posts
     where status = 'agendado' and agendado_para <= now()
     order by agendado_para
     limit greatest(1, least(p_limite, 50))
     for update skip locked
  ), marcados as (
    update public.redes_posts p
       set status = 'publicando', updated_at = now()
      from vencidos v
     where p.id = v.id
    returning p.id
  )
  update public.redes_post_destinos d
     set status = 'publicando',
         publicando_desde = now(),
         tentativas = least(d.tentativas + 1, 20),
         updated_at = now()
    from marcados m
   where d.post_id = m.id and d.status = 'pendente';

  return query
  with livres as (
    select id from public.redes_post_destinos
     where status = 'publicando'
       and (trava_ate is null or trava_ate < now())
       and (conferir_em is null or conferir_em <= now())
     order by coalesce(conferir_em, publicando_desde)
     limit greatest(1, least(p_limite, 50))
     for update skip locked
  )
  update public.redes_post_destinos d
     set trava_ate = now() + make_interval(secs => greatest(60, least(p_trava_s, 900)))
    from livres l
   where d.id = l.id
  returning d.id;
end;
$fn$;
revoke all on function public.redes_publicar_tomar(integer, integer) from public, anon, authenticated;
grant execute on function public.redes_publicar_tomar(integer, integer) to service_role;

-- ── 3. cron a cada minuto ──────────────────────────────────────────────────
-- Só chama a função quando há post vencido ou destino esperando passo. Mesmo
-- segredo do Vault da redes-token-renovar (redes_token_secret).
create or replace function public.disparar_redes_publicar()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  segredo text;
begin
  if not exists (
       select 1 from redes_posts where status = 'agendado' and agendado_para <= now()
     )
     and not exists (
       select 1 from redes_post_destinos
        where status = 'publicando'
          and (trava_ate is null or trava_ate < now())
          and (conferir_em is null or conferir_em <= now())
     ) then
    return;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'redes_token_secret';
  if segredo is not null then
    perform net.http_post(
      url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/redes-publicar',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-redes-token-secret', segredo)
    );
  end if;
end;
$fn$;
revoke all on function public.disparar_redes_publicar() from public, anon, authenticated;

select cron.unschedule('redes-publicar')
 where exists (select 1 from cron.job where jobname = 'redes-publicar');
select cron.schedule('redes-publicar', '* * * * *', $$select public.disparar_redes_publicar()$$);
