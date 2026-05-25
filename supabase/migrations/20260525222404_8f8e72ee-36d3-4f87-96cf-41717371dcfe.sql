ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS key_number_1 text,
  ADD COLUMN IF NOT EXISTS review_rhythm text,
  ADD COLUMN IF NOT EXISTS action_triggers text,
  ADD COLUMN IF NOT EXISTS growth_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS star_10_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS orbit_financial_unlocked boolean NOT NULL DEFAULT false;