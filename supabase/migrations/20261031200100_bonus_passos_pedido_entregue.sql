-- Primeiros passos de operação (decisão da Sil, 31/10/2026): o Planejamento
-- saiu da Pólia One, e os três passos do Painel passaram a ser o primeiro
-- preço, o primeiro pedido e um pedido entregue (src/lib/primeirosPassos.ts).
-- O bônus de +7 dias no teste do Pro (ONE-136) segue a mesma régua. Antes:
-- preço + Módulo 1 fechado + nome da marca (20261024100000).
--
-- Mesma régua do hook usePrimeirosPassos:
--   preço     produto com calculadora_breakdown
--   pedido    venda com andamento (quadro de Pedidos, 20261028140443)
--   entregue  venda com andamento 'entregue' e status diferente de 'cancelada'
-- Mudou lá, migration nova aqui (bonusPrimeirosPassos.test.ts confere os
-- dois lados).
--
-- Só troca a condição. O resto (só conta nova, teste aberto, uma vez só, e o
-- lembrete teste_fim_2d apagado) fica igual.

create or replace function public.resgatar_bonus_primeiros_passos()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_teste public.testes_pro;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  select * into v_teste from testes_pro where user_id = v_uid for update;
  if not found
     or v_teste.origem <> 'cadastro'
     or v_teste.bonus_passos_em is not null
     or v_teste.encerrado_em is not null
     or v_teste.fim <= now() then
    return null;
  end if;

  if not exists (
       select 1 from produtos where user_id = v_uid and calculadora_breakdown is not null
     )
     or not exists (
       select 1 from vendas where user_id = v_uid and andamento is not null
     )
     or not exists (
       select 1 from vendas
        where user_id = v_uid and andamento = 'entregue' and status <> 'cancelada'
     ) then
    return null;
  end if;

  update testes_pro
    set fim = fim + interval '7 days', bonus_passos_em = now()
    where user_id = v_uid
    returning fim into v_teste.fim;
  delete from lembretes_conta where user_id = v_uid and tipo = 'teste_fim_2d';
  return v_teste.fim;
end;
$$;

revoke all on function public.resgatar_bonus_primeiros_passos() from public, anon;
grant execute on function public.resgatar_bonus_primeiros_passos() to authenticated;
