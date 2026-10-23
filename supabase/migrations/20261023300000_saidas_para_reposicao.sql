-- ONE-134 (23/10/2026): sugestão de reposição. Quanto saiu de cada variação
-- e de cada insumo desde uma data, somado no banco: ler o livro inteiro
-- batia no teto de 1.000 linhas do PostgREST.
--
-- O giro vem do livro de estoque, não de venda_itens: a venda de um kit
-- (ONE-132) baixa os itens dele e só aparece no livro. Venda cancelada volta
-- como 'devolucao' e se anula. Produção desfeita volta como 'estorno'.
-- SECURITY INVOKER: a RLS de leitura (dona) vale como em qualquer select.

create or replace function public.saidas_por_sku(p_desde timestamptz)
returns table (sku_id uuid, saiu bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select m.sku_id, sum(-m.quantidade)::bigint as saiu
  from estoque_movimentos m
  where m.user_id = auth.uid()
    and m.tipo in ('venda', 'devolucao')
    and m.created_at >= p_desde
  group by m.sku_id;
$$;

create or replace function public.consumo_por_insumo(p_desde timestamptz)
returns table (insumo_id uuid, consumo numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select m.insumo_id, sum(-m.quantidade) as consumo
  from insumo_movimentos m
  where m.user_id = auth.uid()
    and m.tipo in ('producao', 'estorno')
    and m.created_at >= p_desde
  group by m.insumo_id;
$$;

revoke all on function public.saidas_por_sku(timestamptz) from public, anon;
revoke all on function public.consumo_por_insumo(timestamptz) from public, anon;
grant execute on function public.saidas_por_sku(timestamptz) to authenticated;
grant execute on function public.consumo_por_insumo(timestamptz) to authenticated;

-- Data de cadastro do insumo na view (coluna nova no fim): insumo com 10
-- dias de vida dividia o consumo por 60 dias e parecia girar 6x menos.
create or replace view public.insumo_saldos
with (security_invoker = true) as
select
  i.id,
  i.user_id,
  i.nome,
  i.unidade,
  i.custo_unitario,
  i.estoque_minimo,
  coalesce(sum(m.quantidade), 0)::numeric(14, 3) as saldo,
  i.created_at
from public.insumos i
left join public.insumo_movimentos m on m.insumo_id = i.id
where not i.arquivado
group by i.id;
