ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_protocol text,
  ADD COLUMN IF NOT EXISTS issue_handling text,
  ADD COLUMN IF NOT EXISTS loyalty_strategy text,
  ADD COLUMN IF NOT EXISTS care_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS star_8_completed_at timestamptz;