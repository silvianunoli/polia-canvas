-- ONE-166 (01/11/2026): custo cadastrado depois preenche as vendas que ficaram sem ele.
--
-- O custo do item é guardado na hora da venda (custo_do_item, dentro das RPCs
-- de venda). Produto vendido antes de ter custo ficava com venda_itens.custo_unitario
-- null pra sempre: o cartão de Vendas mostrava "sem custo" e não havia como
-- corrigir, porque venda_itens só tem leitura pra dona.
--
-- Agora, quando o custo do produto é preenchido ou muda, os itens dele que
-- ainda estão SEM custo recebem o custo atual. Item que já tem custo nunca é
-- reescrito: o custo da época da venda continua valendo pra ele.
-- Kit: o custo vem dos componentes, então mudar o custo de um componente
-- também tenta preencher as vendas do kit que estavam sem custo.

create or replace function public.preencher_custo_das_vendas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.preco_custo is null or new.preco_custo is not distinct from old.preco_custo then
    return new;
  end if;

  update venda_itens vi
     set custo_unitario = public.custo_do_item(new, new.user_id)
   where vi.produto_id = new.id
     and vi.user_id = new.user_id
     and vi.custo_unitario is null
     and public.custo_do_item(new, new.user_id) is not null;

  update venda_itens vi
     set custo_unitario = public.custo_do_item(k, k.user_id)
    from produtos k
   where k.id = vi.produto_id
     and k.user_id = new.user_id
     and vi.user_id = new.user_id
     and vi.custo_unitario is null
     and k.id in (
       select pc.kit_id from produto_componentes pc
        where pc.componente_id = new.id and pc.user_id = new.user_id
     )
     and public.custo_do_item(k, k.user_id) is not null;

  return new;
end;
$$;
revoke all on function public.preencher_custo_das_vendas() from public, anon, authenticated;

drop trigger if exists produtos_preencher_custo_das_vendas on public.produtos;
create trigger produtos_preencher_custo_das_vendas
  after update of preco_custo on public.produtos
  for each row execute function public.preencher_custo_das_vendas();

-- Quem já cadastrou o custo depois de vender: preenche agora.
update venda_itens vi
   set custo_unitario = public.custo_do_item(p, p.user_id)
  from produtos p
 where p.id = vi.produto_id
   and p.user_id = vi.user_id
   and vi.custo_unitario is null
   and public.custo_do_item(p, p.user_id) is not null;
