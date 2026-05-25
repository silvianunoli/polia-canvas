
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_why text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS problem_urgency text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS orbit_brand_alive_unlocked boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS etapa_atual integer NOT NULL DEFAULT 1;
