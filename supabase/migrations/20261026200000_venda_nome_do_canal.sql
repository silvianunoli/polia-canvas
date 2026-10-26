-- Nome do canal na descrição do lançamento de venda (VND-40). registrar_venda e
-- receber_venda montavam a descrição com a chave interna do canal: o Financeiro
-- mostrava "Venda · mercado_livre" (achado no teste do Mercado Livre, VND-37).
-- Agora usam canal_venda_nome, com os mesmos nomes de CANAL_LABEL em
-- src/lib/vendas.ts (mudou lá, muda aqui). O resto das duas funções é o que
-- estava no banco. No fim, corrige as descrições já gravadas.

create or replace function public.canal_venda_nome(p_canal text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $fn$
  select case p_canal
    when 'instagram' then 'Instagram'
    when 'whatsapp' then 'WhatsApp'
    when 'presencial' then 'Presencial ou feira'
    when 'encomenda' then 'Encomenda'
    when 'site' then 'Site'
    when 'shopee' then 'Shopee'
    when 'tiktok_shop' then 'TikTok Shop'
    when 'mercado_livre' then 'Mercado Livre'
    when 'outro' then 'Outro'
    else p_canal
  end;
$fn$;

revoke all on function public.canal_venda_nome(text) from public, anon, authenticated;

create or replace function public.registrar_venda(p_id uuid, p_data date, p_canal text, p_itens jsonb, p_cliente_id uuid DEFAULT NULL::uuid, p_cliente_nome text DEFAULT NULL::text, p_desconto numeric DEFAULT 0, p_frete numeric DEFAULT 0, p_taxa_canal numeric DEFAULT 0, p_recebida boolean DEFAULT true, p_observacao text DEFAULT NULL::text, p_marcar_cliente boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      left(concat_ws(' · ', 'Venda', canal_venda_nome(p_canal), nullif(btrim(p_cliente_nome), '')), 200),
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
$function$;

create or replace function public.receber_venda(p_venda_id uuid, p_data date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_venda public.vendas;
  v_lancamento_id uuid;
  v_valor numeric;
begin
  select * into v_venda from vendas
    where id = p_venda_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Venda não encontrada' using errcode = 'no_data_found';
  end if;
  if v_venda.status <> 'a_receber' then
    raise exception 'Venda não está a receber' using errcode = 'check_violation';
  end if;

  v_valor := v_venda.total - v_venda.taxa_canal - coalesce(v_venda.custo_envio, 0);
  if v_valor > 0 then
    insert into lancamentos (user_id, tipo, valor, data, descricao, categoria, id_externo)
    values (
      v_venda.user_id, 'entrada', v_valor, coalesce(p_data, v_venda.data),
      left(concat_ws(' · ', 'Venda', canal_venda_nome(v_venda.canal), v_venda.cliente_nome), 200),
      v_venda.categoria, 'venda:' || p_venda_id
    ) returning id into v_lancamento_id;
  end if;

  update vendas set status = 'recebida', lancamento_id = v_lancamento_id where id = p_venda_id;
  return v_lancamento_id;
end;
$function$;

-- Descrições já gravadas: só as que ainda estão como a função escreveu
-- ("Venda · chave" ou "Venda · chave · cliente"); texto editado à mão fica.
update public.lancamentos l
set descricao = left(
  'Venda · ' || public.canal_venda_nome(v.canal)
    || substr(l.descricao, char_length('Venda · ' || v.canal) + 1),
  200
)
from public.vendas v
where v.lancamento_id = l.id
  and public.canal_venda_nome(v.canal) <> v.canal
  and (l.descricao = 'Venda · ' || v.canal or l.descricao like 'Venda · ' || v.canal || ' · %');
