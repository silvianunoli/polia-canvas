-- QA-31 (07/10/2026): a venda registrada pela tela de Clientes caía no dia
-- seguinte quando registrada entre 21h e meia-noite de Brasília. O banco roda
-- em UTC e CURRENT_DATE é o dia UTC. Agora a data do lançamento é o dia em
-- America/Sao_Paulo, calculado a partir de now() (independe do timezone da
-- sessão do banco).
--
-- Só muda a data. Assinatura, SECURITY INVOKER, search_path, mensagens de erro
-- e permissões ficam iguais (CREATE OR REPLACE preserva os GRANTs), então o
-- app atual não precisa de mudança nenhuma.
--
-- ANTES DE APLICAR: conferir que o corpo no ar é o mesmo da migration
-- 20260707120200 (select pg_get_functiondef('public.registrar_venda_cliente(uuid)'::regprocedure);).
-- Se o que está no ar tiver mudado, ajustar aqui antes.
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
  VALUES (
    auth.uid(),
    'entrada',
    COALESCE(v_cliente.valor, 0),
    (now() AT TIME ZONE 'America/Sao_Paulo')::date,
    v_cliente.nome,
    'Venda de produto'
  )
  RETURNING id INTO v_lancamento_id;

  UPDATE public.clientes
  SET venda_registrada = true, updated_at = now()
  WHERE id = p_cliente_id AND user_id = auth.uid();

  RETURN v_lancamento_id;
END;
$$;
