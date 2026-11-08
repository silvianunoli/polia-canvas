-- Frete pelo Melhor Envio, etapa 3 (ONE-189): a etiqueta dentro de Pedidos.
--
-- O andamento mora na compra da loja: carrinho > paga > gerada. Quem escreve é a função
-- melhor-envio, com a service role. A dona lê pelo Worker da Pólia One, depois de autenticar.

alter table public.loja_checkouts
  add column etiqueta_id text,
  add column etiqueta_status text check (etiqueta_status in ('carrinho', 'paga', 'gerada')),
  add column etiqueta_custo numeric(12,2) check (etiqueta_custo is null or etiqueta_custo >= 0);

-- ── custo da etiqueta na venda ────────────────────────────────────────────
-- Igual ao Mercado Livre: custo_envio sai do lucro, e o lançamento fica pelo que sobrou de
-- verdade. Cancelar a etiqueta chama com zero e o lançamento volta.
create or replace function public.loja_etiqueta_aplicar_custo(p_user_id uuid, p_venda_id uuid, p_custo numeric)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.vendas;
  v_custo numeric := greatest(round(coalesce(p_custo, 0), 2), 0);
begin
  select * into v from vendas where id = p_venda_id and user_id = p_user_id for update;
  if not found then
    return;
  end if;
  update vendas set custo_envio = v_custo where id = v.id;
  if v.lancamento_id is not null and v.total - v.taxa_canal - v_custo > 0 then
    update lancamentos set valor = v.total - v.taxa_canal - v_custo
     where id = v.lancamento_id and user_id = p_user_id;
  end if;
end;
$$;

revoke all on function public.loja_etiqueta_aplicar_custo(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.loja_etiqueta_aplicar_custo(uuid, uuid, numeric) to service_role;
