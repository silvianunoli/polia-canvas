-- Lembretes do Calendário (ONE-244, pedido da Sil em 24/11/2026: "posso colocar
-- o dia de enviar o relatório pra contabilidade e isso gerar lembretes por
-- e-mail e push"). A dona marca um compromisso da marca num dia, com ou sem
-- repetição, e a Pólia One avisa às 8h de Brasília, no dia ou 1, 3 ou 7 dias
-- antes. A regra de repetição mora em supabase/functions/_shared/
-- lembretesCalendario.ts (o app e a edge function usam a mesma).
--
-- Esta migration não liga o envio: o cron entra em 20261124140100, depois do
-- teste na conta de teste da Sil (+teste2, Pro).

create table if not exists public.lembretes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 120),
  observacao text check (observacao is null or char_length(observacao) <= 500),
  dia date not null,
  horario time,
  repeticao text not null default 'nenhuma'
    check (repeticao in ('nenhuma', 'semanal', 'mensal', 'anual')),
  avisar_dias_antes smallint
    check (avisar_dias_antes is null or avisar_dias_antes in (0, 1, 3, 7)),
  feitos date[] not null default '{}' check (cardinality(feitos) <= 600),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists lembretes_user_dia_idx on public.lembretes (user_id, dia);
create index if not exists lembretes_com_aviso_idx on public.lembretes (user_id)
  where avisar_dias_antes is not null;

create or replace function public.lembretes_tocar_atualizado()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  new.atualizado_em := now();
  return new;
end;
$fn$;

drop trigger if exists lembretes_tocar_atualizado on public.lembretes;
create trigger lembretes_tocar_atualizado before update on public.lembretes
  for each row execute function public.lembretes_tocar_atualizado();

alter table public.lembretes enable row level security;
revoke all on public.lembretes from anon, authenticated;
-- user_id fica de fora do insert e do update: vem do default auth.uid().
grant select, delete on public.lembretes to authenticated;
grant insert (titulo, observacao, dia, horario, repeticao, avisar_dias_antes, feitos)
  on public.lembretes to authenticated;
grant update (titulo, observacao, dia, horario, repeticao, avisar_dias_antes, feitos)
  on public.lembretes to authenticated;

-- O Calendário é do Premium e do Pro (lib/planos.ts): criar e editar pedem o
-- plano; ler e apagar, não, pra quem mudou de plano não perder o que marcou.
-- Sem parâmetro: olha só a conta de quem chama (com um id, qualquer conta
-- descobriria o plano de outra).
create or replace function public.lembretes_plano_ok()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and plano in ('controle', 'projete', 'beta')
  );
$fn$;

revoke all on function public.lembretes_plano_ok() from public, anon;
grant execute on function public.lembretes_plano_ok() to authenticated;

drop policy if exists "Lembretes: dona lê" on public.lembretes;
create policy "Lembretes: dona lê" on public.lembretes for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Lembretes: dona cria" on public.lembretes;
create policy "Lembretes: dona cria" on public.lembretes for insert to authenticated
  with check (user_id = auth.uid() and public.lembretes_plano_ok());
drop policy if exists "Lembretes: dona edita" on public.lembretes;
create policy "Lembretes: dona edita" on public.lembretes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.lembretes_plano_ok());
drop policy if exists "Lembretes: dona apaga" on public.lembretes;
create policy "Lembretes: dona apaga" on public.lembretes for delete to authenticated
  using (user_id = auth.uid());

-- Interruptor em Configurações, ligado por padrão (como o notif_entregas).
alter table public.profiles
  add column if not exists notif_lembretes boolean not null default true;

-- Um aviso por ocorrência: a função marca aqui antes de enviar, então repetir a
-- chamada não manda em dobro. Sem policy: só a service role lê e escreve.
create table if not exists public.lembretes_envios (
  lembrete_id uuid not null references public.lembretes (id) on delete cascade,
  ocorrencia date not null,
  criado_em timestamptz not null default now(),
  primary key (lembrete_id, ocorrencia)
);

alter table public.lembretes_envios enable row level security;
revoke all on public.lembretes_envios from anon, authenticated;

-- Quem pode receber: conta no Premium ou no Pro, e-mail confirmado, aviso
-- ligado e algum lembrete com aviso que ainda pode cair (repete, ou o dia não
-- passou). Qual ocorrência avisa hoje é decidido na edge function, com a mesma
-- regra do app.
create or replace function public.alvos_lembretes(p_hoje date)
returns table (user_id uuid, email text, tokens text[], lembretes jsonb)
language sql
stable
security definer
set search_path = public
as $fn$
  with ativos as (
    select l.user_id,
           jsonb_agg(
             jsonb_build_object(
               'id', l.id,
               'titulo', l.titulo,
               'observacao', l.observacao,
               'dia', l.dia,
               'horario', l.horario,
               'repeticao', l.repeticao,
               'avisar_dias_antes', l.avisar_dias_antes,
               'feitos', to_jsonb(l.feitos)
             )
             order by l.dia
           ) as lembretes
      from public.lembretes l
     where l.avisar_dias_antes is not null
       and (l.repeticao <> 'nenhuma' or l.dia >= p_hoje)
     group by l.user_id
  )
  select a.user_id,
         u.email::text,
         (select coalesce(array_agg(d.token), '{}'::text[])
            from public.push_aparelhos d
           where d.user_id = a.user_id),
         a.lembretes
    from ativos a
    join public.profiles p on p.id = a.user_id
    join auth.users u on u.id = a.user_id
   where p.notif_lembretes
     and p.plano in ('controle', 'projete', 'beta')
     and u.email is not null
     and u.email_confirmed_at is not null;
$fn$;

revoke all on function public.alvos_lembretes(date) from public, anon, authenticated;
grant execute on function public.alvos_lembretes(date) to service_role;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'lembretes_calendario_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'lembretes_calendario_secret');
  end if;
end $$;

create or replace function public.conferir_segredo_lembretes_calendario(p_segredo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select decrypted_secret = p_segredo from vault.decrypted_secrets
      where name = 'lembretes_calendario_secret'),
    false
  );
$fn$;

revoke all on function public.conferir_segredo_lembretes_calendario(text) from public, anon, authenticated;
grant execute on function public.conferir_segredo_lembretes_calendario(text) to service_role;

-- Só chama a edge function quando existe algum lembrete com aviso que ainda
-- pode cair.
create or replace function public.disparar_lembretes_calendario()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  segredo text;
begin
  if not exists (
    select 1 from public.lembretes l
     where l.avisar_dias_antes is not null
       and (l.repeticao <> 'nenhuma'
            or l.dia >= (now() at time zone 'America/Sao_Paulo')::date)
  ) then
    return;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets
   where name = 'lembretes_calendario_secret';
  if segredo is not null then
    perform net.http_post(
      url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/lembretes-calendario',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-lembretes-calendario-secret', segredo),
      body := '{}'::jsonb
    );
  end if;
end;
$fn$;

revoke all on function public.disparar_lembretes_calendario() from public, anon, authenticated;
