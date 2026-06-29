-- Fase A — refinar o que já existe (visão-alvo).
-- Aditiva e idempotente.

-- 1) checkins → bem-estar (humor, sono, água, estresse, alimentação, exercício)
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS humor integer;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS sono_horas integer;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS agua_litros numeric(3,1);
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS estresse integer;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS alimentacao integer;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS exercicio boolean;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checkins_humor_chk') THEN
    ALTER TABLE public.checkins ADD CONSTRAINT checkins_humor_chk CHECK (humor IS NULL OR humor BETWEEN 1 AND 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checkins_estresse_chk') THEN
    ALTER TABLE public.checkins ADD CONSTRAINT checkins_estresse_chk CHECK (estresse IS NULL OR estresse BETWEEN 1 AND 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checkins_alimentacao_chk') THEN
    ALTER TABLE public.checkins ADD CONSTRAINT checkins_alimentacao_chk CHECK (alimentacao IS NULL OR alimentacao BETWEEN 1 AND 5);
  END IF;
END $$;

-- 2) habitos → categoria
ALTER TABLE public.habitos ADD COLUMN IF NOT EXISTS categoria text;

-- 3) notas → lixeira (soft delete)
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 4) foco_sessoes → modo + rótulo
ALTER TABLE public.foco_sessoes ADD COLUMN IF NOT EXISTS modo text;
ALTER TABLE public.foco_sessoes ADD COLUMN IF NOT EXISTS rotulo text;
