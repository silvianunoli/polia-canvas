-- Fase 2 — estender o que já existe.
-- 1) profiles: preferências de notificação + plano (modelo real: beta).
-- 2) quadros: planner boards nomeados (o "planner/[slug]").
-- 3) tarefas: quadro_id pra vincular tarefa a um quadro.
-- Idempotente: seguro rodar mais de uma vez.

-- ============================================================
-- 1) profiles — notificações + plano
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notif_resumo_semanal boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notif_novidades boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notif_dicas boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plano text NOT NULL DEFAULT 'beta';

-- ============================================================
-- 2) quadros — planner boards
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quadros (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nome text NOT NULL,
  slug text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

ALTER TABLE public.quadros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Quadros: dono seleciona" ON public.quadros;
DROP POLICY IF EXISTS "Quadros: dono insere" ON public.quadros;
DROP POLICY IF EXISTS "Quadros: dono atualiza" ON public.quadros;
DROP POLICY IF EXISTS "Quadros: dono apaga" ON public.quadros;
CREATE POLICY "Quadros: dono seleciona" ON public.quadros FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Quadros: dono insere" ON public.quadros FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Quadros: dono atualiza" ON public.quadros FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Quadros: dono apaga" ON public.quadros FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_quadros_user ON public.quadros(user_id, ordem);

DROP TRIGGER IF EXISTS update_quadros_updated_at ON public.quadros;
CREATE TRIGGER update_quadros_updated_at
  BEFORE UPDATE ON public.quadros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3) tarefas — vínculo opcional a um quadro
-- ============================================================
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS quadro_id uuid REFERENCES public.quadros(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tarefas_quadro ON public.tarefas(quadro_id);
