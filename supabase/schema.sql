-- ══════════════════════════════════════════════════════════════════════════
-- SCHEMA DE PRODUÇÃO — Pólia v1 (projeto egzwkyqpkexgrhbxwcvb)
-- Baseline gerado em 2026-07-07 a partir do histórico de migrations do banco
-- (supabase_migrations.schema_migrations). É o SQL REAL aplicado, em ordem.
-- Documento de REFERÊNCIA — a fonte da verdade é o banco. Não re-aplicar junto
-- com os arquivos de migration (duplicaria).
-- ══════════════════════════════════════════════════════════════════════════

-- ═══ 20260525184648 ═══

-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  business_name text,
  profile_story text,
  problem_solved text,
  target_customer text,
  mini_pitch text,
  star_1_completed_at timestamptz,
  brand_feeling text,
  brand_visual_style text,
  brand_voice text,
  star_2_completed_at timestamptz,
  competitors text,
  differentiators text,
  positioning_statement text,
  star_3_completed_at timestamptz,
  orbit_marca_viva_unlocked boolean NOT NULL DEFAULT false,
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, business_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'business_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ═══ 20260525184807 ═══

ALTER FUNCTION public.update_updated_at_column() SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;


-- ═══ 20260525191438 ═══
-- Tabela de progresso por etapa
CREATE TABLE IF NOT EXISTS public.user_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  etapa_atual int NOT NULL DEFAULT 1,
  etapa_status jsonb NOT NULL DEFAULT '{"1":"bloqueada","2":"bloqueada","3":"bloqueada","4":"bloqueada","5":"bloqueada","6":"bloqueada","7":"bloqueada","8":"bloqueada","9":"bloqueada","10":"bloqueada","11":"bloqueada"}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
  ON public.user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON public.user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON public.user_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_progress_updated_at
  BEFORE UPDATE ON public.user_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de perfil de negocio (complementar a profiles)
CREATE TABLE IF NOT EXISTS public.user_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  nome_negocio text,
  segmento text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own user_profile"
  ON public.user_profile FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own user_profile"
  ON public.user_profile FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own user_profile"
  ON public.user_profile FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_profile_updated_at
  BEFORE UPDATE ON public.user_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══ 20260525191701 ═══
CREATE TABLE IF NOT EXISTS public.etapa1_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  pergunta_1 text,
  pergunta_2 text,
  pergunta_3 text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.etapa1_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own etapa1 respostas"
  ON public.etapa1_respostas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own etapa1 respostas"
  ON public.etapa1_respostas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own etapa1 respostas"
  ON public.etapa1_respostas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_etapa1_respostas_updated_at
  BEFORE UPDATE ON public.etapa1_respostas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══ 20260525191942 ═══
CREATE TABLE public.etapa1_entregavel (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  bio_curta TEXT,
  publico_alvo TEXT,
  transformacao TEXT,
  gerado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.etapa1_entregavel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own entregavel"
ON public.etapa1_entregavel FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entregavel"
ON public.etapa1_entregavel FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entregavel"
ON public.etapa1_entregavel FOR UPDATE
USING (auth.uid() = user_id);

CREATE TRIGGER update_etapa1_entregavel_updated_at
BEFORE UPDATE ON public.etapa1_entregavel
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══ 20260525195221 ═══
-- Tarefas
create table public.tarefas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  titulo text not null,
  descricao text,
  etapa integer,
  status text not null default 'a_fazer' check (status in ('a_fazer', 'brotando', 'floresceu')),
  fonte text not null default 'manual' check (fonte in ('manual', 'sistema')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entregaveis (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  titulo text not null,
  tipo text not null,
  fase text not null check (fase in ('Sonho', 'Construção', 'Venda', 'Evolução')),
  etapa integer not null,
  conteudo jsonb,
  status text not null default 'rascunho' check (status in ('rascunho', 'concluido')),
  created_at timestamptz not null default now()
);

create table public.conquistas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  titulo text not null,
  descricao text,
  xp integer not null default 0,
  tipo text,
  created_at timestamptz not null default now()
);

alter table public.tarefas enable row level security;
alter table public.entregaveis enable row level security;
alter table public.conquistas enable row level security;

create policy "Tarefas: dono seleciona" on public.tarefas for select using (auth.uid() = user_id);
create policy "Tarefas: dono insere" on public.tarefas for insert with check (auth.uid() = user_id);
create policy "Tarefas: dono atualiza" on public.tarefas for update using (auth.uid() = user_id);
create policy "Tarefas: dono apaga" on public.tarefas for delete using (auth.uid() = user_id);

create policy "Entregaveis: dono seleciona" on public.entregaveis for select using (auth.uid() = user_id);
create policy "Entregaveis: dono insere" on public.entregaveis for insert with check (auth.uid() = user_id);
create policy "Entregaveis: dono atualiza" on public.entregaveis for update using (auth.uid() = user_id);
create policy "Entregaveis: dono apaga" on public.entregaveis for delete using (auth.uid() = user_id);

create policy "Conquistas: dono seleciona" on public.conquistas for select using (auth.uid() = user_id);
create policy "Conquistas: dono insere" on public.conquistas for insert with check (auth.uid() = user_id);
create policy "Conquistas: dono atualiza" on public.conquistas for update using (auth.uid() = user_id);
create policy "Conquistas: dono apaga" on public.conquistas for delete using (auth.uid() = user_id);

create trigger update_tarefas_updated_at
before update on public.tarefas
for each row execute function public.update_updated_at_column();

create index idx_tarefas_user on public.tarefas(user_id, created_at desc);
create index idx_entregaveis_user on public.entregaveis(user_id, created_at desc);
create index idx_conquistas_user on public.conquistas(user_id, created_at desc);

-- ═══ 20260525200241 ═══
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_type text CHECK (business_type IN ('produto_fisico','produto_digital','servico','hibrido')),
  ADD COLUMN IF NOT EXISTS business_stage text CHECK (business_stage IN ('ideia','comecei','ja_vendo')),
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- ═══ 20260525203656 ═══

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_why text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS problem_urgency text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS orbit_brand_alive_unlocked boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS etapa_atual integer NOT NULL DEFAULT 1;


-- ═══ 20260525204524 ═══
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_voice_yes text,
  ADD COLUMN IF NOT EXISTS brand_voice_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS orbit_vitrine_unlocked boolean NOT NULL DEFAULT false;

-- ═══ 20260525205244 ═══
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS positioning_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS orbit_sales_unlocked boolean NOT NULL DEFAULT false;

-- ═══ 20260525210434 ═══
UPDATE public.profiles SET etapa_atual = 2, star_1_completed_at = now() WHERE id = 'f751d9e3-fb01-4356-9daf-d52469a703df' AND star_1_completed_at IS NULL;

-- ═══ 20260525212706 ═══
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS product_description text,
  ADD COLUMN IF NOT EXISTS delivery_method text,
  ADD COLUMN IF NOT EXISTS price_range text,
  ADD COLUMN IF NOT EXISTS product_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS star_4_completed_at timestamptz;

-- ═══ 20260525213043 ═══
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS main_channel text,
  ADD COLUMN IF NOT EXISTS visual_presence text,
  ADD COLUMN IF NOT EXISTS purchase_path text,
  ADD COLUMN IF NOT EXISTS presence_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS star_5_completed_at timestamptz;

-- ═══ 20260525214417 ═══
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS production_capacity text,
  ADD COLUMN IF NOT EXISTS tracking_system text,
  ADD COLUMN IF NOT EXISTS restock_triggers text,
  ADD COLUMN IF NOT EXISTS routine_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS star_6_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS orbit_vitrine_active boolean NOT NULL DEFAULT false;

-- ═══ 20260525215832 ═══
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS awareness_source text,
  ADD COLUMN IF NOT EXISTS decision_trigger text,
  ADD COLUMN IF NOT EXISTS closing_method text,
  ADD COLUMN IF NOT EXISTS sales_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS star_7_completed_at timestamptz;

-- ═══ 20260525220348 ═══
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_protocol text,
  ADD COLUMN IF NOT EXISTS issue_handling text,
  ADD COLUMN IF NOT EXISTS loyalty_strategy text,
  ADD COLUMN IF NOT EXISTS care_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS star_8_completed_at timestamptz;

-- ═══ 20260525221341 ═══
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS audience_content_types text,
  ADD COLUMN IF NOT EXISTS scroll_stoppers text,
  ADD COLUMN IF NOT EXISTS publishing_rhythm text,
  ADD COLUMN IF NOT EXISTS content_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS star_9_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS orbit_sales_active boolean NOT NULL DEFAULT false;

-- ═══ 20260525222402 ═══
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS key_number_1 text,
  ADD COLUMN IF NOT EXISTS review_rhythm text,
  ADD COLUMN IF NOT EXISTS action_triggers text,
  ADD COLUMN IF NOT EXISTS growth_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS star_10_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS orbit_financial_unlocked boolean NOT NULL DEFAULT false;

-- ═══ 20260525223614 ═══
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS growth_vision text,
  ADD COLUMN IF NOT EXISTS key_partners text,
  ADD COLUMN IF NOT EXISTS timeline_goal text,
  ADD COLUMN IF NOT EXISTS network_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS star_11_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS orbit_financial_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS jornada_completed_at timestamptz;

-- ═══ 20260525224812 ═══

CREATE TABLE public.financeiro_mensal (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  mes integer NOT NULL,
  ano integer NOT NULL,
  receita numeric(10,2) NOT NULL DEFAULT 0,
  meta numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mes, ano)
);

ALTER TABLE public.financeiro_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financeiro: dono seleciona" ON public.financeiro_mensal
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Financeiro: dono insere" ON public.financeiro_mensal
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Financeiro: dono atualiza" ON public.financeiro_mensal
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Financeiro: dono apaga" ON public.financeiro_mensal
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_financeiro_mensal_updated_at
  BEFORE UPDATE ON public.financeiro_mensal
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ═══ 20260525225039 ═══
CREATE TABLE public.clientes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nome text NOT NULL,
  contato text,
  status_pedido text CHECK (status_pedido IN ('Em espera', 'Em produção', 'Entregue', 'Atrasado')),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clientes: dono seleciona" ON public.clientes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Clientes: dono insere" ON public.clientes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Clientes: dono atualiza" ON public.clientes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Clientes: dono apaga" ON public.clientes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_clientes_updated_at
BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══ 20260528140509 ═══

-- blog_posts
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  titulo text NOT NULL,
  resumo text,
  conteudo_md text,
  categoria text,
  publicado boolean NOT NULL DEFAULT false,
  publicado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT ALL ON public.blog_posts TO service_role;

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blog: leitura publica de publicados"
  ON public.blog_posts FOR SELECT
  USING (publicado = true);

-- lista_espera
CREATE TABLE public.lista_espera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  tipo_negocio text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.lista_espera TO anon, authenticated;
GRANT ALL ON public.lista_espera TO service_role;

ALTER TABLE public.lista_espera ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lista espera: insercao publica"
  ON public.lista_espera FOR INSERT
  WITH CHECK (true);


-- ═══ 20260528143051 ═══
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

-- ═══ 20260528145717 ═══
UPDATE public.profiles SET is_admin = true WHERE id = (SELECT id FROM auth.users WHERE email ILIKE 'silviaoliveira7288@gmail.com' OR email ILIKE 'silviaioliveira7288@gmail.com');

-- ═══ 20260529195342 ═══
-- Auto-popular conquistas quando uma tarefa floresce (status = 'feito')
-- e quando uma etapa fecha (star_N_completed_at preenchido).

-- 1) Trigger em tarefas: status muda para 'feito'
CREATE OR REPLACE FUNCTION public.fn_conquista_tarefa_florescer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'feito' AND (OLD.status IS DISTINCT FROM 'feito') THEN
    INSERT INTO public.conquistas (user_id, titulo, descricao, tipo, xp)
    VALUES (
      NEW.user_id,
      'tarefa floresceu',
      COALESCE(NEW.titulo, 'uma tarefa virou conquista'),
      'tarefa',
      10
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conquista_tarefa_florescer ON public.tarefas;
CREATE TRIGGER trg_conquista_tarefa_florescer
AFTER UPDATE ON public.tarefas
FOR EACH ROW
EXECUTE FUNCTION public.fn_conquista_tarefa_florescer();

-- 2) Trigger em profiles: alguma star_N_completed_at virou not null
CREATE OR REPLACE FUNCTION public.fn_conquista_etapa_fechada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  etapa_num int;
  col_old timestamptz;
  col_new timestamptz;
BEGIN
  FOR etapa_num IN 1..11 LOOP
    EXECUTE format('SELECT ($1).star_%s_completed_at, ($2).star_%s_completed_at', etapa_num, etapa_num)
      INTO col_old, col_new
      USING OLD, NEW;
    IF col_new IS NOT NULL AND col_old IS NULL THEN
      INSERT INTO public.conquistas (user_id, titulo, descricao, tipo, xp)
      VALUES (
        NEW.id,
        'etapa ' || etapa_num || ' fechada',
        'mais uma estrela acesa na sua constelação',
        'etapa',
        50
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conquista_etapa_fechada ON public.profiles;
CREATE TRIGGER trg_conquista_etapa_fechada
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.fn_conquista_etapa_fechada();

-- ═══ 20260529195417 ═══
REVOKE EXECUTE ON FUNCTION public.fn_conquista_tarefa_florescer() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_conquista_etapa_fechada() FROM PUBLIC, anon, authenticated;

-- ═══ 20260530121619 ═══
UPDATE public.profiles SET business_name = NULL WHERE id = 'f751d9e3-fb01-4356-9daf-d52469a703df';

-- ═══ 20260601125044 ═══

-- Fix privilege escalation: prevent users from setting is_admin on their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND is_admin = (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid())
);

-- Revoke EXECUTE on is_admin from anon (not needed for anonymous users)
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;


-- ═══ 20260622145110 · fase_a_refinamentos ═══
-- Fase A — refinar o que já existe (visão-alvo). Aditiva e idempotente.

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

ALTER TABLE public.habitos ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.foco_sessoes ADD COLUMN IF NOT EXISTS modo text;
ALTER TABLE public.foco_sessoes ADD COLUMN IF NOT EXISTS rotulo text;

-- ═══ 20260622163436 · fase_b_planner ═══
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS prioridade text;
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS prazo date;

-- ═══ 20260622165622 · fase_c_equipe ═══
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

ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.equipe_membros(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tarefas_assigned ON public.tarefas(assigned_to);

-- ═══ 20260622183518 · fase_e_coach_insights ═══
CREATE TABLE IF NOT EXISTS public.coach_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  contexto text NOT NULL,
  conteudo text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, contexto)
);

ALTER TABLE public.coach_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CoachInsights: dono seleciona" ON public.coach_insights;
DROP POLICY IF EXISTS "CoachInsights: dono insere" ON public.coach_insights;
DROP POLICY IF EXISTS "CoachInsights: dono atualiza" ON public.coach_insights;
DROP POLICY IF EXISTS "CoachInsights: dono apaga" ON public.coach_insights;
CREATE POLICY "CoachInsights: dono seleciona" ON public.coach_insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "CoachInsights: dono insere" ON public.coach_insights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "CoachInsights: dono atualiza" ON public.coach_insights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "CoachInsights: dono apaga" ON public.coach_insights FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coach_insights_user ON public.coach_insights(user_id, contexto);

-- ═══ 20260629134241 · entregaveis_unique_user_tipo ═══
ALTER TABLE entregaveis
  ADD CONSTRAINT entregaveis_user_tipo_unique UNIQUE (user_id, tipo);

-- ═══ 20260629204910 · create_presencas_table ═══
create table if not exists public.presencas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null,
  created_at timestamptz not null default now(),
  unique (user_id, data)
);

alter table public.presencas enable row level security;

create policy "presencas_select_own"
  on public.presencas for select
  to authenticated
  using (auth.uid() = user_id);

create policy "presencas_insert_own"
  on public.presencas for insert
  to authenticated
  with check (auth.uid() = user_id);

create index if not exists presencas_user_idx on public.presencas (user_id);

-- ═══ 20260629234334 · create_lancamentos_table ═══
create table if not exists public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('entrada','saida')),
  valor numeric not null check (valor >= 0),
  data date not null default current_date,
  descricao text,
  categoria text,
  created_at timestamptz not null default now()
);

alter table public.lancamentos enable row level security;

create policy "lancamentos_select_own"
  on public.lancamentos for select to authenticated
  using (auth.uid() = user_id);

create policy "lancamentos_insert_own"
  on public.lancamentos for insert to authenticated
  with check (auth.uid() = user_id);

create policy "lancamentos_update_own"
  on public.lancamentos for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "lancamentos_delete_own"
  on public.lancamentos for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists lancamentos_user_data_idx on public.lancamentos (user_id, data desc);

-- ═══ 20260629235947 · create_produtos_table ═══
create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  tipo text not null default 'fisico' check (tipo in ('fisico','digital','servico')),
  foto_url text,
  preco_venda numeric not null default 0,
  preco_custo numeric,
  descricao text,
  arquivado boolean not null default false,
  preco_atualizado_em timestamptz,
  historico_precos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.produtos enable row level security;

create policy "produtos_select_own"
  on public.produtos for select to authenticated
  using (auth.uid() = user_id);

create policy "produtos_insert_own"
  on public.produtos for insert to authenticated
  with check (auth.uid() = user_id);

create policy "produtos_update_own"
  on public.produtos for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "produtos_delete_own"
  on public.produtos for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists produtos_user_idx on public.produtos (user_id, arquivado);

-- ═══ 20260630001104 · add_valor_produto_to_clientes ═══
alter table public.clientes
  add column if not exists valor numeric,
  add column if not exists produto_id uuid references public.produtos(id) on delete set null;

-- ═══ 20260630175008 · metas_valor_atual_alvo ═══
alter table public.metas
  add column if not exists valor_atual numeric not null default 0,
  add column if not exists valor_alvo numeric,
  add column if not exists unidade text,
  add column if not exists formato text not null default 'numero';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'metas_formato_check') then
    alter table public.metas add constraint metas_formato_check check (formato in ('numero','moeda'));
  end if;
end $$;

-- ═══ 20260630185404 · rename_orbit_vitrine_to_produtos ═══
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='orbit_vitrine_unlocked') then
    alter table public.profiles rename column orbit_vitrine_unlocked to orbit_produtos_unlocked;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='orbit_vitrine_active') then
    alter table public.profiles rename column orbit_vitrine_active to orbit_produtos_active;
  end if;
end $$;

-- ═══ 20260630205932 · tarefas_status_check_kanban ═══
alter table public.tarefas drop constraint if exists tarefas_status_check;
alter table public.tarefas add constraint tarefas_status_check
  check (status = any (array[
    'a_fazer','brotando','floresceu',
    'ideias','planejado','hoje','em_progresso','pausado','concluido'
  ]));

-- ═══ 20260630222412 · add_descricao_produto ═══
alter table public.profiles add column if not exists descricao_produto jsonb;

-- ═══ 20260702112328 · tarefas_add_resposta ═══
-- Modo Q&A das tarefas da jornada: cada tarefa guarda a resposta da usuária.
-- status='floresceu' passa a significar "tarefa com resposta salva".
alter table public.tarefas
  add column if not exists resposta text;

comment on column public.tarefas.resposta is
  'Resposta da usuária ao prompt da tarefa da jornada (modo Q&A, handoff 2026-07-02). NULL = ainda não respondida.';

-- ═══ 20260703125403 · jornada_wizard_materializacao ═══
-- ── 1. Colunas novas ──────────────────────────────────────────────
alter table public.tarefas   add column if not exists saves_to text;
alter table public.produtos  add column if not exists canal text;
alter table public.produtos  add column if not exists da_jornada boolean not null default false;
alter table public.metas     add column if not exists da_jornada boolean not null default false;
alter table public.profiles  add column if not exists fluxo_pedido text;
alter table public.profiles  add column if not exists fluxo_entrega text;
alter table public.profiles  add column if not exists fluxo_pos_venda text;

comment on column public.tarefas.saves_to is 'Campo lógico da ferramenta que esta tarefa da jornada popula (ex: marca.nome). Dispara a materialização atômica via trigger. NULL = tarefa manual/kanban.';
comment on column public.produtos.canal is 'Onde a compra acontece (DM, link, marketplace...). Preenchido pela Etapa 2 da jornada.';
comment on column public.produtos.da_jornada is 'Produto criado pela jornada (Etapa 2). Usado pra find-or-update pela trigger.';
comment on column public.metas.da_jornada is 'Meta criada pela jornada (Etapa 6). Usado pra find-or-update pela trigger.';

-- ── 2. Parser numérico best-effort (formato BR: 1.234,56) ─────────
create or replace function public.parse_primeiro_numero(p text)
returns numeric
language plpgsql
immutable
as $fn$
declare
  m text;
  ultimo text;
begin
  if p is null then return null; end if;
  m := (regexp_match(p, '(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?|\d+(?:\.\d+)?)'))[1];
  if m is null then return null; end if;
  if position(',' in m) > 0 then
    -- vírgula = decimal BR; ponto = milhar
    m := replace(replace(m, '.', ''), ',', '.');
  elsif position('.' in m) > 0 then
    -- sem vírgula: se o último grupo após ponto tem 3 dígitos, é milhar
    ultimo := (regexp_match(m, '\.(\d+)$'))[1];
    if ultimo is not null and length(ultimo) = 3 then
      m := replace(m, '.', '');
    end if;
  end if;
  return m::numeric;
exception when others then
  return null;
end;
$fn$;

-- ── 3. Compõe/atualiza a nota "Presença" no Caderno a partir das
--       respostas da Etapa 4 (Onde te acharem) ─────────────────────
create or replace function public.compor_nota_presenca(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_conteudo text;
begin
  select string_agg(t.titulo || E'\n' || t.resposta, E'\n\n' order by t.created_at)
    into v_conteudo
    from public.tarefas t
   where t.user_id = p_uid
     and t.etapa = 4
     and t.fonte = 'sistema'
     and t.resposta is not null
     and btrim(t.resposta) <> '';
  if v_conteudo is null then return; end if;

  update public.notas
     set conteudo = v_conteudo, updated_at = now()
   where user_id = p_uid
     and titulo = 'Presença'
     and coalesce(arquivada, false) = false
     and deleted_at is null;
  if not found then
    insert into public.notas (user_id, titulo, conteudo, fixada)
    values (p_uid, 'Presença', v_conteudo, true);
  end if;
end;
$fn$;

-- ── 4. Materializa cada resposta na ferramenta certa (mesma transação
--       do save da resposta). Whitelist por saves_to, sem SQL dinâmico ─
create or replace function public.materializar_tarefa_jornada()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid  uuid    := NEW.user_id;
  v_num  numeric;
  v_mes  int     := extract(month from now())::int;
  v_ano  int     := extract(year  from now())::int;
  v_tipo text;
begin
  -- só materializa tarefa do sistema com destino e resposta preenchida
  if NEW.saves_to is null or NEW.resposta is null or btrim(NEW.resposta) = '' then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and OLD.resposta is not distinct from NEW.resposta then
    return NEW;
  end if;

  v_num := public.parse_primeiro_numero(NEW.resposta);
  select case business_type
           when 'produto_digital' then 'digital'
           when 'servico'         then 'servico'
           else 'fisico'
         end
    into v_tipo
    from public.profiles where id = v_uid;
  v_tipo := coalesce(v_tipo, 'fisico');

  case NEW.saves_to
    -- Etapa 1 → Marca Viva (profiles)
    when 'marca.nome' then
      update public.profiles set business_name  = NEW.resposta, updated_at = now() where id = v_uid;
    when 'marca.publico' then
      update public.profiles set target_customer = NEW.resposta, updated_at = now() where id = v_uid;
    when 'marca.diferencial' then
      update public.profiles set differentiators = NEW.resposta, updated_at = now() where id = v_uid;

    -- Etapa 2 → Catálogo (produtos, linha da jornada)
    when 'produto.nome' then
      update public.produtos set nome = NEW.resposta, updated_at = now()
        where user_id = v_uid and da_jornada;
      if not found then
        insert into public.produtos (user_id, nome, tipo, preco_venda, da_jornada)
        values (v_uid, NEW.resposta, v_tipo, 0, true);
      end if;
    when 'produto.descricao' then
      update public.produtos set descricao = NEW.resposta, updated_at = now()
        where user_id = v_uid and da_jornada;
      if not found then
        insert into public.produtos (user_id, nome, tipo, preco_venda, descricao, da_jornada)
        values (v_uid, 'Meu primeiro produto', v_tipo, 0, NEW.resposta, true);
      end if;
    when 'produto.canal' then
      update public.produtos set canal = NEW.resposta, updated_at = now()
        where user_id = v_uid and da_jornada;
      if not found then
        insert into public.produtos (user_id, nome, tipo, preco_venda, canal, da_jornada)
        values (v_uid, 'Meu primeiro produto', v_tipo, 0, NEW.resposta, true);
      end if;

    -- Etapa 3 → Calculadora (enriquece o produto da jornada) + meta do mês
    when 'calculadora.custo' then
      if v_num is not null then
        update public.produtos set preco_custo = v_num, updated_at = now()
          where user_id = v_uid and da_jornada;
      end if;
    when 'calculadora.preco' then
      if v_num is not null then
        update public.produtos set preco_venda = v_num, preco_atualizado_em = now(), updated_at = now()
          where user_id = v_uid and da_jornada;
      end if;
    when 'calculadora.margem' then
      -- margem % sobre o custo já salvo → preço de venda
      if v_num is not null then
        update public.produtos
           set preco_venda = round(coalesce(preco_custo, 0) * (1 + v_num / 100.0), 2),
               preco_atualizado_em = now(), updated_at = now()
          where user_id = v_uid and da_jornada and coalesce(preco_custo, 0) > 0;
      end if;
    when 'calculadora.valor_hora' then
      null; -- sem coluna dedicada; fica no registro da jornada (tarefas.resposta)

    when 'financeiro.meta_mensal' then
      if v_num is not null then
        update public.financeiro_mensal set meta = v_num, updated_at = now()
          where user_id = v_uid and mes = v_mes and ano = v_ano;
        if not found then
          insert into public.financeiro_mensal (user_id, mes, ano, receita, meta)
          values (v_uid, v_mes, v_ano, 0, v_num);
        end if;
      end if;

    -- Etapa 4 → Caderno (nota Presença) + espelho no profiles
    when 'caderno.canal_principal' then
      update public.profiles set main_channel = NEW.resposta, updated_at = now() where id = v_uid;
      perform public.compor_nota_presenca(v_uid);
    when 'caderno.bio' then
      perform public.compor_nota_presenca(v_uid);
    when 'caderno.fluxo_descoberta' then
      update public.profiles set purchase_path = NEW.resposta, updated_at = now() where id = v_uid;
      perform public.compor_nota_presenca(v_uid);

    -- Etapa 5 → Clientes (fluxo de venda no profiles)
    when 'clientes.fluxo_pedido' then
      update public.profiles set fluxo_pedido    = NEW.resposta, updated_at = now() where id = v_uid;
    when 'clientes.fluxo_entrega' then
      update public.profiles set fluxo_entrega   = NEW.resposta, updated_at = now() where id = v_uid;
    when 'clientes.pos_venda' then
      update public.profiles set fluxo_pos_venda = NEW.resposta, updated_at = now() where id = v_uid;

    -- Etapa 6 → Metas
    when 'metas.meta_receita' then
      if v_num is not null then
        update public.metas set valor_alvo = v_num, formato = 'moeda', updated_at = now()
          where user_id = v_uid and da_jornada and titulo = 'Receita do mês';
        if not found then
          insert into public.metas (user_id, titulo, formato, valor_alvo, valor_atual, status, da_jornada)
          values (v_uid, 'Receita do mês', 'moeda', v_num, 0, 'ativa', true);
        end if;
      end if;
    when 'metas.acao_crescimento' then
      update public.profiles set growth_vision = NEW.resposta, updated_at = now() where id = v_uid;
    when 'metas.metrica_principal' then
      update public.profiles set key_number_1 = NEW.resposta, updated_at = now() where id = v_uid;

    else
      null;
  end case;

  return NEW;
end;
$fn$;

-- ── 5. Trigger ─────────────────────────────────────────────────────
drop trigger if exists trg_materializar_tarefa on public.tarefas;
create trigger trg_materializar_tarefa
after insert or update of resposta on public.tarefas
for each row execute function public.materializar_tarefa_jornada();

-- ═══ 20260703131445 · jornada_wizard_seguranca_funcoes ═══
-- Fixa o search_path do parser (só usa pg_catalog).
alter function public.parse_primeiro_numero(text) set search_path = '';

-- Essas funções só devem rodar internamente (trigger / chamada do próprio trigger).
-- Revoga execução pela API pública pra fechar IDOR em compor_nota_presenca e
-- evitar chamada direta ao trigger function.
revoke execute on function public.materializar_tarefa_jornada() from public, anon, authenticated;
revoke execute on function public.compor_nota_presenca(uuid)      from public, anon, authenticated;

-- ═══ 20260703140712 · planejamento_tabelas_trigger ═══
-- ── Tabelas do Planejamento ────────────────────────────────────────
create table if not exists public.planejamento_respostas (
  user_id     uuid not null references auth.users(id) on delete cascade,
  modulo      int  not null,
  secao       text not null,
  pergunta_idx int not null,
  campo       text not null,
  resposta    text,
  updated_at  timestamptz not null default now(),
  primary key (user_id, secao, pergunta_idx)
);

create table if not exists public.planejamento_secoes (
  user_id      uuid not null references auth.users(id) on delete cascade,
  modulo       int  not null,
  secao        text not null,
  concluido    boolean not null default true,
  concluido_em timestamptz not null default now(),
  primary key (user_id, secao)
);

-- KV das respostas materializadas por campo (o que as ferramentas lêem).
create table if not exists public.planejamento_campos (
  user_id    uuid not null references auth.users(id) on delete cascade,
  campo      text not null,
  valor      text,
  updated_at timestamptz not null default now(),
  primary key (user_id, campo)
);

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.planejamento_respostas enable row level security;
alter table public.planejamento_secoes    enable row level security;
alter table public.planejamento_campos     enable row level security;

create policy "resp_own"   on public.planejamento_respostas for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "secoes_own" on public.planejamento_secoes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- campos: usuária só lê; a escrita acontece via trigger (SECURITY DEFINER).
create policy "campos_select_own" on public.planejamento_campos for select to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.planejamento_respostas to authenticated;
grant select, insert, update, delete on public.planejamento_secoes    to authenticated;
grant select on public.planejamento_campos to authenticated;

-- ── Trigger de materialização (respostas → campos + ferramentas) ────
create or replace function public.materializar_planejamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid   uuid    := NEW.user_id;
  v_campo text    := NEW.campo;
  v_valor text;
  v_num   numeric;
  v_mes   int     := extract(month from now())::int;
  v_ano   int     := extract(year  from now())::int;
  linha   text;
  v_nome  text;
begin
  if v_campo is null then return NEW; end if;
  if TG_OP = 'UPDATE' and OLD.resposta is not distinct from NEW.resposta then return NEW; end if;

  -- combina todas as respostas desse campo
  select string_agg(resposta, E'\n\n' order by secao, pergunta_idx)
    into v_valor
    from public.planejamento_respostas
   where user_id = v_uid and campo = v_campo and btrim(coalesce(resposta,'')) <> '';

  if v_valor is null or btrim(v_valor) = '' then
    delete from public.planejamento_campos where user_id = v_uid and campo = v_campo;
    return NEW;
  end if;

  insert into public.planejamento_campos (user_id, campo, valor, updated_at)
  values (v_uid, v_campo, v_valor, now())
  on conflict (user_id, campo) do update set valor = excluded.valor, updated_at = now();

  v_num := public.parse_primeiro_numero(v_valor);

  if v_campo = 'financeiro.meta_mensal' and v_num is not null then
    update public.financeiro_mensal set meta = v_num, updated_at = now()
      where user_id = v_uid and mes = v_mes and ano = v_ano;
    if not found then
      insert into public.financeiro_mensal (user_id, mes, ano, receita, meta)
      values (v_uid, v_mes, v_ano, 0, v_num);
    end if;

  elsif v_campo = 'metas.meta_mes' and v_num is not null then
    update public.metas set valor_alvo = v_num, formato = 'moeda', updated_at = now()
      where user_id = v_uid and da_jornada and titulo = 'Meta do mês';
    if not found then
      insert into public.metas (user_id, titulo, formato, valor_alvo, valor_atual, status, da_jornada)
      values (v_uid, 'Meta do mês', 'moeda', v_num, 0, 'ativa', true);
    end if;

  elsif v_campo = 'produto.lista' then
    -- um produto por linha não-vazia (nome antes da vírgula; resto = descrição)
    for linha in select unnest(string_to_array(v_valor, E'\n')) loop
      v_nome := btrim(split_part(linha, ',', 1));
      if v_nome <> '' then
        insert into public.produtos (user_id, nome, tipo, preco_venda, descricao, da_jornada)
        select v_uid, v_nome, 'fisico', 0,
               case when position(',' in linha) > 0
                    then nullif(btrim(substring(linha from position(',' in linha) + 1)), '')
                    else null end,
               true
        where not exists (
          select 1 from public.produtos
           where user_id = v_uid and da_jornada and lower(nome) = lower(v_nome)
        );
      end if;
    end loop;
  end if;

  return NEW;
end;
$fn$;

revoke execute on function public.materializar_planejamento() from public, anon, authenticated;

drop trigger if exists trg_materializar_planejamento on public.planejamento_respostas;
create trigger trg_materializar_planejamento
after insert or update of resposta on public.planejamento_respostas
for each row execute function public.materializar_planejamento();

-- ═══ 20260704145001 · clientes_add_venda_registrada ═══
alter table public.clientes add column if not exists venda_registrada boolean not null default false;

-- ═══ 20260706124941 · planner_cartao_rico ═══
alter table public.tarefas
  add column if not exists categoria text,
  add column if not exists data_inicio date,
  add column if not exists horario text,
  add column if not exists horas_por_dia numeric,
  add column if not exists meta_id uuid references public.metas(id) on delete set null,
  add column if not exists notas_execucao text;

create table if not exists public.quadro_colunas (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid not null references public.quadros(id) on delete cascade,
  coluna_id text not null,
  nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quadro_id, coluna_id)
);
alter table public.quadro_colunas enable row level security;

create policy "quadro_colunas_select_own" on public.quadro_colunas for select
  using (exists (select 1 from public.quadros q where q.id = quadro_colunas.quadro_id and q.user_id = auth.uid()));
create policy "quadro_colunas_insert_own" on public.quadro_colunas for insert
  with check (exists (select 1 from public.quadros q where q.id = quadro_colunas.quadro_id and q.user_id = auth.uid()));
create policy "quadro_colunas_update_own" on public.quadro_colunas for update
  using (exists (select 1 from public.quadros q where q.id = quadro_colunas.quadro_id and q.user_id = auth.uid()));
create policy "quadro_colunas_delete_own" on public.quadro_colunas for delete
  using (exists (select 1 from public.quadros q where q.id = quadro_colunas.quadro_id and q.user_id = auth.uid()));

-- ═══ 20260706130148 · intencoes_dia ═══
create table if not exists public.intencoes_dia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null,
  texto text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, data)
);
alter table public.intencoes_dia enable row level security;
create policy "intencoes_dia_own" on public.intencoes_dia for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ═══ 20260706132906 · tarefas_tags_livres ═══
alter table public.tarefas add column if not exists tags text[] not null default '{}';

update public.tarefas
set tags = array[
  case categoria
    when 'conteudo' then 'Conteúdo'
    when 'produto' then 'Produto'
    when 'vendas' then 'Vendas'
    when 'admin' then 'Admin'
    else categoria
  end
]
where categoria is not null and categoria <> '' and coalesce(array_length(tags, 1), 0) = 0;


-- ═══ 20260706154844 · google_calendar_conexoes ═══
create table public.google_calendar_conexoes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  email_conectado text,
  state_pendente text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_conexoes enable row level security;
-- Sem nenhuma policy de select/insert/update/delete: acesso só via service role
-- (rotas de servidor). Tokens do Google nunca são lidos/escritos direto pelo client.


-- ═══ 20260707012651 · blog_cms_schema_rls_storage_cron ═══
-- colunas novas em blog_posts (updated_at já existe, não precisa adicionar)
alter table public.blog_posts add column if not exists agendado_para timestamptz null;
alter table public.blog_posts add column if not exists capa_url text null;
alter table public.blog_posts add column if not exists autor_id uuid null references public.profiles(id);
alter table public.blog_posts add column if not exists tempo_leitura integer null;

create index if not exists idx_blog_posts_agendado_para
  on public.blog_posts (agendado_para)
  where publicado = false and agendado_para is not null;

-- RLS: mantém a policy pública existente ("Blog: leitura publica de publicados"), soma admin
drop policy if exists "Blog: admin le tudo" on public.blog_posts;
drop policy if exists "Blog: admin insere" on public.blog_posts;
drop policy if exists "Blog: admin atualiza" on public.blog_posts;
drop policy if exists "Blog: admin apaga" on public.blog_posts;

create policy "Blog: admin le tudo" on public.blog_posts
  for select to authenticated using (is_admin(auth.uid()));
create policy "Blog: admin insere" on public.blog_posts
  for insert to authenticated with check (is_admin(auth.uid()));
create policy "Blog: admin atualiza" on public.blog_posts
  for update to authenticated using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy "Blog: admin apaga" on public.blog_posts
  for delete to authenticated using (is_admin(auth.uid()));

-- Storage: bucket blog-media, leitura publica, escrita só admin
insert into storage.buckets (id, name, public)
values ('blog-media', 'blog-media', true)
on conflict (id) do nothing;

drop policy if exists "Blog media: leitura publica" on storage.objects;
drop policy if exists "Blog media: admin insere" on storage.objects;
drop policy if exists "Blog media: admin atualiza" on storage.objects;
drop policy if exists "Blog media: admin apaga" on storage.objects;

create policy "Blog media: leitura publica" on storage.objects
  for select to public using (bucket_id = 'blog-media');
create policy "Blog media: admin insere" on storage.objects
  for insert to authenticated with check (bucket_id = 'blog-media' and is_admin(auth.uid()));
create policy "Blog media: admin atualiza" on storage.objects
  for update to authenticated using (bucket_id = 'blog-media' and is_admin(auth.uid())) with check (bucket_id = 'blog-media' and is_admin(auth.uid()));
create policy "Blog media: admin apaga" on storage.objects
  for delete to authenticated using (bucket_id = 'blog-media' and is_admin(auth.uid()));

-- pg_cron: publica sozinho na hora agendada
create extension if not exists pg_cron;

create or replace function public.publish_due_posts()
returns void language sql security definer set search_path to 'public' as $$
  update public.blog_posts
  set publicado = true, publicado_em = coalesce(publicado_em, now())
  where publicado = false and agendado_para is not null and agendado_para <= now();
$$;

select cron.unschedule('publish-due-blog-posts')
where exists (select 1 from cron.job where jobname = 'publish-due-blog-posts');

select cron.schedule('publish-due-blog-posts', '* * * * *', $$select public.publish_due_posts();$$);


-- ═══ 20260707012825 · blog_cms_lock_publish_due_posts_rpc ═══
revoke execute on function public.publish_due_posts() from anon, authenticated;

-- ═══ 20260707012856 · blog_cms_lock_publish_due_posts_rpc_v2 ═══
revoke execute on function public.publish_due_posts() from public;
revoke execute on function public.publish_due_posts() from anon, authenticated;

-- ═══ 20260707151922 · gcal_deny_client_access ═══
CREATE POLICY "GCal: sem acesso via cliente"
  ON public.google_calendar_conexoes
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.google_calendar_conexoes IS
  'Tokens OAuth do Google. Acesso SOMENTE via service role em server functions. Nunca criar policy de leitura por usuária: access_token/refresh_token não podem ir ao cliente.';

-- ═══ 20260707153339 · with_check_update_policies ═══
-- Fecha o "roubo de posse": policies de UPDATE só tinham USING (quais linhas posso mexer),
-- sem WITH CHECK (o que a linha pode virar). Sem isso, a usuária A podia UPDATE ... SET
-- user_id = <B> e migrar a linha pra conta de B. WITH CHECK idêntico ao USING impede.

ALTER POLICY "Checkins: dono atualiza" ON public.checkins WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Clientes: dono atualiza" ON public.clientes WITH CHECK (auth.uid() = user_id);
ALTER POLICY "CoachInsights: dono atualiza" ON public.coach_insights WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Conquistas: dono atualiza" ON public.conquistas WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Entregaveis: dono atualiza" ON public.entregaveis WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Equipe: dono atualiza" ON public.equipe_membros WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update own entregavel" ON public.etapa1_entregavel WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update own etapa1 respostas" ON public.etapa1_respostas WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Financeiro: dono atualiza" ON public.financeiro_mensal WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Habitos: dono atualiza" ON public.habitos WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Metas: dono atualiza" ON public.metas WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Notas: dono atualiza" ON public.notas WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Profiles: admin atualiza" ON public.profiles WITH CHECK (is_admin(auth.uid()));
ALTER POLICY "quadro_colunas_update_own" ON public.quadro_colunas WITH CHECK (EXISTS ( SELECT 1 FROM quadros q WHERE ((q.id = quadro_colunas.quadro_id) AND (q.user_id = auth.uid()))));
ALTER POLICY "Quadros: dono atualiza" ON public.quadros WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Tarefas: dono atualiza" ON public.tarefas WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update own user_profile" ON public.user_profile WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update own progress" ON public.user_progress WITH CHECK (auth.uid() = user_id);

-- ═══ 20260707153402 · rpc_registrar_venda_cliente ═══
-- Registro de venda atômico: insere o lançamento e marca a cliente numa só transação.
-- Antes, o app fazia insert + update em duas queries; se o update falhasse, o lançamento
-- ficava órfão e a usuária re-registrava → lançamento DUPLICADO (receita inflada).
-- SECURITY INVOKER: roda como a usuária, respeitando RLS. search_path fixo.
CREATE OR REPLACE FUNCTION public.registrar_venda_cliente(p_cliente_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_cliente public.clientes;
  v_lancamento_id uuid;
BEGIN
  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = p_cliente_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrada' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_cliente.venda_registrada THEN
    RAISE EXCEPTION 'Venda já registrada para esta cliente' USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.lancamentos (user_id, tipo, valor, data, descricao, categoria)
  VALUES (auth.uid(), 'entrada', COALESCE(v_cliente.valor, 0), CURRENT_DATE, v_cliente.nome, 'Venda de produto')
  RETURNING id INTO v_lancamento_id;

  UPDATE public.clientes
  SET venda_registrada = true, updated_at = now()
  WHERE id = p_cliente_id AND user_id = auth.uid();

  RETURN v_lancamento_id;
END;
$$;

-- ═══ 20260707161626 · blog_media_no_public_listing ═══
-- O bucket blog-media é público: imagens dos posts são servidas via getPublicUrl
-- (/object/public/...), que NÃO passa por RLS. A policy SELECT "public" só servia pra
-- permitir LISTAR todos os arquivos via API — o que expõe mídia de rascunhos/agendados.
-- O código nunca lista (só upload + getPublicUrl), então trocamos por listagem só-admin.
DROP POLICY IF EXISTS "Blog media: leitura publica" ON storage.objects;

CREATE POLICY "Blog media: admin lista"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'blog-media' AND is_admin(auth.uid()));

-- ═══ 20260707161758 · is_admin_fecha_enumeracao ═══
-- Fecha a enumeração via /rest/v1/rpc/is_admin: antes, qualquer usuária logada podia
-- perguntar "o UID X é admin?" passando um uuid arbitrário. Agora a função IGNORA o
-- argumento e responde sempre sobre o próprio chamador (auth.uid()).
-- Seguro: todas as ~15 policies chamam is_admin(auth.uid()), então o comportamento delas
-- não muda; e o app lê is_admin direto de profiles, nunca via esta RPC.
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false)
$function$;

