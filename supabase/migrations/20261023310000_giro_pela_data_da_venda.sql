-- ONE-134 (23/10/2026), depois da revisão de segurança e arquitetura de
-- 20261023300000. Troca saidas_por_sku / consumo_por_insumo (que somavam
-- cada movimento pelo created_at) por giro_por_sku / giro_por_insumo:
--
--   1. Soma pela data da venda (vendas.data) e da produção (producoes.data),
--      sem venda cancelada nem produção desfeita. Antes, cancelar hoje uma
--      venda de dois meses atrás tirava 20 do giro de agora, e lançar hoje as
--      vendas do trimestre jogava tudo nos últimos dias.
--   2. Devolve uma linha por variação e por insumo ativos, com o início do
--      histórico: o cadastro da variação (ou do insumo) ou a primeira saída,
--      o que vier antes. Antes o divisor era a idade do PRODUTO, e o livro de
--      estoque só começa quando o estoque é ligado: produto de julho com
--      estoque ligado hoje dividia 10 dias de venda por 60.
--   3. Índice em producoes (user_id, data). Vendas já tem vendas_user_data_idx
--      e o livro tem estoque_movimentos_venda_idx.

drop function if exists public.saidas_por_sku(timestamptz);
drop function if exists public.consumo_por_insumo(timestamptz);

create or replace function public.giro_por_sku(p_desde date)
returns table (sku_id uuid, saiu bigint, inicio date)
language sql
stable
security invoker
set search_path = public
as $$
  with saidas as (
    select m.sku_id, sum(-m.quantidade)::bigint as saiu, min(v.data) as primeira
    from vendas v
    join estoque_movimentos m on m.venda_id = v.id
    where v.user_id = auth.uid()
      and v.status <> 'cancelada'
      and m.tipo = 'venda'
      and v.data >= p_desde
    group by m.sku_id
  )
  select
    s.id,
    coalesce(x.saiu, 0),
    -- least ignora null: sem venda, vale o cadastro.
    least((s.created_at at time zone 'America/Sao_Paulo')::date, x.primeira)
  from produto_skus s
  left join saidas x on x.sku_id = s.id
  where s.user_id = auth.uid() and not s.arquivado;
$$;

create or replace function public.giro_por_insumo(p_desde date)
returns table (insumo_id uuid, consumo numeric, inicio date)
language sql
stable
security invoker
set search_path = public
as $$
  with usos as (
    select m.insumo_id, sum(-m.quantidade) as consumo, min(p.data) as primeira
    from producoes p
    join insumo_movimentos m on m.producao_id = p.id
    where p.user_id = auth.uid()
      and p.desfeita_em is null
      and m.tipo = 'producao'
      and p.data >= p_desde
    group by m.insumo_id
  )
  select
    i.id,
    coalesce(x.consumo, 0),
    least((i.created_at at time zone 'America/Sao_Paulo')::date, x.primeira)
  from insumos i
  left join usos x on x.insumo_id = i.id
  where i.user_id = auth.uid() and not i.arquivado;
$$;

revoke all on function public.giro_por_sku(date) from public, anon;
revoke all on function public.giro_por_insumo(date) from public, anon;
grant execute on function public.giro_por_sku(date) to authenticated;
grant execute on function public.giro_por_insumo(date) to authenticated;

create index if not exists producoes_user_data_idx on public.producoes (user_id, data);
