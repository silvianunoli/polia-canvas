-- ONE-134, ajuste de 24/10/2026 (decisão da Sil): perda de insumo entra no
-- consumo da sugestão de compra. Cera que derrete e fita que estraga fazem
-- parte do que sai todo mês; sem elas a sugestão comprava a menos.
--
-- giro_por_insumo soma agora a produção (pela data da produção, sem as
-- desfeitas, como antes) e a perda (pelo dia em que foi registrada, horário
-- de Brasília). Contagem e ajuste continuam fora: corrigem o número, não são
-- consumo.

create or replace function public.giro_por_insumo(p_desde date)
returns table (insumo_id uuid, consumo numeric, inicio date)
language sql
stable
security invoker
set search_path = public
as $$
  with usos as (
    select m.insumo_id, -m.quantidade as qtd, p.data as dia
    from producoes p
    join insumo_movimentos m on m.producao_id = p.id
    where p.user_id = auth.uid()
      and p.desfeita_em is null
      and m.tipo = 'producao'
      and p.data >= p_desde
    union all
    select m.insumo_id, -m.quantidade, (m.created_at at time zone 'America/Sao_Paulo')::date
    from insumo_movimentos m
    where m.user_id = auth.uid()
      and m.tipo = 'perda'
      and m.created_at >= (p_desde::timestamp at time zone 'America/Sao_Paulo')
  ),
  soma as (
    select insumo_id, sum(qtd) as consumo, min(dia) as primeira
    from usos
    group by insumo_id
  )
  select
    i.id,
    coalesce(x.consumo, 0),
    least((i.created_at at time zone 'America/Sao_Paulo')::date, x.primeira)
  from insumos i
  left join soma x on x.insumo_id = i.id
  where i.user_id = auth.uid() and not i.arquivado;
$$;

revoke all on function public.giro_por_insumo(date) from public, anon;
grant execute on function public.giro_por_insumo(date) to authenticated;

-- A perda é lida por conta e data, sem passar pela produção.
create index if not exists insumo_movimentos_perda_idx
  on public.insumo_movimentos (user_id, created_at)
  where tipo = 'perda';
