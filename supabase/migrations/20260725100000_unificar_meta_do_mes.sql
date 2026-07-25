-- Unifica "Meta do mês": a trigger de materialização passa a alimentar a
-- tabela `metas` a partir de financeiro.meta_boa (pergunta canônica, módulo
-- "Quanto vale") em vez de metas.meta_mes (pergunta duplicada, removida do
-- módulo Metas). financeiro.meta_mensal vira uma meta pessoal separada
-- ("Meta pessoal"), lida do card de Metas, em vez de escrever na tabela
-- financeiro_mensal (que nenhuma tela lê).
create or replace function public.materializar_planejamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid   uuid    := NEW.user_id;
  v_campo text    := NEW.campo;
  v_valor text;
  v_num   numeric;
  linha   text;
  v_nome  text;
begin
  if v_campo is null then return NEW; end if;
  if TG_OP = 'UPDATE' and OLD.resposta is not distinct from NEW.resposta then return NEW; end if;

  -- combina todas as respostas desse campo
  select string_agg(resposta, E'\n\n' order by secao, pergunta_idx)
    into v_valor
    from public.planejamento_respostas
   where user_id = v_uid and campo = v_campo and btrim(coalesce(resposta,'')) <> '';

  if v_valor is null or btrim(v_valor) = '' then
    delete from public.planejamento_campos where user_id = v_uid and campo = v_campo;
    return NEW;
  end if;

  insert into public.planejamento_campos (user_id, campo, valor, updated_at)
  values (v_uid, v_campo, v_valor, now())
  on conflict (user_id, campo) do update set valor = excluded.valor, updated_at = now();

  v_num := public.parse_primeiro_numero(v_valor);

  if v_campo = 'financeiro.meta_boa' and v_num is not null then
    update public.metas set valor_alvo = v_num, formato = 'moeda', updated_at = now()
      where user_id = v_uid and da_jornada and titulo = 'Meta do mês';
    if not found then
      insert into public.metas (user_id, titulo, formato, valor_alvo, valor_atual, status, da_jornada)
      values (v_uid, 'Meta do mês', 'moeda', v_num, 0, 'ativa', true);
    end if;

  elsif v_campo = 'financeiro.meta_mensal' and v_num is not null then
    update public.metas set valor_alvo = v_num, formato = 'moeda', updated_at = now()
      where user_id = v_uid and da_jornada and titulo = 'Meta pessoal';
    if not found then
      insert into public.metas (user_id, titulo, formato, valor_alvo, valor_atual, status, da_jornada)
      values (v_uid, 'Meta pessoal', 'moeda', v_num, 0, 'ativa', true);
    end if;

  elsif v_campo = 'produto.lista' then
    -- um produto por linha não-vazia (nome antes da vírgula; resto = descrição)
    for linha in select unnest(string_to_array(v_valor, E'\n')) loop
      v_nome := btrim(split_part(linha, ',', 1));
      if v_nome <> '' then
        insert into public.produtos (user_id, nome, tipo, preco_venda, descricao, da_jornada)
        select v_uid, v_nome, 'fisico', 0,
               case when position(',' in linha) > 0
                    then nullif(btrim(substring(linha from position(',' in linha) + 1)), '')
                    else null end,
               true
        where not exists (
          select 1 from public.produtos
           where user_id = v_uid and da_jornada and lower(nome) = lower(v_nome)
        );
      end if;
    end loop;
  end if;

  return NEW;
end;
$fn$;

revoke execute on function public.materializar_planejamento() from public, anon, authenticated;
