-- ONE-175 (decisão da Sil, 05/11/2026): os primeiros passos abrem na encomenda,
-- e o bônus de +7 dias no teste do Pro (ONE-136) para de depender do preço na
-- Calculadora. Sai com um pedido entregue, que já supõe o pedido lançado. Antes:
-- preço + pedido + entregue (20261031200100).
--
-- Mesma régua do hook usePrimeirosPassos:
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
