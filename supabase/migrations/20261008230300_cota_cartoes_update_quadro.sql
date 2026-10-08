-- Cota de cartões do Planner (20261008210000): fecha o desvio por UPDATE.
--
-- O BURACO
-- O gatilho cota_confere_cartoes é só BEFORE INSERT. Uma tarefa criada SEM
-- quadro (não conta pra cota) e depois atualizada com quadro_id passa a contar
-- como cartão sem passar pela checagem. Com o JWT dela e a API do Supabase,
-- dá pra ter quantos cartões quiser no plano Grátis.
--
-- O QUE MUDA
--  - O gatilho passa a ser BEFORE INSERT OR UPDATE OF quadro_id.
--  - No UPDATE, só conta quando a tarefa ENTRA num quadro (quadro_id antigo
--    nulo, novo preenchido). Mover cartão de um quadro pro outro, editar
--    título/datas, tirar do quadro: continua livre, igual hoje.
--  - O resto da regra é a mesma da 20261008210000: Grátis = 'confere' ou
--    'cancelada' (perfil sem plano também), beta e pagos sem limite, 100
--    cartões somando todos os quadros, mesma mensagem (a tela reconhece pelo
--    trecho "limite do plano Grátis").
--  - Na contagem do UPDATE a própria tarefa não entra (o quadro_id dela no
--    banco ainda é nulo), então quem tem 99 cartões consegue pôr o 100º.
--
-- APLICAR pelo MCP apply_migration (supabase db push falha pela dessincronia
-- antiga do histórico). NÃO APLICADA ainda. Idempotente.

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
  -- UPDATE só interessa quando a tarefa entra num quadro agora.
  if tg_op = 'UPDATE' and old.quadro_id is not null then
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
  before insert or update of quadro_id on public.tarefas
  for each row execute function public.assert_cota_cartoes();
