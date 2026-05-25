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