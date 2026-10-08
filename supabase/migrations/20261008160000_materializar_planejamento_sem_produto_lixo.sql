-- QA-16 (07/10/2026): o Módulo 3 cria produto lixo em /produtos.
--
-- NÃO APLICADA. Antes de aplicar (pelo MCP apply_migration, nunca db push):
--   select pg_get_functiondef('public.materializar_planejamento()'::regprocedure);
-- e compare com a versão de 20260725100000_unificar_meta_do_mes.sql, que é a
-- base desta. Se a função no ar tiver algo a mais, junte aqui antes de aplicar.
--
-- O problema: o salvamento automático do Planejamento grava a cada pausa de 1 s
-- na digitação, e o gatilho criava um produto pra cada linha da lista a cada
-- salvamento, sem nunca apagar os anteriores. Digitar "Bo", pausar e seguir
-- "lsa de couro" deixava "Bo" e "Bolsa de couro" no catálogo, com preço R$ 0.
-- Confirmado no banco em 07/10: uma conta com 7 produtos do Planejamento
-- criados em 2 minutos, 5 deles pedaços de digitação.
-- No plano Grátis ainda era pior: a cota de 5 produtos (assert_cota_confere)
-- estourava dentro do gatilho e o salvamento da resposta inteira falhava
-- ("A Pólia One não conseguiu salvar essa resposta").
--
-- O conserto, só no ramo produto.lista (metas ficam iguais):
-- 1) antes de criar, apaga o produto do Planejamento que saiu da lista E que
--    ninguém tocou: preço 0, sem custo, sem cálculo, sem foto, sem histórico e
--    sem cliente ligado. Produto que ela já precificou ou usou nunca é apagado.
-- 2) lista esvaziada também limpa esses produtos intocados.
-- 3) cota do Grátis cheia não derruba o salvamento: o produto além da cota só
--    não é criado (a resposta do Planejamento grava normalmente).

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
  v_nomes text[]  := '{}';
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
    if v_campo = 'produto.lista' then
      -- Lista apagada: sai o que o Planejamento criou e ninguém tocou.
      delete from public.produtos p
       where p.user_id = v_uid
         and p.da_jornada
         and p.preco_venda = 0
         and p.preco_custo is null
         and p.calculadora_breakdown is null
         and p.foto_url is null
         and coalesce(p.historico_precos, '[]'::jsonb) in ('[]'::jsonb, 'null'::jsonb)
         and not exists (select 1 from public.clientes c where c.produto_id = p.id);
    end if;
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
    -- nomes da lista de agora (nome antes da vírgula), em minúsculas
    for linha in select unnest(string_to_array(v_valor, E'\n')) loop
      v_nome := btrim(split_part(linha, ',', 1));
      if v_nome <> '' then
        v_nomes := v_nomes || lower(v_nome);
      end if;
    end loop;

    -- 1) sai o pedaço de digitação: produto do Planejamento fora da lista atual
    --    e intocado (mesmos critérios do ramo de lista vazia)
    delete from public.produtos p
     where p.user_id = v_uid
       and p.da_jornada
       and not (lower(btrim(p.nome)) = any (v_nomes))
       and p.preco_venda = 0
       and p.preco_custo is null
       and p.calculadora_breakdown is null
       and p.foto_url is null
       and coalesce(p.historico_precos, '[]'::jsonb) in ('[]'::jsonb, 'null'::jsonb)
       and not exists (select 1 from public.clientes c where c.produto_id = p.id);

    -- 2) cria o que falta, um produto por linha não-vazia (resto = descrição)
    for linha in select unnest(string_to_array(v_valor, E'\n')) loop
      v_nome := btrim(split_part(linha, ',', 1));
      if v_nome <> '' then
        begin
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
        exception when sqlstate 'P0001' then
          -- 3) cota do plano Grátis cheia (assert_cota_confere): esse produto
          --    não nasce, mas a resposta do Planejamento grava.
          null;
        end;
      end if;
    end loop;
  end if;

  return NEW;
end;
$fn$;

revoke execute on function public.materializar_planejamento() from public, anon, authenticated;
