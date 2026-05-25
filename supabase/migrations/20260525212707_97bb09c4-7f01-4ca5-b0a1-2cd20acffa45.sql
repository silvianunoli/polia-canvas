ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS product_description text,
  ADD COLUMN IF NOT EXISTS delivery_method text,
  ADD COLUMN IF NOT EXISTS price_range text,
  ADD COLUMN IF NOT EXISTS product_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS star_4_completed_at timestamptz;