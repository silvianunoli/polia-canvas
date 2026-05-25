ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS growth_vision text,
  ADD COLUMN IF NOT EXISTS key_partners text,
  ADD COLUMN IF NOT EXISTS timeline_goal text,
  ADD COLUMN IF NOT EXISTS network_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS star_11_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS orbit_financial_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS jornada_completed_at timestamptz;