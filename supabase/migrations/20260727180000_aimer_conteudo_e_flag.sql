-- Aimer, o chatbot (Fase 3): ia_geracoes ganha colunas de conteúdo (nullable —
-- Planejamento continua sem preencher, só Aimer usa) pra a conversa ficar
-- revisável pela Sil no admin. A tela de revisão em si fica pro polia-admin
-- (outro repo, fora de escopo desta sessão) — a policy já deixa pronto.
alter table public.ia_geracoes add column if not exists pergunta text;
alter table public.ia_geracoes add column if not exists resposta text;

drop policy if exists "IaGeracoes: admin seleciona" on public.ia_geracoes;
create policy "IaGeracoes: admin seleciona" on public.ia_geracoes for select using (is_admin(auth.uid()));

insert into public.feature_flags (key, enabled, description) values
  ('ia_aimer_ativo', true, 'Kill-switch do chat da Aimer (Gemini). Desligar aqui corta a feature sem deploy.')
on conflict (key) do nothing;
