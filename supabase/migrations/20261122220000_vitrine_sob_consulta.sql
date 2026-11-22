-- Sob consulta na Vitrine online (22/11/2026, Sil: "alguns produtos pode ter nas vitrine
-- preço, cores e tamanho sob consulta"). Três chaves por produto, todas nascem false:
--   * preco_sob_consulta: a vitrine mostra "Preço sob consulta" e um botão pro WhatsApp
--     da loja; o produto não vai pro carrinho e a função recusa se vier;
--   * cor_sob_consulta: sem escolha de cor (a paleta some desse produto) e o item do
--     pedido grava "Cor sob consulta";
--   * tamanho_sob_consulta: aviso na página e "Tamanho sob consulta" no item do pedido.
-- Resto da registrar_pedido_loja igual à de 20261122210000.

alter table public.produtos
  add column if not exists preco_sob_consulta boolean not null default false,
  add column if not exists cor_sob_consulta boolean not null default false,
  add column if not exists tamanho_sob_consulta boolean not null default false;

create or replace function public.registrar_pedido_loja(
  p_slug text,
  p_id_externo text,
  p_itens jsonb,
  p_cliente_nome text,
  p_whatsapp text,
  p_observacao text default null,
  p_ip_hash text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid;
  v_plano text;
  v_prazo integer;
  v_nome text := left(btrim(coalesce(p_cliente_nome, '')), 120);
  v_ip text := left(nullif(btrim(p_ip_hash), ''), 128);
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_entrega date;
  v_cliente_id uuid;
  v_venda_id uuid;
  v_item jsonb;
  v_qtd integer;
  v_produto public.produtos;
  v_sku public.produto_skus;
  v_escolha text;
  v_ids text[];
  v_cor text;
  v_subtotal numeric := 0;
  v_custo numeric := 0;
  v_custo_conhecido boolean := true;
  v_custo_item numeric;
  v_todos_pronta boolean := true;
  v_saldo integer;
begin
  if v_nome = '' or p_whatsapp is null or p_whatsapp !~ '^[0-9]{12,13}$'
     or nullif(btrim(p_id_externo), '') is null or char_length(p_id_externo) > 200 then
    raise exception 'Pedido da loja inválido' using errcode = 'check_violation';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array'
     or jsonb_array_length(p_itens) = 0 or jsonb_array_length(p_itens) > 50 then
    raise exception 'Pedido sem itens' using errcode = 'check_violation';
  end if;

  select c.user_id, p.plano, c.prazo_dias_uteis into v_uid, v_plano, v_prazo
    from catalogos c
    join profiles p on p.id = c.user_id
   where c.slug = lower(btrim(p_slug)) and c.ativo;
  if v_uid is null or coalesce(v_plano, '') not in ('projete', 'beta', 'controle') then
    return 'indisponivel';
  end if;

  if exists (select 1 from vendas where user_id = v_uid and canal = 'catalogo' and id_externo = p_id_externo) then
    return 'repetido';
  end if;
  if (select count(*) from catalogo_envios
       where user_id = v_uid and created_at > now() - interval '1 day') >= 100 then
    return 'limite';
  end if;
  if v_ip is not null and (select count(*) from catalogo_envios
       where ip_hash = v_ip and created_at > now() - interval '1 hour') >= 5 then
    return 'limite';
  end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item ->> 'quantidade')::integer;
    if v_qtd is null or v_qtd <= 0 or v_qtd > 1000 then
      raise exception 'Quantidade inválida' using errcode = 'check_violation';
    end if;
    select * into v_produto from produtos
     where id = (v_item ->> 'produto_id')::uuid and user_id = v_uid and not arquivado and no_catalogo;
    if not found then
      raise exception 'Produto fora da loja' using errcode = 'check_violation';
    end if;
    if v_produto.preco_sob_consulta then
      raise exception 'Produto com preço sob consulta' using errcode = 'check_violation';
    end if;
    v_escolha := v_item ->> 'sku_id';
    if v_produto.usa_paleta and v_produto.cor_sob_consulta then
      -- Cor sob consulta: a cliente não escolhe cor nenhuma.
      if coalesce(v_escolha, 'foto') <> 'foto' then
        raise exception 'Cor fora da loja' using errcode = 'check_violation';
      end if;
    elsif v_produto.usa_paleta then
      -- Cor da paleta: 'foto' (ou nada) é a cor da foto; senão, uma cor da dona.
      -- Uma ou mais cores ("<id>+<id>"), até o máximo do produto, sem repetir.
      if coalesce(v_escolha, 'foto') <> 'foto' then
        v_ids := string_to_array(v_escolha, '+');
        if v_escolha !~ '^[0-9a-fA-F-]{36}(\+[0-9a-fA-F-]{36}){0,2}$'
           or cardinality(v_ids) > v_produto.max_cores
           or cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x)
           or cardinality(v_ids) <> (select count(*) from catalogo_cores
                                      where user_id = v_uid and id::text = any (v_ids)) then
          raise exception 'Cor fora da loja' using errcode = 'check_violation';
        end if;
      end if;
    elsif v_escolha is not null then
      perform 1 from produto_skus
       where id = v_escolha::uuid and produto_id = v_produto.id and user_id = v_uid and not arquivado;
      if not found then
        raise exception 'Variação fora da loja' using errcode = 'check_violation';
      end if;
    end if;
    -- Pronta entrega com estoque ligado: não vende o que não tem.
    if v_produto.pronta_entrega and v_produto.controla_estoque then
      select coalesce(sum(e.saldo), 0) into v_saldo
        from estoque_saldos e
       where e.produto_id = v_produto.id and e.user_id = v_uid
         and case
               when not v_produto.usa_paleta and v_escolha is not null then e.sku_id = v_escolha::uuid
               else e.variacao is null
             end;
      if v_saldo < v_qtd then
        raise exception 'Sem estoque' using errcode = 'check_violation';
      end if;
    end if;
    v_todos_pronta := v_todos_pronta and v_produto.pronta_entrega;
    v_subtotal := v_subtotal + v_qtd * round(v_produto.preco_venda, 2);
  end loop;

  -- Só pronta entrega no pedido: sai sem prazo de produção (entrega hoje no quadro).
  if v_todos_pronta then
    v_prazo := 0;
  end if;

  v_entrega := v_hoje;
  while v_prazo > 0 loop
    v_entrega := v_entrega + 1;
    if extract(isodow from v_entrega) < 6 then
      v_prazo := v_prazo - 1;
    end if;
  end loop;

  select id into v_cliente_id from clientes where user_id = v_uid and whatsapp = p_whatsapp;
  if v_cliente_id is null then
    insert into clientes (user_id, nome, whatsapp, origem, status_pedido)
    values (v_uid, v_nome, p_whatsapp, 'site', 'Primeiro contato')
    on conflict (user_id, whatsapp) where whatsapp is not null do nothing
    returning id into v_cliente_id;
    if v_cliente_id is null then
      select id into v_cliente_id from clientes where user_id = v_uid and whatsapp = p_whatsapp;
    end if;
  end if;

  v_venda_id := gen_random_uuid();
  begin
    insert into vendas (
      id, user_id, canal, id_externo, data, status, categoria, cliente_id, cliente_nome,
      subtotal, desconto, frete, taxa_canal, total, observacao, andamento, entrega_em
    ) values (
      v_venda_id, v_uid, 'catalogo', p_id_externo, v_hoje, 'a_receber', 'Venda de produto',
      v_cliente_id, v_nome, v_subtotal, 0, 0, 0, v_subtotal,
      left(nullif(btrim(p_observacao), ''), 500), 'a_fazer', v_entrega
    );
  exception when unique_violation then
    return 'repetido';
  end;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item ->> 'quantidade')::integer;
    select * into v_produto from produtos where id = (v_item ->> 'produto_id')::uuid and user_id = v_uid;
    v_escolha := v_item ->> 'sku_id';
    v_sku := null;
    v_cor := null;
    if v_produto.usa_paleta then
      if v_produto.cor_sob_consulta then
        v_cor := null;
      elsif coalesce(v_escolha, 'foto') = 'foto' then
        v_cor := 'Cor da foto' || coalesce(' (' || v_produto.cor_da_foto || ')', '');
      else
        -- Na ordem em que a cliente escolheu.
        select case when count(*) = 1 then 'Cor ' else 'Cores ' end
               || string_agg(coalesce(k.codigo || ' ', '') || k.nome, ' + ' order by e.ordem)
          into v_cor
          from unnest(string_to_array(v_escolha, '+')) with ordinality as e(id, ordem)
          join catalogo_cores k on k.id::text = e.id and k.user_id = v_uid;
      end if;
      select * into v_sku from produto_skus
       where produto_id = v_produto.id and user_id = v_uid and variacao is null and not arquivado
       limit 1 for update;
    elsif v_escolha is not null then
      select * into v_sku from produto_skus where id = v_escolha::uuid and user_id = v_uid for update;
    else
      select * into v_sku from produto_skus
       where produto_id = v_produto.id and user_id = v_uid and variacao is null and not arquivado
       limit 1 for update;
    end if;
    v_custo_item := custo_do_item(v_produto, v_uid);
    insert into venda_itens (
      user_id, venda_id, produto_id, sku_id, produto_nome, variacao, quantidade, preco_unitario, custo_unitario
    ) values (
      v_uid, v_venda_id, v_produto.id, v_sku.id, v_produto.nome,
      nullif(concat_ws(' · ',
        coalesce(v_cor, v_sku.variacao),
        case when v_produto.cor_sob_consulta then 'Cor sob consulta' end,
        case when v_produto.tamanho_sob_consulta then 'Tamanho sob consulta' end), ''),
      v_qtd,
      round(v_produto.preco_venda, 2), v_custo_item
    );
    if v_produto.controla_estoque and v_sku.id is not null then
      insert into estoque_movimentos (user_id, sku_id, tipo, quantidade, venda_id)
      values (v_uid, v_sku.id, 'venda', -v_qtd, v_venda_id);
    end if;
    if v_custo_item is null then
      v_custo_conhecido := false;
    else
      v_custo := v_custo + v_qtd * v_custo_item;
    end if;
  end loop;

  update vendas
     set custo_total = case when v_custo_conhecido then round(v_custo, 2) else null end
   where id = v_venda_id;

  insert into catalogo_envios (user_id, venda_id, ip_hash) values (v_uid, v_venda_id, v_ip);
  return 'ok';
end;
$function$;
