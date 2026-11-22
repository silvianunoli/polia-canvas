-- Dia em que o pedido foi finalizado (22/11/2026, bug relatado pela Sil).
-- A coluna Entregue do quadro mostrava só pedido com a entrega COMBINADA nos
-- últimos 7 dias. Finalizar um pedido atrasado (entrega combinada há mais de 7
-- dias) fazia o cartão sumir na hora. Agora o quadro olha também o dia em que
-- ele virou entregue, gravado aqui por gatilho, valha o caminho que for
-- (quadro, modal, arrastar, integração).

alter table public.vendas add column if not exists entregue_em timestamptz;

create or replace function public.vendas_marca_entregue_em()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.andamento = 'entregue' then
    if tg_op = 'INSERT' or old.andamento is distinct from 'entregue' then
      new.entregue_em := now();
    end if;
  else
    new.entregue_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists vendas_entregue_em on public.vendas;
create trigger vendas_entregue_em before insert or update of andamento on public.vendas
  for each row execute function public.vendas_marca_entregue_em();

-- Os já entregues: o último update é a melhor pista de quando viraram entregue.
update public.vendas
   set entregue_em = updated_at
 where andamento = 'entregue' and entregue_em is null;

create index if not exists vendas_entregue_em_quadro on public.vendas (user_id, entregue_em)
  where andamento = 'entregue';
