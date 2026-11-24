-- Pagamento no pedido, parte 2 (23/11/2026): a loja da marca grava a forma
-- que o Mercado Pago informou (forma_do_meio_mp, migration 20261124020000) na
-- venda e no lançamento. Troca só esses quatro trechos da função em vigor
-- (20261108230000) e falha se algum não for achado, em vez de reescrever as
-- 200 linhas dela.
do $do$
declare
  d text;
  trechos text[][] := array[
    [E'andamento, entrega_em\n  ) values (', E'andamento, entrega_em, forma\n  ) values ('],
    [E'''a_fazer'', v_entrega\n  );', E'''a_fazer'', v_entrega, forma_do_meio_mp(p_meio, v.mp_meio)\n  );'],
    [E'categoria, id_externo)\n    values (\n      v.user_id, ''entrada''', E'categoria, id_externo, forma)\n    values (\n      v.user_id, ''entrada'''],
    [E'v_categoria, ''venda:'' || v_venda_id\n    ) returning id into v_lancamento_id', E'v_categoria, ''venda:'' || v_venda_id, forma_do_meio_mp(p_meio, v.mp_meio)\n    ) returning id into v_lancamento_id']
  ];
  i integer;
begin
  d := pg_get_functiondef('public.loja_checkout_confirmar(text, uuid, text, numeric, numeric, text)'::regprocedure);
  for i in 1 .. array_length(trechos, 1) loop
    if position(trechos[i][1] in d) = 0 then
      raise exception 'loja_checkout_confirmar: trecho % não encontrado', i;
    end if;
    d := replace(d, trechos[i][1], trechos[i][2]);
  end loop;
  execute d;
end;
$do$;