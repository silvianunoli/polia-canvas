-- Preço promocional (24/11/2026, ONE-239). A Sil pediu: "entre o preço de venda e
-- o preço de custo, deve ser adicionado o preço promocional, ou seja, o preço
-- por, o preço de venda deve ser o DE", valendo "em todo o sistema".
--
-- produtos.preco_promocional: quando maior que zero e menor que preco_venda, é o
-- preço que a cliente paga. preco_que_vale(produto) concentra a regra (a mesma
-- de precoQueVale, src/lib/precoPromocional.ts) e passa a ser usada por quem
-- cobra: o pedido da Vitrine online (registrar_pedido_loja) e o checkout da Loja
-- da marca (loja_envio_preparar e loja_checkout_abrir). loja_marca_publica
-- mostra o preço que vale e manda o preço de venda em 'preco_de' quando há
-- promoção. Sem promocional, nada muda: preco_que_vale devolve o preco_venda.
--
-- Pode entrar antes do deploy. A troca do preco_de (versão de horas atrás, com o
-- preço de venda como "por") pro modelo novo fica em 20261124080100, depois.

alter table public.produtos
  add column if not exists preco_promocional numeric(12, 2)
  check (preco_promocional is null or preco_promocional > 0);

comment on column public.produtos.preco_promocional is
  'Preço "por". Vale quando maior que zero e menor que preco_venda (preco_que_vale).';

create or replace function public.preco_que_vale(p public.produtos)
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p.preco_promocional > 0 and p.preco_promocional < p.preco_venda then p.preco_promocional
    else p.preco_venda
  end;
$$;

-- Troca trechos exatos das funções que cobram, sem reescrever o resto. Se o
-- trecho não estiver lá (função mudou), a migration para em vez de seguir.
do $troca$
declare
  r record;
  v_def text;
  v_novo text;
  v_achou integer;
begin
  for r in
    select * from (values
      ('public.registrar_pedido_loja(text,text,jsonb,text,text,text,text,text)'::regprocedure,
       'round(v_produto.preco_venda, 2)', 'round(preco_que_vale(v_produto), 2)', 2),
      ('public.loja_envio_preparar(text,jsonb,text)'::regprocedure,
       'coalesce(v_preco_sku, v_produto.preco_venda)', 'coalesce(v_preco_sku, preco_que_vale(v_produto))', 1),
      ('public.loja_checkout_abrir(text,jsonb,text,text,text,text,uuid)'::regprocedure,
       'coalesce(v_preco_sku, v_produto.preco_venda)', 'coalesce(v_preco_sku, preco_que_vale(v_produto))', 1),
      ('public.loja_marca_publica(text)'::regprocedure,
       '''preco'', p.preco_venda,',
       '''preco'', preco_que_vale(p),
        ''preco_de'', case when preco_que_vale(p) < p.preco_venda then p.preco_venda end,', 1)
    ) as t(fn, velho, novo, vezes)
  loop
    v_def := pg_get_functiondef(r.fn);
    v_achou := (length(v_def) - length(replace(v_def, r.velho, ''))) / length(r.velho);
    if v_achou <> r.vezes then
      raise exception 'Trecho % achado % vezes em % (esperado %)', r.velho, v_achou, r.fn, r.vezes;
    end if;
    v_novo := replace(v_def, r.velho, r.novo);
    execute v_novo;
  end loop;
end;
$troca$;
