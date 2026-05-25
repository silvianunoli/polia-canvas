
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
