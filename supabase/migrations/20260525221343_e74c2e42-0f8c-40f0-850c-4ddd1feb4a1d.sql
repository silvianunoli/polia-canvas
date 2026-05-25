ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS audience_content_types text,
  ADD COLUMN IF NOT EXISTS scroll_stoppers text,
  ADD COLUMN IF NOT EXISTS publishing_rhythm text,
  ADD COLUMN IF NOT EXISTS content_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS star_9_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS orbit_sales_active boolean NOT NULL DEFAULT false;