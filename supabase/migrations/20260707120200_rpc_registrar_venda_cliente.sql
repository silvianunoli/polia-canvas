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
