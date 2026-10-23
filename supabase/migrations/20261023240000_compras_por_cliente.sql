-- ONE-131 (23/10/2026): resumo de compras por cliente, pra clientes que
-- voltam e clientes sumidas (aba "Quem compra" em Vendas). Uma linha por
-- cliente com o nome da ficha, primeira e última compra, quantas compras e
-- quanto comprou (total da venda: subtotal - desconto + frete, recebida ou a
-- receber, sem a taxa do canal). Agregado no banco pelo mesmo motivo de
-- ultima_venda_por_produto. Ainda assim o PostgREST devolve no máximo 1.000
-- linhas por chamada: a tela lê página por página (lerTodasAsPaginas), em
-- ordem de cliente_id.
--
-- Só venda ligada a uma ficha de Clientes (cliente_id): nome digitado solto
-- não dá pra seguir com segurança (duas "Ana" diferentes). O nome vem no join
-- (revisão de 23/10: ler as fichas à parte também batia no teto de 1.000).
-- SECURITY INVOKER: vendas e clientes já só deixam a dona ler as dela.

drop function if exists public.compras_por_cliente();
create function public.compras_por_cliente()
returns table (
  cliente_id uuid,
  nome text,
  primeira_compra date,
  ultima_compra date,
  compras integer,
  total numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select v.cliente_id,
         c.nome,
         min(v.data) as primeira_compra,
         max(v.data) as ultima_compra,
         count(*)::integer as compras,
         round(sum(v.total), 2) as total
  from vendas v
  join clientes c on c.id = v.cliente_id
  where v.user_id = auth.uid()
    and v.status <> 'cancelada'
    and v.cliente_id is not null
  group by v.cliente_id, c.nome;
$$;

revoke all on function public.compras_por_cliente() from public, anon;
grant execute on function public.compras_por_cliente() to authenticated;
