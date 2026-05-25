ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_voice_yes text,
  ADD COLUMN IF NOT EXISTS brand_voice_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS orbit_vitrine_unlocked boolean NOT NULL DEFAULT false;