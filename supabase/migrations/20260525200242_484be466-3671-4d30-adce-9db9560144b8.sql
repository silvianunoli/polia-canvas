ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_type text CHECK (business_type IN ('produto_fisico','produto_digital','servico','hibrido')),
  ADD COLUMN IF NOT EXISTS business_stage text CHECK (business_stage IN ('ideia','comecei','ja_vendo')),
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;