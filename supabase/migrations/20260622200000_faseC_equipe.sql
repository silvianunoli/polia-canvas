-- Fase C — Minha Equipe + delegação. Idempotente.

CREATE TABLE IF NOT EXISTS public.equipe_membros (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nome text NOT NULL,
  email text,
  papel text NOT NULL DEFAULT 'membro',
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (papel IN ('membro', 'lider')),
  CHECK (status IN ('ativo', 'inativo'))
);

ALTER TABLE public.equipe_membros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe: dono seleciona" ON public.equipe_membros;
DROP POLICY IF EXISTS "Equipe: dono insere" ON public.equipe_membros;
DROP POLICY IF EXISTS "Equipe: dono atualiza" ON public.equipe_membros;
DROP POLICY IF EXISTS "Equipe: dono apaga" ON public.equipe_membros;
CREATE POLICY "Equipe: dono seleciona" ON public.equipe_membros FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Equipe: dono insere" ON public.equipe_membros FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Equipe: dono atualiza" ON public.equipe_membros FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Equipe: dono apaga" ON public.equipe_membros FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_equipe_membros_user ON public.equipe_membros(user_id, status);

DROP TRIGGER IF EXISTS update_equipe_membros_updated_at ON public.equipe_membros;
CREATE TRIGGER update_equipe_membros_updated_at
  BEFORE UPDATE ON public.equipe_membros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Delegação: card (tarefa) → membro da equipe
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.equipe_membros(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tarefas_assigned ON public.tarefas(assigned_to);
