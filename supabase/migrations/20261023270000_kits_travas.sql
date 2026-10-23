-- ONE-132 (23/10/2026), depois da revisão de segurança e arquitetura do kit
-- (20261023260000). produto_componentes ainda estava vazia: nada a migrar.
--
--   1. Custo do kit: soma dos componentes; se algum componente não tem custo,
--      vale o custo cadastrado no próprio kit (antes a venda ficava sem custo
--      e saía do "quanto lucra", e a prévia da tela usava outro número).
--      Uma regra só: custo_do_item(), usada nos dois passes.
--   2. Componente ou variação arquivados depois de entrar no kit: a venda
--      para com mensagem que diz o que editar (antes baixava num item que a
--      tela já não mostrava).
--   3. Venda lê o produto com FOR SHARE: um salvar_kit no meio da venda não
--      muda o kit entre o cálculo do custo e a baixa.
--   4. salvar_kit trava por conta (duas abas não montam kit dentro de kit) e
--      recusa item repetido com texto, em vez do erro do índice único.
--   5. Quantidade do kit x quantidade vendida acima do teto do livro de
--      estoque vira mensagem, não erro de CHECK.

create or replace function public.custo_do_item(p_produto public.produtos, p_uid uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  select case
    when exists (select 1 from produto_componentes where kit_id = p_produto.id and user_id = p_uid)
      then coalesce(kit_custo_unitario(p_produto.id, p_uid), p_produto.preco_custo)
    else p_produto.preco_custo
  end;
$$;
revoke all on function public.custo_do_item(public.produtos, uuid) from public, anon, authenticated;

-- ── salvar_kit ─────────────────────────────────────────────────────────────
create or replace function public.salvar_kit(p_kit_id uuid, p_componentes jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_comp public.produtos;
  v_sku uuid;
  v_qtd integer;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  -- Uma edição de kit por vez por conta: sem isso, duas abas salvando A em B
  -- e B em A ao mesmo tempo passavam pelas duas checagens.
  perform pg_advisory_xact_lock(hashtext('kits:' || v_uid::text));
  perform 1 from produtos where id = p_kit_id and user_id = v_uid for update;
  if not found then
    raise exception 'Produto não encontrado' using errcode = 'no_data_found';
  end if;
  if p_componentes is null or jsonb_typeof(p_componentes) <> 'array' then
    raise exception 'Lista de componentes inválida' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_componentes) > 30 then
    raise exception 'Componentes demais num kit' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_componentes) > 0 and exists (
    select 1 from produto_componentes where componente_id = p_kit_id and user_id = v_uid
  ) then
    raise exception 'Esse produto já está dentro de outro kit' using errcode = 'check_violation';
  end if;
  if (
    select count(*) <> count(distinct (e ->> 'componente_id') || ':' || coalesce(e ->> 'sku_id', ''))
    from jsonb_array_elements(p_componentes) e
  ) then
    raise exception 'Item repetido no kit' using errcode = 'check_violation';
  end if;

  delete from produto_componentes where kit_id = p_kit_id and user_id = v_uid;

  for v_item in select * from jsonb_array_elements(p_componentes) loop
    v_qtd := (v_item ->> 'quantidade')::integer;
    if v_qtd is null or v_qtd < 1 or v_qtd > 1000 then
      raise exception 'Quantidade inválida no kit' using errcode = 'check_violation';
    end if;
    select * into v_comp from produtos
      where id = (v_item ->> 'componente_id')::uuid and user_id = v_uid and not arquivado;
    if not found then
      raise exception 'Item do kit arquivado ou não encontrado' using errcode = 'no_data_found';
    end if;
    if v_comp.id = p_kit_id then
      raise exception 'O kit não pode conter ele mesmo' using errcode = 'check_violation';
    end if;
    if exists (select 1 from produto_componentes where kit_id = v_comp.id and user_id = v_uid) then
      raise exception '% já é um kit', v_comp.nome using errcode = 'check_violation';
    end if;
    v_sku := nullif(v_item ->> 'sku_id', '')::uuid;
    if v_sku is not null and not exists (
      select 1 from produto_skus
      where id = v_sku and produto_id = v_comp.id and user_id = v_uid and not arquivado
    ) then
      raise exception 'Variação do kit arquivada ou não encontrada' using errcode = 'no_data_found';
    end if;
    if v_sku is null and v_comp.controla_estoque and exists (
      select 1 from produto_skus
      where produto_id = v_comp.id and user_id = v_uid and variacao is not null and not arquivado
    ) then
      raise exception 'Escolha a variação de %', v_comp.nome using errcode = 'check_violation';
    end if;
    insert into produto_componentes (user_id, kit_id, componente_id, sku_id, quantidade)
    values (v_uid, p_kit_id, v_comp.id, v_sku, v_qtd);
  end loop;

  if jsonb_array_length(p_componentes) > 0 then
    update produtos set controla_estoque = false where id = p_kit_id and user_id = v_uid;
  end if;
end;
$$;

revoke all on function public.salvar_kit(uuid, jsonb) from public, anon;
grant execute on function public.salvar_kit(uuid, jsonb) to authenticated;

-- ── registrar_venda ────────────────────────────────────────────────────────
-- Igual a 20261023260000, com: FOR SHARE no produto (1º passe), custo pela
-- custo_do_item() nos dois passes, componente/variação arquivados e teto da
-- quantidade com mensagem. Venda sem kit continua idêntica.
create or replace function public.registrar_venda(
  p_id uuid,
  p_data date,
  p_canal text,
  p_itens jsonb,
  p_cliente_id uuid default null,
  p_cliente_nome text default null,
  p_desconto numeric default 0,
  p_frete numeric default 0,
  p_taxa_canal numeric default 0,
  p_recebida boolean default true,
  p_observacao text default null,
  p_marcar_cliente boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_produto public.produtos;
  v_sku_id uuid;
  v_sku_variacao text;
  v_qtd integer;
  v_preco numeric;
  v_desconto numeric := round(coalesce(p_desconto, 0), 2);
  v_frete numeric := round(coalesce(p_frete, 0), 2);
  v_taxa numeric := round(coalesce(p_taxa_canal, 0), 2);
  v_subtotal numeric := 0;
  v_custo numeric := 0;
  v_custo_conhecido boolean := true;
  v_so_servico boolean := true;
  v_total numeric;
  v_categoria text;
  v_lancamento_id uuid;
  v_eh_kit boolean;
  v_custo_item numeric;
  v_comp record;
  v_comp_sku uuid;
  v_baixa integer;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  if p_id is null then
    raise exception 'Venda sem id' using errcode = 'check_violation';
  end if;
  if exists (select 1 from vendas where id = p_id and user_id = v_uid) then
    return p_id;
  end if;
  if p_canal is null or p_canal not in (
    'instagram', 'whatsapp', 'presencial', 'encomenda', 'site', 'outro'
  ) then
    raise exception 'Canal inválido' using errcode = 'check_violation';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Venda sem itens' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_itens) > 100 then
    raise exception 'Itens demais numa venda só' using errcode = 'check_violation';
  end if;
  if p_marcar_cliente and p_cliente_id is null then
    raise exception 'Cliente obrigatória' using errcode = 'check_violation';
  end if;
  if p_cliente_id is not null then
    perform 1 from clientes where id = p_cliente_id and user_id = v_uid for update;
    if not found then
      raise exception 'Cliente não encontrada' using errcode = 'no_data_found';
    end if;
    if p_marcar_cliente and exists (
      select 1 from clientes where id = p_cliente_id and venda_registrada
    ) then
      raise exception 'Venda já registrada para esta cliente' using errcode = 'unique_violation';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item ->> 'quantidade')::integer;
    v_preco := round((v_item ->> 'preco_unitario')::numeric, 2);
    if v_qtd is null or v_qtd <= 0 or v_qtd > 100000 or v_preco is null or v_preco < 0 then
      raise exception 'Item com quantidade ou preço inválido' using errcode = 'check_violation';
    end if;
    -- FOR SHARE: salvar_kit (FOR UPDATE no produto) espera a venda terminar.
    select * into v_produto from produtos
      where id = (v_item ->> 'produto_id')::uuid and user_id = v_uid
      for share;
    if not found then
      raise exception 'Produto não encontrado' using errcode = 'no_data_found';
    end if;
    if v_item ->> 'sku_id' is not null and not exists (
      select 1 from produto_skus
      where id = (v_item ->> 'sku_id')::uuid and produto_id = v_produto.id
        and user_id = v_uid and not arquivado
    ) then
      raise exception 'Variação não encontrada' using errcode = 'no_data_found';
    end if;
    v_subtotal := v_subtotal + v_qtd * v_preco;
    v_custo_item := custo_do_item(v_produto, v_uid);
    if v_custo_item is null then
      v_custo_conhecido := false;
    else
      v_custo := v_custo + v_qtd * v_custo_item;
    end if;
    if v_produto.tipo <> 'servico' then
      v_so_servico := false;
    end if;
  end loop;

  if v_desconto < 0 or v_frete < 0 or v_taxa < 0 then
    raise exception 'Valor negativo' using errcode = 'check_violation';
  end if;
  if v_desconto > v_subtotal then
    raise exception 'Desconto maior que a venda' using errcode = 'check_violation';
  end if;
  v_total := v_subtotal - v_desconto + v_frete;
  v_categoria := case when v_so_servico then 'Prestação de serviço' else 'Venda de produto' end;

  insert into vendas (
    id, user_id, canal, data, status, cliente_id, cliente_nome, marcou_cliente, categoria,
    subtotal, desconto, frete, taxa_canal, total, custo_total, observacao
  ) values (
    p_id, v_uid, p_canal, p_data, case when p_recebida then 'recebida' else 'a_receber' end,
    p_cliente_id, left(nullif(btrim(p_cliente_nome), ''), 120), coalesce(p_marcar_cliente, false),
    v_categoria, v_subtotal, v_desconto, v_frete, v_taxa, v_total,
    case when v_custo_conhecido then round(v_custo, 2) else null end,
    left(nullif(btrim(p_observacao), ''), 500)
  );

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item ->> 'quantidade')::integer;
    select * into v_produto from produtos
      where id = (v_item ->> 'produto_id')::uuid and user_id = v_uid;
    v_eh_kit := exists (
      select 1 from produto_componentes where kit_id = v_produto.id and user_id = v_uid
    );
    v_custo_item := custo_do_item(v_produto, v_uid);
    v_sku_id := null;
    v_sku_variacao := null;
    if v_item ->> 'sku_id' is not null then
      select id, variacao into v_sku_id, v_sku_variacao from produto_skus
        where id = (v_item ->> 'sku_id')::uuid and user_id = v_uid
        for update;
    elsif v_produto.controla_estoque and not v_eh_kit then
      select id, variacao into v_sku_id, v_sku_variacao from produto_skus
        where produto_id = v_produto.id and user_id = v_uid and variacao is null and not arquivado
        limit 1
        for update;
    end if;
    if v_produto.controla_estoque and not v_eh_kit and v_sku_id is null then
      raise exception 'Escolha a variação de %', v_produto.nome using errcode = 'check_violation';
    end if;

    insert into venda_itens (
      user_id, venda_id, produto_id, sku_id, produto_nome, variacao, quantidade,
      preco_unitario, custo_unitario
    ) values (
      v_uid, p_id, v_produto.id, v_sku_id, v_produto.nome, v_sku_variacao, v_qtd,
      round((v_item ->> 'preco_unitario')::numeric, 2), v_custo_item
    );

    if v_eh_kit then
      for v_comp in
        select c.componente_id, c.sku_id, c.quantidade, p.controla_estoque, p.nome, p.arquivado
        from produto_componentes c
        join produtos p on p.id = c.componente_id
        where c.kit_id = v_produto.id and c.user_id = v_uid
      loop
        if v_comp.arquivado then
          raise exception 'Edite o kit %: o item % foi arquivado', v_produto.nome, v_comp.nome
            using errcode = 'check_violation';
        end if;
        if not v_comp.controla_estoque then
          continue;
        end if;
        v_comp_sku := v_comp.sku_id;
        if v_comp_sku is not null and exists (
          select 1 from produto_skus where id = v_comp_sku and arquivado
        ) then
          raise exception 'Edite o kit %: a variação de % foi tirada', v_produto.nome, v_comp.nome
            using errcode = 'check_violation';
        end if;
        if v_comp_sku is null then
          select id into v_comp_sku from produto_skus
            where produto_id = v_comp.componente_id and user_id = v_uid
              and variacao is null and not arquivado
            limit 1;
        end if;
        if v_comp_sku is null then
          raise exception 'Edite o kit %: escolha a variação de %', v_produto.nome, v_comp.nome
            using errcode = 'check_violation';
        end if;
        v_baixa := v_qtd * v_comp.quantidade;
        if v_baixa > 100000 then
          raise exception 'Quantidade grande demais no kit %', v_produto.nome
            using errcode = 'check_violation';
        end if;
        perform 1 from produto_skus where id = v_comp_sku for update;
        insert into estoque_movimentos (user_id, sku_id, tipo, quantidade, venda_id, motivo)
        values (v_uid, v_comp_sku, 'venda', -v_baixa, p_id, left('kit ' || v_produto.nome, 200));
      end loop;
    elsif v_produto.controla_estoque then
      insert into estoque_movimentos (user_id, sku_id, tipo, quantidade, venda_id)
      values (v_uid, v_sku_id, 'venda', -v_qtd, p_id);
    end if;
  end loop;

  if p_recebida and v_total - v_taxa > 0 then
    insert into lancamentos (user_id, tipo, valor, data, descricao, categoria, id_externo)
    values (
      v_uid, 'entrada', v_total - v_taxa, p_data,
      left(concat_ws(' · ', 'Venda', p_canal, nullif(btrim(p_cliente_nome), '')), 200),
      v_categoria, 'venda:' || p_id
    ) returning id into v_lancamento_id;
    update vendas set lancamento_id = v_lancamento_id where id = p_id;
  end if;

  if p_marcar_cliente then
    update clientes set venda_registrada = true, updated_at = now()
    where id = p_cliente_id and user_id = v_uid;
  end if;

  return p_id;
end;
$$;

-- ── kit não liga estoque próprio ───────────────────────────────────────────
-- Quem conta o estoque do kit são os itens. Gatilho em vez de mexer em
-- salvar_estoque_produto: cobre qualquer caminho que ligue o estoque.
create or replace function public.kit_sem_estoque_proprio()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.controla_estoque and not old.controla_estoque and exists (
    select 1 from produto_componentes where kit_id = new.id
  ) then
    raise exception 'Kit não controla estoque próprio' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists produtos_kit_sem_estoque on public.produtos;
create trigger produtos_kit_sem_estoque
  before update of controla_estoque on public.produtos
  for each row execute function public.kit_sem_estoque_proprio();
