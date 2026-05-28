-- 1. is_admin em profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Função helper para checar admin sem recursão de RLS
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = _uid), false)
$$;

-- 2. tickets
CREATE TABLE public.tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_andamento','resolvido')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','urgente')),
  module_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tickets: dono acessa" ON public.tickets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tickets: admin acessa tudo" ON public.tickets FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. ticket_messages
CREATE TABLE public.ticket_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_role text NOT NULL CHECK (author_role IN ('user','admin')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ticket messages: participantes" ON public.ticket_messages FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.is_admin(auth.uid())))
  );
CREATE POLICY "Ticket messages: participantes insere" ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.is_admin(auth.uid())))
  );

-- 4. feedback_responses
CREATE TABLE public.feedback_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('entregavel_concluido','chamado_resolvido')),
  context_ref text NOT NULL,
  score int NOT NULL CHECK (score IN (1,2,3)),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.feedback_responses TO authenticated;
GRANT ALL ON public.feedback_responses TO service_role;
ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Feedback: dono insere" ON public.feedback_responses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Feedback: admin le" ON public.feedback_responses FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 5. feature_flags
CREATE TABLE public.feature_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO anon, authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Flags: leitura publica" ON public.feature_flags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Flags: admin gerencia" ON public.feature_flags FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER update_flags_updated_at BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('beta_aberto', false, 'Abre cadastro publico'),
  ('etapa_11_habilitada', false, 'Libera Etapa 11 pra beta testers'),
  ('csat_modal_ativo', true, 'Exibe modal de CSAT pos-entregavel'),
  ('broadcast_ativo', false, 'Habilita envio de emails em massa');

-- 6. edge_function_logs
CREATE TABLE public.edge_function_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name text NOT NULL,
  user_id uuid,
  status text NOT NULL,
  latency_ms int,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.edge_function_logs TO authenticated;
GRANT ALL ON public.edge_function_logs TO service_role;
ALTER TABLE public.edge_function_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Logs: admin le" ON public.edge_function_logs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE INDEX idx_edge_logs_created ON public.edge_function_logs (created_at DESC);
CREATE INDEX idx_edge_logs_fn ON public.edge_function_logs (function_name);

-- 7. contatos (mensagens do formulario de contato)
CREATE TABLE public.contatos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  email text NOT NULL,
  assunto text NOT NULL,
  mensagem text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contatos TO anon, authenticated;
GRANT SELECT ON public.contatos TO authenticated;
GRANT ALL ON public.contatos TO service_role;
ALTER TABLE public.contatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contatos: insercao publica" ON public.contatos FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Contatos: admin le" ON public.contatos FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 8. Permite admin ler todas as profiles e lista_espera
CREATE POLICY "Profiles: admin le tudo" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "Profiles: admin atualiza" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.lista_espera TO authenticated;
CREATE POLICY "Lista espera: admin le" ON public.lista_espera FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));