-- Fase 1 de entitlement: impõe no banco as cotas do plano Confere (grátis)
-- pra produtos, quadros (planner) e notas (caderno). O guard de rota no
-- client (_authenticated.tsx) é só navegação — quem garante a cota de
-- verdade é o Postgres. Contas controle/projete/beta/cancelada nunca são
-- limitadas por esta trigger (só 'confere' tem cota).
--
-- INSERT além da cota: bloqueado direto.
-- UPDATE de uma linha que já está "além da cota" (as N mais antigas por
-- created_at ficam dentro da cota; o resto é excedente de downgrade): também
-- bloqueado, pra cobrir o caso de uma conta que caiu de Controle pra Confere
-- com mais itens do que a cota grátis permite — o dado não é apagado, só não
-- pode ser editado nem multiplicado.

create or replace function public.assert_cota_confere()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano text;
  v_limite integer := tg_argv[0]::integer;
  v_posicao integer;
  -- Cada tabela tem seu próprio critério de "linha ativa" (o que a UI conta
  -- pra cota): produtos exclui arquivado, notas exclui arquivada/excluída
  -- (soft delete), quadros não tem esse conceito. Sem isso, uma usuária que
  -- arquiva/exclui o único item ficaria bloqueada de criar outro mesmo com a
  -- tela mostrando 0 — a trigger tem que enxergar exatamente o que a UI conta.
  v_filtro_ativo text := case tg_table_name
    when 'produtos' then 'and arquivado = false'
    when 'notas' then 'and arquivada = false and deleted_at is null'
    else ''
  end;
  -- Se a própria linha (depois da alteração) não é mais "ativa" pro critério
  -- da tabela, ela não conta pra cota — arquivar/excluir nunca é bloqueado, só
  -- reativar ou editar uma linha que já está ativa e além da posição da cota.
  v_ativo_depois boolean := case tg_table_name
    when 'produtos' then (to_jsonb(new) ->> 'arquivado') is distinct from 'true'
    when 'notas' then
      (to_jsonb(new) ->> 'arquivada') is distinct from 'true'
      and (to_jsonb(new) ->> 'deleted_at') is null
    else true
  end;
begin
  select plano into v_plano from public.profiles where id = new.user_id;
  if v_plano is distinct from 'confere' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not v_ativo_depois then
      return new;
    end if;
    execute format('select count(*) from public.%I where user_id = $1 %s', tg_table_name, v_filtro_ativo)
      into v_posicao using new.user_id;
    if v_posicao >= v_limite then
      raise exception 'Cota do plano Confere atingida (limite de % em %)', v_limite, tg_table_name
        using errcode = 'P0001';
    end if;
  elsif tg_op = 'UPDATE' then
    if not v_ativo_depois then
      return new;
    end if;
    execute format(
      'select count(*) from public.%I where user_id = $1 and (created_at < $2 or (created_at = $2 and id < $3)) %s',
      tg_table_name, v_filtro_ativo
    ) into v_posicao using new.user_id, new.created_at, new.id;
    if v_posicao >= v_limite then
      raise exception 'Este item está além da cota do plano Confere — assine o Controle pra editar'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.assert_cota_confere() is
  'Trigger de cota do plano Confere (Fase 1 de entitlement). Argumento: limite (integer) da tabela.';

drop trigger if exists cota_confere_produtos on public.produtos;
create trigger cota_confere_produtos
  before insert or update on public.produtos
  for each row execute function public.assert_cota_confere('5');

drop trigger if exists cota_confere_quadros on public.quadros;
create trigger cota_confere_quadros
  before insert or update on public.quadros
  for each row execute function public.assert_cota_confere('1');

drop trigger if exists cota_confere_notas on public.notas;
create trigger cota_confere_notas
  before insert or update on public.notas
  for each row execute function public.assert_cota_confere('1');

-- Menor privilégio: essa função só deve rodar como trigger, nunca chamada
-- direto via RPC por anon/authenticated (mesmo princípio da 20260727120000).
-- NOTA (corrigida em 20260727170000): revoke só de anon/authenticated não
-- basta — funções novas recebem EXECUTE pra PUBLIC por padrão no Postgres,
-- e anon/authenticated herdam por ali independente do revoke específico.
-- Precisa revogar de PUBLIC também (feito na migração de correção).
revoke execute on function public.assert_cota_confere() from anon, authenticated;
