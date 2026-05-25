ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS main_channel text,
  ADD COLUMN IF NOT EXISTS visual_presence text,
  ADD COLUMN IF NOT EXISTS purchase_path text,
  ADD COLUMN IF NOT EXISTS presence_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS star_5_completed_at timestamptz;