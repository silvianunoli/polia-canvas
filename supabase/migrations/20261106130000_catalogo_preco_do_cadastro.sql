-- Pedido do catálogo online com o preço do cadastro (ONE-178, 06/11/2026). Até
-- aqui a registrar_pedido_catalogo gravava o preço que vinha do navegador, então
-- dava pra mandar um pedido com qualquer valor. Agora, quando o item traz
-- produto_id, preço e nome saem do cadastro da dona e o produto precisa estar no
-- catálogo dela.
--
-- Primeiro passo de dois: item SEM produto_id ainda é aceito como antes, porque o
-- site da Loveless no ar não manda esse campo. Depois de republicar o site com o
-- modelo novo, uma próxima migration recusa o item sem produto_id.
--
-- Baixa de estoque e custo seguem como estavam. O resto da função é o da
-- 20261029210000_catalogo_so_pro.sql.

create or replace function public.registrar_pedido_catalogo(
  p_dominio text,
  p_id_externo text,
  p_itens jsonb,
  p_cliente_nome text,
  p_whatsapp text,
  p_observacao text default null,
  p_prazo_dias_uteis integer default 7,
  p_ip_hash text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid;
  v_plano text;
  v_nome text := left(btrim(coalesce(p_cliente_nome, '')), 120);
  v_ip text := left(nullif(btrim(p_ip_hash), ''), 128);
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_entrega date;
  v_dias integer := least(greatest(coalesce(p_prazo_dias_uteis, 7), 1), 60);
  v_cliente_id uuid;
  v_venda_id uuid;
  v_item jsonb;
  v_qtd integer;
  v_preco numeric;
  v_subtotal numeric := 0;
  v_produto_id uuid;
  v_produto_nome text;
begin
  if v_nome = '' or p_whatsapp is null or p_whatsapp !~ '^[0-9]{12,13}$'
     or nullif(btrim(p_id_externo), '') is null or char_length(p_id_externo) > 200 then
    raise exception 'Pedido do catálogo inválido' using errcode = 'check_violation';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array'
     or jsonb_array_length(p_itens) = 0 or jsonb_array_length(p_itens) > 50 then
    raise exception 'Pedido sem itens' using errcode = 'check_violation';
  end if;

  select c.user_id, p.plano into v_uid, v_plano
    from canal_conexoes c
    join profiles p on p.id = c.user_id
   where c.canal = 'catalogo' and c.shop_id = lower(btrim(p_dominio)) and c.status = 'conectada';
  -- Só no Pro (decisão da Sil, 29/10/2026): mesma regra de temProjete em src/lib/planos.ts.
  if v_uid is null or coalesce(v_plano, '') not in ('projete', 'beta') then
    return 'indisponivel';
  end if;

  -- Idempotente: a cliente que toca duas vezes em Confirmar não cria dois pedidos.
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
    v_produto_id := (v_item ->> 'produto_id')::uuid;
    if v_produto_id is not null then
      select round(preco_venda, 2) into v_preco from produtos
       where id = v_produto_id and user_id = v_uid and not arquivado and no_catalogo;
      if not found then
        raise exception 'Produto fora do catálogo' using errcode = 'check_violation';
      end if;
    else
      v_preco := round((v_item ->> 'preco_unitario')::numeric, 2);
      if nullif(btrim(v_item ->> 'nome'), '') is null then
        raise exception 'Item sem nome' using errcode = 'check_violation';
      end if;
    end if;
    if v_qtd is null or v_qtd <= 0 or v_qtd > 1000 or v_preco is null or v_preco < 0 or v_preco > 100000 then
      raise exception 'Item com quantidade ou preço inválido' using errcode = 'check_violation';
    end if;
    v_subtotal := v_subtotal + v_qtd * v_preco;
  end loop;

  -- Entrega combinada: hoje + prazo de produção da marca, contado em dias úteis.
  v_entrega := v_hoje;
  while v_dias > 0 loop
    v_entrega := v_entrega + 1;
    if extract(isodow from v_entrega) < 6 then
      v_dias := v_dias - 1;
    end if;
  end loop;

  -- Cliente pelo WhatsApp: acha a ficha que já existe ou cria uma nova, sem mexer
  -- no que a dona já escreveu nela.
  select id into v_cliente_id from clientes where user_id = v_uid and whatsapp = p_whatsapp;
  if v_cliente_id is null then
    insert into clientes (user_id, nome, whatsapp, origem, status_pedido)
    -- "Primeiro contato": o pedido ainda vai ser confirmado com a dona pelo WhatsApp.
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
    v_produto_id := (v_item ->> 'produto_id')::uuid;
    if v_produto_id is not null then
      select nome, round(preco_venda, 2) into v_produto_nome, v_preco from produtos
       where id = v_produto_id and user_id = v_uid;
    else
      v_produto_nome := v_item ->> 'nome';
      v_preco := round((v_item ->> 'preco_unitario')::numeric, 2);
    end if;
    insert into venda_itens (user_id, venda_id, produto_id, sku_id, produto_nome, variacao, quantidade, preco_unitario, custo_unitario)
    values (
      v_uid, v_venda_id, v_produto_id, null,
      left(btrim(v_produto_nome), 200),
      left(nullif(btrim(v_item ->> 'variacao'), ''), 80),
      (v_item ->> 'quantidade')::integer,
      v_preco,
      null
    );
  end loop;

  insert into catalogo_envios (user_id, venda_id, ip_hash) values (v_uid, v_venda_id, v_ip);
  return 'ok';
end;
$fn$;

revoke all on function public.registrar_pedido_catalogo(text, text, jsonb, text, text, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.registrar_pedido_catalogo(text, text, jsonb, text, text, text, integer, text)
  to service_role;
