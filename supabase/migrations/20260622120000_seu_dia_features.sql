-- "Seu dia" — camada de operação diária da marca.
-- 7 tabelas: checkins (Diário), habitos + habito_logs (Hábitos), metas (Metas),
-- foco_sessoes (Foco), notas (Caderno), coach_mensagens (Sua guia).
-- RLS por dono (auth.uid() = user_id). Idempotente: seguro rodar mais de uma vez.

-- ============================================================
-- 1) checkins — Diário (check-in do dia, 1 por dia)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  data date NOT NULL DEFAULT current_date,
  energia integer,
  intencao text,
  vitoria text,
  nota text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, data),
  CHECK (energia IS NULL OR (energia BETWEEN 1 AND 5))
);

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Checkins: dono seleciona" ON public.checkins;
DROP POLICY IF EXISTS "Checkins: dono insere" ON public.checkins;
DROP POLICY IF EXISTS "Checkins: dono atualiza" ON public.checkins;
DROP POLICY IF EXISTS "Checkins: dono apaga" ON public.checkins;
CREATE POLICY "Checkins: dono seleciona" ON public.checkins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Checkins: dono insere" ON public.checkins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Checkins: dono atualiza" ON public.checkins FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Checkins: dono apaga" ON public.checkins FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_checkins_user ON public.checkins(user_id, data DESC);

DROP TRIGGER IF EXISTS update_checkins_updated_at ON public.checkins;
CREATE TRIGGER update_checkins_updated_at
  BEFORE UPDATE ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2) habitos — Hábitos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.habitos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nome text NOT NULL,
  emoji text,
  cor text,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.habitos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Habitos: dono seleciona" ON public.habitos;
DROP POLICY IF EXISTS "Habitos: dono insere" ON public.habitos;
DROP POLICY IF EXISTS "Habitos: dono atualiza" ON public.habitos;
DROP POLICY IF EXISTS "Habitos: dono apaga" ON public.habitos;
CREATE POLICY "Habitos: dono seleciona" ON public.habitos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Habitos: dono insere" ON public.habitos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Habitos: dono atualiza" ON public.habitos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Habitos: dono apaga" ON public.habitos FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_habitos_user ON public.habitos(user_id, ordem);

DROP TRIGGER IF EXISTS update_habitos_updated_at ON public.habitos;
CREATE TRIGGER update_habitos_updated_at
  BEFORE UPDATE ON public.habitos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3) habito_logs — marcações de hábito por dia (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.habito_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  habito_id uuid NOT NULL REFERENCES public.habitos(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habito_id, data)
);

ALTER TABLE public.habito_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "HabitoLogs: dono seleciona" ON public.habito_logs;
DROP POLICY IF EXISTS "HabitoLogs: dono insere" ON public.habito_logs;
DROP POLICY IF EXISTS "HabitoLogs: dono apaga" ON public.habito_logs;
CREATE POLICY "HabitoLogs: dono seleciona" ON public.habito_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "HabitoLogs: dono insere" ON public.habito_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "HabitoLogs: dono apaga" ON public.habito_logs FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_habito_logs_user ON public.habito_logs(user_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_habito_logs_habito ON public.habito_logs(habito_id, data DESC);

-- ============================================================
-- 4) metas — Metas (status: ativa | concluida | arquivada)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.metas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'ativa',
  progresso integer NOT NULL DEFAULT 0,
  prazo date,
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('ativa', 'concluida', 'arquivada')),
  CHECK (progresso BETWEEN 0 AND 100)
);

ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Metas: dono seleciona" ON public.metas;
DROP POLICY IF EXISTS "Metas: dono insere" ON public.metas;
DROP POLICY IF EXISTS "Metas: dono atualiza" ON public.metas;
DROP POLICY IF EXISTS "Metas: dono apaga" ON public.metas;
CREATE POLICY "Metas: dono seleciona" ON public.metas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Metas: dono insere" ON public.metas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Metas: dono atualiza" ON public.metas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Metas: dono apaga" ON public.metas FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_metas_user ON public.metas(user_id, status, created_at DESC);

DROP TRIGGER IF EXISTS update_metas_updated_at ON public.metas;
CREATE TRIGGER update_metas_updated_at
  BEFORE UPDATE ON public.metas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5) foco_sessoes — Foco (sessões Pomodoro, append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.foco_sessoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  duracao_min integer NOT NULL,
  tipo text NOT NULL DEFAULT 'foco',
  meta_id uuid REFERENCES public.metas(id) ON DELETE SET NULL,
  nota text,
  concluida boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (tipo IN ('foco', 'pausa'))
);

ALTER TABLE public.foco_sessoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FocoSessoes: dono seleciona" ON public.foco_sessoes;
DROP POLICY IF EXISTS "FocoSessoes: dono insere" ON public.foco_sessoes;
DROP POLICY IF EXISTS "FocoSessoes: dono apaga" ON public.foco_sessoes;
CREATE POLICY "FocoSessoes: dono seleciona" ON public.foco_sessoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "FocoSessoes: dono insere" ON public.foco_sessoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "FocoSessoes: dono apaga" ON public.foco_sessoes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_foco_sessoes_user ON public.foco_sessoes(user_id, created_at DESC);

-- ============================================================
-- 6) notas — Caderno (notas two-panel)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  titulo text NOT NULL DEFAULT '',
  conteudo text NOT NULL DEFAULT '',
  fixada boolean NOT NULL DEFAULT false,
  arquivada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notas: dono seleciona" ON public.notas;
DROP POLICY IF EXISTS "Notas: dono insere" ON public.notas;
DROP POLICY IF EXISTS "Notas: dono atualiza" ON public.notas;
DROP POLICY IF EXISTS "Notas: dono apaga" ON public.notas;
CREATE POLICY "Notas: dono seleciona" ON public.notas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Notas: dono insere" ON public.notas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Notas: dono atualiza" ON public.notas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Notas: dono apaga" ON public.notas FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notas_user ON public.notas(user_id, fixada DESC, updated_at DESC);

DROP TRIGGER IF EXISTS update_notas_updated_at ON public.notas;
CREATE TRIGGER update_notas_updated_at
  BEFORE UPDATE ON public.notas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 7) coach_mensagens — Sua guia (thread da Raposa-Companheira)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coach_mensagens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  papel text NOT NULL,
  conteudo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (papel IN ('user', 'guia'))
);

ALTER TABLE public.coach_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CoachMensagens: dono seleciona" ON public.coach_mensagens;
DROP POLICY IF EXISTS "CoachMensagens: dono insere" ON public.coach_mensagens;
DROP POLICY IF EXISTS "CoachMensagens: dono apaga" ON public.coach_mensagens;
CREATE POLICY "CoachMensagens: dono seleciona" ON public.coach_mensagens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "CoachMensagens: dono insere" ON public.coach_mensagens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "CoachMensagens: dono apaga" ON public.coach_mensagens FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coach_mensagens_user ON public.coach_mensagens(user_id, created_at);
