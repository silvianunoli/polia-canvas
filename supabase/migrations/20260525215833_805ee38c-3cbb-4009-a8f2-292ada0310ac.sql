ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS awareness_source text,
  ADD COLUMN IF NOT EXISTS decision_trigger text,
  ADD COLUMN IF NOT EXISTS closing_method text,
  ADD COLUMN IF NOT EXISTS sales_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS star_7_completed_at timestamptz;