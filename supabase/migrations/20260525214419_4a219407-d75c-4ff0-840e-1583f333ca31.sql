ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS production_capacity text,
  ADD COLUMN IF NOT EXISTS tracking_system text,
  ADD COLUMN IF NOT EXISTS restock_triggers text,
  ADD COLUMN IF NOT EXISTS routine_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS star_6_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS orbit_vitrine_active boolean NOT NULL DEFAULT false;