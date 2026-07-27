-- Fundação de IA (Fase 3): contador de uso por usuária/feature/período, com
-- incremento atômico (lock de linha) pra não vazar 2 gerações concorrentes.
-- A chamada reserva ANTES de falar com o Gemini; se a chamada falhar, a
-- reserva é estornada — falha de IA nunca consome cota real da usuária.
create table if not exists public.ia_uso (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  periodo text not null, -- "2026-07" (mês) — outras features podem usar "2026-07-27" (dia)
  contagem int not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, feature, periodo)
);
alter table public.ia_uso enable row level security;
drop policy if exists "IaUso: dona seleciona" on public.ia_uso;
create policy "IaUso: dona seleciona" on public.ia_uso for select using (auth.uid() = user_id);
-- sem policy de insert/update: só as functions abaixo (security definer) escrevem.

create or replace function public.incrementar_ia_uso(p_user_id uuid, p_feature text, p_periodo text, p_limite int)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_atual int;
begin
  insert into public.ia_uso (user_id, feature, periodo) values (p_user_id, p_feature, p_periodo)
  on conflict (user_id, feature, periodo) do nothing;

  select contagem into v_atual from public.ia_uso
  where user_id = p_user_id and feature = p_feature and periodo = p_periodo
  for update;

  if v_atual >= p_limite then
    return false;
  end if;

  update public.ia_uso set contagem = contagem + 1, atualizado_em = now()
  where user_id = p_user_id and feature = p_feature and periodo = p_periodo;
  return true;
end;
$$;
revoke execute on function public.incrementar_ia_uso(uuid, text, text, int) from anon, authenticated;

create or replace function public.estornar_ia_uso(p_user_id uuid, p_feature text, p_periodo text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.ia_uso set contagem = greatest(contagem - 1, 0), atualizado_em = now()
  where user_id = p_user_id and feature = p_feature and periodo = p_periodo;
end;
$$;
revoke execute on function public.estornar_ia_uso(uuid, text, text) from anon, authenticated;

-- Log de cada chamada (telemetria de custo — mesmo espírito de social_geracoes,
-- deny-all de propósito: é telemetria interna, não dado da usuária).
create table if not exists public.ia_geracoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  modelo text not null,
  tokens_in int,
  tokens_out int,
  sucesso boolean not null,
  erro text,
  criado_em timestamptz not null default now()
);
alter table public.ia_geracoes enable row level security;

-- Kill-switch manual (Fase 3 traz só isso; o automático via pg_cron fica pra
-- quando houver volume real de custo pra calibrar o teto).
insert into public.feature_flags (key, enabled, description) values
  ('ia_planejamento_ativo', true, 'Kill-switch da geração do Planejamento por IA (Gemini). Desligar aqui corta a feature sem deploy.')
on conflict (key) do nothing;
