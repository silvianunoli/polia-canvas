-- Raio-x do mês pela IA (Fase 3, Projete): leitura mensal gerada pelo Gemini
-- Pro, guardada por (usuária, mês) — re-gerar substitui a leitura anterior do
-- mesmo mês (sem versionar dentro do mês). RLS de select direto pra dona (é
-- conteúdo dela, diferente de ia_geracoes que é telemetria interna deny-all).
create table if not exists public.ia_raiox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mes text not null, -- "2026-07"
  placar text not null,
  causas text not null,
  sugestoes jsonb not null, -- [{texto, rota}]
  dado_ralo boolean not null default false,
  email_enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (user_id, mes)
);
alter table public.ia_raiox enable row level security;
drop policy if exists "IaRaioX: dona seleciona" on public.ia_raiox;
create policy "IaRaioX: dona seleciona" on public.ia_raiox for select using (auth.uid() = user_id);
-- sem insert/update pra ela: só service role escreve (Worker ou Edge Function).

insert into public.feature_flags (key, enabled, description) values
  ('ia_raiox_ativo', true, 'Kill-switch do Raio-x do mês (Gemini + cron mensal).')
on conflict (key) do nothing;
