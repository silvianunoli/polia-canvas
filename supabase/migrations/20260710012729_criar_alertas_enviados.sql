-- Auditoria dos alertas críticos disparados pro Telegram (ver
-- supabase/functions/alertas-criticos). Só a edge function (service role)
-- escreve; admin só lê, pra conferir depois quantos alertas saíram e se
-- algum foi perdido (enviado = false).
create table public.alertas_enviados (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  titulo text not null,
  detalhes jsonb not null default '{}'::jsonb,
  link text,
  ocorrencias integer not null default 1,
  janela_fim timestamptz not null,
  enviado boolean not null default false,
  resposta_provedor text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index alertas_enviados_tipo_janela_idx on public.alertas_enviados (tipo, janela_fim desc);

alter table public.alertas_enviados enable row level security;

create policy "admin le alertas_enviados"
  on public.alertas_enviados
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

-- Sem policy de insert/update/delete: só service role (edge function) escreve.
