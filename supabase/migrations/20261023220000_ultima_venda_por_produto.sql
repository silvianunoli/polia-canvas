-- ONE-130 (23/10/2026): data da última venda de cada produto, pra lista de
-- produtos parados. Antes a tela baixava 180 dias de vendas inteiras só pra
-- achar o max(data), e o PostgREST corta em 1.000 linhas sem avisar: com
-- muita venda, produto que vendeu há 170 dias aparecia como "sem venda".
--
-- SECURITY INVOKER: roda com a RLS de quem chama (vendas e venda_itens já
-- só deixam a dona ler as dela), e o filtro por auth.uid() é redundante de
-- propósito.

create or replace function public.ultima_venda_por_produto()
returns table (produto_id uuid, ultima_venda date)
language sql
stable
security invoker
set search_path = public
as $$
  select vi.produto_id, max(v.data) as ultima_venda
  from venda_itens vi
  join vendas v on v.id = vi.venda_id
  where v.user_id = auth.uid()
    and v.status <> 'cancelada'
    and vi.produto_id is not null
  group by vi.produto_id;
$$;

revoke all on function public.ultima_venda_por_produto() from public, anon;
grant execute on function public.ultima_venda_por_produto() to authenticated;
