-- ONE-133 (23/10/2026), depois da revisão de segurança e arquitetura de
-- 20261023280000. Só funções e um gatilho; tabelas não mudam.
--
--   1. Produto que vira kit perde a receita na hora (gatilho em
--      produto_componentes). Antes a receita sumia da tela mas segurava o
--      arquivamento do insumo, sem lugar pra tirar.
--   2. arquivar_insumo ignora receita de produto arquivado, não físico ou kit.
--   3. registrar_producao: só produto físico; data entre 2000 e amanhã; trava
--      pelo id (duplo clique devolve a mesma produção em vez de erro de chave).
--   4. desfazer_producao trava a variação antes dos insumos, na mesma ordem
--      do registrar (na ordem inversa os dois podiam se esperar pra sempre).
--   5. salvar_receita lê o insumo com FOR SHARE (arquivar no meio espera).
--   6. salvar_insumo: nome repetido ao mesmo tempo dá o texto de sempre.

create or replace function public.salvar_insumo(
  p_id uuid,
  p_nome text,
  p_unidade text,
  p_custo numeric default null,
  p_minimo numeric default 0,
  p_inicial numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_nome text := btrim(coalesce(p_nome, ''));
  v_unidade text := btrim(coalesce(p_unidade, ''));
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  if char_length(v_nome) not between 1 and 80 or char_length(v_unidade) not between 1 and 20 then
    raise exception 'Nome ou unidade inválidos' using errcode = 'check_violation';
  end if;
  if (p_custo is not null and (p_custo < 0 or p_custo > 1000000))
     or coalesce(p_minimo, 0) < 0 or coalesce(p_minimo, 0) > 1000000
     or coalesce(p_inicial, 0) < 0 or coalesce(p_inicial, 0) > 1000000 then
    raise exception 'Valor inválido' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from insumos
    where user_id = v_uid and not arquivado and lower(nome) = lower(v_nome)
      and id is distinct from p_id
  ) then
    raise exception 'Já existe um insumo com esse nome' using errcode = 'unique_violation';
  end if;

  -- Duas criações iguais ao mesmo tempo passam pelo exists acima; o índice
  -- único pega a segunda, e ela recebe o mesmo texto da primeira checagem.
  begin
  if p_id is null then
    insert into insumos (user_id, nome, unidade, custo_unitario, estoque_minimo)
    values (v_uid, v_nome, v_unidade, round(p_custo, 4), round(coalesce(p_minimo, 0), 3))
    returning id into v_id;
    if coalesce(p_inicial, 0) > 0 then
      insert into insumo_movimentos (user_id, insumo_id, tipo, quantidade, motivo)
      values (v_uid, v_id, 'entrada', round(p_inicial, 3), 'estoque inicial');
    end if;
  else
    update insumos set
      nome = v_nome,
      unidade = v_unidade,
      custo_unitario = round(p_custo, 4),
      estoque_minimo = round(coalesce(p_minimo, 0), 3)
    where id = p_id and user_id = v_uid and not arquivado
    returning id into v_id;
    if v_id is null then
      raise exception 'Insumo não encontrado' using errcode = 'no_data_found';
    end if;
  end if;
  exception when unique_violation then
    raise exception 'Já existe um insumo com esse nome' using errcode = 'unique_violation';
  end;
  return v_id;
end;
$$;

create or replace function public.arquivar_insumo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_produto text;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  perform 1 from insumos where id = p_id and user_id = v_uid and not arquivado for update;
  if not found then
    raise exception 'Insumo não encontrado' using errcode = 'no_data_found';
  end if;
  -- Receita que a tela não mostra não segura o insumo: produto arquivado,
  -- que deixou de ser físico ou que virou kit.
  delete from produto_insumos r
  using produtos p
  where r.insumo_id = p_id and r.user_id = v_uid and p.id = r.produto_id
    and (p.arquivado or p.tipo <> 'fisico'
      or exists (select 1 from produto_componentes c where c.kit_id = p.id));
  select p.nome into v_produto
  from produto_insumos r join produtos p on p.id = r.produto_id
  where r.insumo_id = p_id and r.user_id = v_uid
  order by p.nome
  limit 1;
  if v_produto is not null then
    raise exception 'Esse insumo está na receita de %', v_produto using errcode = 'check_violation';
  end if;
  update insumos set arquivado = true where id = p_id and user_id = v_uid;
end;
$$;

create or replace function public.salvar_receita(p_produto_id uuid, p_itens jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_produto public.produtos;
  v_item jsonb;
  v_qtd numeric;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  select * into v_produto from produtos
    where id = p_produto_id and user_id = v_uid and not arquivado
    for update;
  if not found then
    raise exception 'Produto não encontrado' using errcode = 'no_data_found';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) > 50 then
    raise exception 'Receita inválida' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_itens) > 0 then
    if v_produto.tipo <> 'fisico' then
      raise exception 'Receita é só de produto físico' using errcode = 'check_violation';
    end if;
    if exists (select 1 from produto_componentes where kit_id = p_produto_id) then
      raise exception 'Kit não tem receita' using errcode = 'check_violation';
    end if;
  end if;
  if (
    select count(*) <> count(distinct e ->> 'insumo_id') from jsonb_array_elements(p_itens) e
  ) then
    raise exception 'Insumo repetido na receita' using errcode = 'check_violation';
  end if;

  delete from produto_insumos where produto_id = p_produto_id and user_id = v_uid;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := round((v_item ->> 'quantidade')::numeric, 3);
    if v_qtd is null or v_qtd <= 0 or v_qtd > 100000 then
      raise exception 'Quantidade inválida na receita' using errcode = 'check_violation';
    end if;
    -- for share: arquivar_insumo (for update) espera a receita terminar.
    perform 1 from insumos
      where id = (v_item ->> 'insumo_id')::uuid and user_id = v_uid and not arquivado
      for share;
    if not found then
      raise exception 'Insumo não encontrado' using errcode = 'no_data_found';
    end if;
    insert into produto_insumos (user_id, produto_id, insumo_id, quantidade)
    values (v_uid, p_produto_id, (v_item ->> 'insumo_id')::uuid, v_qtd);
  end loop;
end;
$$;

create or replace function public.registrar_producao(
  p_id uuid,
  p_produto_id uuid,
  p_sku_id uuid,
  p_quantidade integer,
  p_data date,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_produto public.produtos;
  v_sku uuid;
  v_variacao text;
  v_linha record;
  v_consumo numeric;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  if p_id is null then
    raise exception 'Produção sem id' using errcode = 'check_violation';
  end if;
  -- Duplo clique manda o mesmo id duas vezes ao mesmo tempo: o segundo espera
  -- o primeiro e devolve a mesma produção, em vez de erro de chave.
  perform pg_advisory_xact_lock(hashtext('producao:' || p_id::text));
  if exists (select 1 from producoes where id = p_id and user_id = v_uid) then
    return p_id;
  end if;
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 100000 then
    raise exception 'Quantidade inválida' using errcode = 'check_violation';
  end if;
  if p_data is null or p_data > current_date + 1 or p_data < date '2000-01-01' then
    raise exception 'Data inválida' using errcode = 'check_violation';
  end if;
  select * into v_produto from produtos
    where id = p_produto_id and user_id = v_uid and not arquivado
    for share;
  if not found then
    raise exception 'Produto não encontrado' using errcode = 'no_data_found';
  end if;
  if v_produto.tipo <> 'fisico' then
    raise exception 'Só produto físico tem produção' using errcode = 'check_violation';
  end if;
  if exists (select 1 from produto_componentes where kit_id = p_produto_id) then
    raise exception 'Kit não se produz: registre a produção dos itens' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from produto_insumos where produto_id = p_produto_id and user_id = v_uid) then
    raise exception 'Esse produto ainda não tem receita' using errcode = 'check_violation';
  end if;

  -- Sem estoque ligado, a produção só baixa os insumos.
  if not v_produto.controla_estoque then
    null;
  elsif p_sku_id is not null then
    select id, variacao into v_sku, v_variacao from produto_skus
      where id = p_sku_id and produto_id = p_produto_id and user_id = v_uid and not arquivado
      for update;
    if v_sku is null then
      raise exception 'Variação não encontrada' using errcode = 'no_data_found';
    end if;
  elsif exists (
    select 1 from produto_skus
    where produto_id = p_produto_id and user_id = v_uid and variacao is not null and not arquivado
  ) then
    raise exception 'Escolha a variação de %', v_produto.nome using errcode = 'check_violation';
  else
    select id, variacao into v_sku, v_variacao from produto_skus
      where produto_id = p_produto_id and user_id = v_uid and variacao is null and not arquivado
      limit 1
      for update;
    if v_sku is null then
      raise exception 'O estoque de % está ligado, mas sem quantidade cadastrada', v_produto.nome
        using errcode = 'check_violation';
    end if;
  end if;

  insert into producoes (id, user_id, produto_id, produto_nome, sku_id, variacao, quantidade, data, observacao)
  values (
    p_id, v_uid, v_produto.id, v_produto.nome, v_sku, v_variacao, p_quantidade, p_data,
    left(nullif(btrim(p_observacao), ''), 500)
  );

  -- Ordem fixa por insumo: duas produções ao mesmo tempo travam na mesma ordem.
  for v_linha in
    select r.insumo_id, r.quantidade, i.nome, i.arquivado
    from produto_insumos r join insumos i on i.id = r.insumo_id
    where r.produto_id = p_produto_id and r.user_id = v_uid
    order by r.insumo_id
  loop
    if v_linha.arquivado then
      raise exception 'Edite a receita de %: o insumo % foi arquivado', v_produto.nome, v_linha.nome
        using errcode = 'check_violation';
    end if;
    v_consumo := round(v_linha.quantidade * p_quantidade, 3);
    if v_consumo > 1000000 then
      raise exception 'Quantidade grande demais pra receita de %', v_produto.nome
        using errcode = 'check_violation';
    end if;
    perform 1 from insumos where id = v_linha.insumo_id for update;
    insert into insumo_movimentos (user_id, insumo_id, tipo, quantidade, producao_id, motivo)
    values (v_uid, v_linha.insumo_id, 'producao', -v_consumo, p_id, left('produção de ' || v_produto.nome, 200));
  end loop;

  if v_sku is not null then
    insert into estoque_movimentos (user_id, sku_id, tipo, quantidade, motivo)
    values (v_uid, v_sku, 'entrada', p_quantidade, 'produção');
  end if;

  return p_id;
end;
$$;

create or replace function public.desfazer_producao(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_producao public.producoes;
  v_mov record;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  select * into v_producao from producoes where id = p_id and user_id = v_uid for update;
  if not found then
    raise exception 'Produção não encontrada' using errcode = 'no_data_found';
  end if;
  if v_producao.desfeita_em is not null then
    raise exception 'Essa produção já foi desfeita' using errcode = 'check_violation';
  end if;

  -- Mesma ordem do registrar_producao (variação, depois insumos): na ordem
  -- inversa, registrar e desfazer ao mesmo tempo travavam um esperando o outro.
  if v_producao.sku_id is not null then
    perform 1 from produto_skus where id = v_producao.sku_id for update;
  end if;

  for v_mov in
    select insumo_id, quantidade from insumo_movimentos
    where producao_id = p_id and tipo = 'producao'
    order by insumo_id
  loop
    perform 1 from insumos where id = v_mov.insumo_id for update;
    insert into insumo_movimentos (user_id, insumo_id, tipo, quantidade, producao_id, motivo)
    values (v_uid, v_mov.insumo_id, 'estorno', -v_mov.quantidade, p_id, 'produção desfeita');
  end loop;

  if v_producao.sku_id is not null then
    insert into estoque_movimentos (user_id, sku_id, tipo, quantidade, motivo)
    values (v_uid, v_producao.sku_id, 'ajuste', -v_producao.quantidade, 'produção desfeita');
  end if;

  update producoes set desfeita_em = now() where id = p_id;
end;
$$;

-- ── produto que vira kit perde a receita ───────────────────────────────────
create or replace function public.kit_sem_receita()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from produto_insumos where produto_id = new.kit_id;
  return new;
end;
$$;

drop trigger if exists produto_componentes_sem_receita on public.produto_componentes;
create trigger produto_componentes_sem_receita
  after insert on public.produto_componentes
  for each row execute function public.kit_sem_receita();

-- Receita que já ficou para trás em kit.
delete from public.produto_insumos r
where exists (select 1 from public.produto_componentes c where c.kit_id = r.produto_id);
