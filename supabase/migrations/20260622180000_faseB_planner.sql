-- Fase B — Planner completo. Aditiva e idempotente.
-- Cards (tarefas) ganham prioridade e prazo. (atribuição = assigned_to vem na Fase C)
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS prioridade text;
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS prazo date;
