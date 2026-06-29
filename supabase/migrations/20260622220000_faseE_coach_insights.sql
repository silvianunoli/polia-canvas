-- Fase E — Coach transversal. Cache de insights (TTL ~6h). Idempotente.

CREATE TABLE IF NOT EXISTS public.coach_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  contexto text NOT NULL,
  conteudo text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, contexto)
);

ALTER TABLE public.coach_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CoachInsights: dono seleciona" ON public.coach_insights;
DROP POLICY IF EXISTS "CoachInsights: dono insere" ON public.coach_insights;
DROP POLICY IF EXISTS "CoachInsights: dono atualiza" ON public.coach_insights;
DROP POLICY IF EXISTS "CoachInsights: dono apaga" ON public.coach_insights;
CREATE POLICY "CoachInsights: dono seleciona" ON public.coach_insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "CoachInsights: dono insere" ON public.coach_insights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "CoachInsights: dono atualiza" ON public.coach_insights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "CoachInsights: dono apaga" ON public.coach_insights FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coach_insights_user ON public.coach_insights(user_id, contexto);
