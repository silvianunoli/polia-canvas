ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS positioning_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS orbit_sales_unlocked boolean NOT NULL DEFAULT false;