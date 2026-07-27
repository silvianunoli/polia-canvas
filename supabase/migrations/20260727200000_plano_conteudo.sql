-- Plano de conteúdo do ano por IA: 365 ideias diárias de post, editáveis,
-- com check-off de "já postei". Reaproveita ia_uso/incrementar_ia_uso/
-- estornar_ia_uso (feature "plano_conteudo", periodo = ano em texto).
create table if not exists public.ia_plano_conteudo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ano int not null,
  data date not null,
  tipo text not null, -- "feed" | "stories" | "reels" | "carrossel"
  titulo text not null,
  ideia text not null,
  postado boolean not null default false,
  postado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (user_id, data)
);
alter table public.ia_plano_conteudo enable row level security;

create policy "IaPlanoConteudo: dona seleciona" on public.ia_plano_conteudo
  for select using (auth.uid() = user_id);

-- Update liberado pra dona cobre tanto editar título/ideia/tipo quanto marcar
-- postado — é o mesmo rascunho editável, ela é dona do dado.
create policy "IaPlanoConteudo: dona edita" on public.ia_plano_conteudo
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Sem policy de insert/delete: geração (e regeneração, que apaga+recria o ano
-- inteiro) só acontece via service role no createServerFn.

insert into public.feature_flags (key, enabled, description) values
  ('ia_plano_conteudo_ativo', true, 'Kill-switch do Plano de conteúdo do ano (Gemini).')
on conflict (key) do nothing;
