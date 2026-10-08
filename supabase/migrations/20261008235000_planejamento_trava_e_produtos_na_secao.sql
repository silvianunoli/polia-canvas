-- ONE-96 e ONE-97 (jornada do zero, 08/10/2026). Base: a função no ar, que é a
-- de 20261008160000_materializar_planejamento_sem_produto_lixo.sql.
--
-- ONE-96: o documento do Planejamento perdia resposta. O gatilho lê todas as
-- respostas do campo, junta e grava em planejamento_campos. "Salvar e
-- continuar" manda as respostas pendentes ao mesmo tempo; duas do mesmo campo
-- em transações paralelas não se enxergam e a última a gravar apaga a outra
-- (Propósito ficou com a 1a e a 3a resposta, sem a 2a). O mesmo vale pra
-- "Meta do mês" criada duas vezes. Conserto: trava por usuária+campo no começo
-- do gatilho. Com a trava, a segunda espera a primeira terminar e a leitura
-- seguinte já enxerga as duas respostas.
--
-- ONE-97: o Módulo 3 ainda criava produto a cada salvamento automático ("Cader"
-- virava produto até o próximo salvamento), duplicava o produto que já veio da
-- Calculadora (a checagem só olhava os do Planejamento) e cortava o nome só na
-- vírgula ("Planner anual - pra quem organiza a semana" virava o nome).
-- Conserto:
-- 1) o catálogo só é sincronizado quando a seção 3.1 é concluída ("Salvar e
--    continuar"), por um gatilho em planejamento_secoes. O salvamento
--    automático só atualiza o documento.
-- 2) produto com o mesmo nome, de qualquer origem, não é criado de novo.
-- 3) o nome termina no primeiro separador: vírgula, ponto e vírgula, dois
--    pontos ou travessão/hífen entre espaços. Marcador de lista no começo
--    ("- ", "• ", "1. ") sai.
-- A cota do Grátis continua sem derrubar o salvamento; a tela agora avisa
-- quando a lista passa de 5 (planejamento.modulo.$n.tsx).

create or replace function public.separar_linha_produto(p_linha text)
returns table (nome text, descricao text)
language sql
immutable
set search_path = public
as $fn$
  with limpa as (
    select btrim(regexp_replace(btrim(coalesce(p_linha, '')), '^([-*•·]|\d+[.)])\s+', '')) as l
  ), partes as (
    select l, regexp_match(l, '^(.*?)(\s+[-–—]\s+|[,;:])(.*)$') as m from limpa
  )
  select
    left(btrim(coalesce(m[1], l)), 120) as nome,
    nullif(btrim(coalesce(m[3], '')), '') as descricao
  from partes;
$fn$;

create or replace function public.sincronizar_produtos_planejamento(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_valor text;
  linha   text;
  v_nome  text;
  v_desc  text;
  v_nomes text[] := '{}';
begin
  perform pg_advisory_xact_lock(hashtextextended(p_uid::text || ':produto.lista', 0));

  select valor into v_valor
    from public.planejamento_campos
   where user_id = p_uid and campo = 'produto.lista';

  if v_valor is not null then
    for linha in select unnest(string_to_array(v_valor, E'\n')) loop
      select s.nome into v_nome from public.separar_linha_produto(linha) s;
      if v_nome <> '' then
        v_nomes := v_nomes || lower(v_nome);
      end if;
    end loop;
  end if;

  -- Produto do Planejamento que saiu da lista e que ninguém tocou.
  delete from public.produtos p
   where p.user_id = p_uid
     and p.da_jornada
     and not (lower(btrim(p.nome)) = any (v_nomes))
     and p.preco_venda = 0
     and p.preco_custo is null
     and p.calculadora_breakdown is null
     and p.foto_url is null
     and coalesce(p.historico_precos, '[]'::jsonb) in ('[]'::jsonb, 'null'::jsonb)
     and not exists (select 1 from public.clientes c where c.produto_id = p.id);

  if v_valor is null then return; end if;

  for linha in select unnest(string_to_array(v_valor, E'\n')) loop
    select s.nome, s.descricao into v_nome, v_desc from public.separar_linha_produto(linha) s;
    if v_nome <> '' then
      begin
        insert into public.produtos (user_id, nome, tipo, preco_venda, descricao, da_jornada)
        select p_uid, v_nome, 'fisico', 0, v_desc, true
        where not exists (
          select 1 from public.produtos
           where user_id = p_uid and lower(btrim(nome)) = lower(v_nome)
        );
      exception when sqlstate 'P0001' then
        -- Cota do Grátis cheia: o produto além da cota só não é criado.
        null;
      end;
    end if;
  end loop;
end;
$fn$;

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
begin
  if v_campo is null then return NEW; end if;
  if TG_OP = 'UPDATE' and OLD.resposta is not distinct from NEW.resposta then return NEW; end if;

  -- ONE-96: uma transação por vez por usuária+campo.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || v_campo, 0));

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
  end if;
  -- produto.lista: o catálogo é sincronizado na conclusão da seção 3.1
  -- (sincronizar_produtos_ao_concluir_secao), não a cada salvamento.

  return NEW;
end;
$fn$;

create or replace function public.sincronizar_produtos_ao_concluir_secao()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if NEW.secao = '3.1' and NEW.concluido then
    -- Falha no catálogo não pode travar o "Salvar e continuar": a resposta já
    -- está gravada e a próxima conclusão da seção tenta de novo.
    begin
      perform public.sincronizar_produtos_planejamento(NEW.user_id);
    exception when others then
      raise warning 'sincronizar_produtos_planejamento falhou para %: %', NEW.user_id, sqlerrm;
    end;
  end if;
  return NEW;
end;
$fn$;

drop trigger if exists trg_sincronizar_produtos_secao on public.planejamento_secoes;
create trigger trg_sincronizar_produtos_secao
  after insert or update on public.planejamento_secoes
  for each row execute function public.sincronizar_produtos_ao_concluir_secao();

revoke all on function public.sincronizar_produtos_planejamento(uuid) from public, anon, authenticated;
revoke all on function public.sincronizar_produtos_ao_concluir_secao() from public, anon, authenticated;

-- Conserto dos documentos já gravados: recompõe planejamento_campos a partir das
-- respostas de todo mundo (só o texto; metas e produtos ficam como estão).
insert into public.planejamento_campos (user_id, campo, valor, updated_at)
select user_id, campo, string_agg(resposta, E'\n\n' order by secao, pergunta_idx), now()
  from public.planejamento_respostas
 where campo is not null and btrim(coalesce(resposta, '')) <> ''
 group by user_id, campo
on conflict (user_id, campo) do update
  set valor = excluded.valor, updated_at = now()
  where planejamento_campos.valor is distinct from excluded.valor;
