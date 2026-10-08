-- Limite de 100 cartões do Planner no plano Grátis (decisão da Sil, 07/10/2026).
-- Conta tarefas com quadro_id (cartões de quadro), somando todos os quadros.
-- Tarefa sem quadro (vinda de outro lugar do app) não conta. Só barra a
-- CRIAÇÃO: editar ou mover cartão que já existe continua livre (o quadro
-- acima da cota já abre só leitura na tela). Grátis = plano 'confere' ou
-- 'cancelada' (mesma leitura de tierDoPlano no app); beta não tem limite.
-- Mesma mensagem que a tela usa reconhece pelo trecho "limite do plano Grátis".
create or replace function public.assert_cota_cartoes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano text;
  v_total integer;
begin
  if new.quadro_id is null then
    return new;
  end if;
  select plano into v_plano from public.profiles where id = new.user_id;
  if coalesce(v_plano, 'confere') not in ('confere', 'cancelada') then
    return new;
  end if;
  select count(*) into v_total
    from public.tarefas
   where user_id = new.user_id and quadro_id is not null;
  if v_total >= 100 then
    raise exception 'Limite do plano Grátis atingido (100 cartões). Assine o Premium pra liberar.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.assert_cota_cartoes() from public, anon, authenticated;

drop trigger if exists cota_confere_cartoes on public.tarefas;
create trigger cota_confere_cartoes
  before insert on public.tarefas
  for each row execute function public.assert_cota_cartoes();
