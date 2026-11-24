-- Cupom de desconto na Vitrine online (24/11/2026, ONE-239, desenho aprovado
-- pela Sil). A dona cria o cupom na tela da Vitrine; a cliente digita no
-- carrinho; o pedido grava o desconto e o código. O desconto é sempre
-- calculado aqui (registrar_pedido_loja), nunca pelo que o navegador manda.
-- A conta é a mesma de descontoDoCupom (src/lib/lojaVitrine.ts).

-- ── 1. cupons ─────────────────────────────────────────────────────────────
create table if not exists public.catalogo_cupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  codigo text not null check (codigo ~ '^[A-Z0-9_-]{3,30}$'),
  tipo text not null check (tipo in ('percentual', 'valor')),
  valor numeric(12, 2) not null check (valor > 0),
  valido_ate date,
  limite_usos integer check (limite_usos is null or limite_usos between 1 and 100000),
  usos integer not null default 0 check (usos >= 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, codigo),
  check (tipo <> 'percentual' or valor < 100)
);
create index if not exists catalogo_cupons_por_dona on public.catalogo_cupons (user_id, created_at desc);

alter table public.catalogo_cupons enable row level security;
revoke all on public.catalogo_cupons from public, anon, authenticated;
-- A dona não mexe no contador de usos: só o pedido da loja soma.
grant select, delete on public.catalogo_cupons to authenticated;
grant insert (user_id, codigo, tipo, valor, valido_ate, limite_usos) on public.catalogo_cupons to authenticated;
grant update (ativo, valido_ate, limite_usos) on public.catalogo_cupons to authenticated;

drop policy if exists "Cupons: dona lê" on public.catalogo_cupons;
create policy "Cupons: dona lê" on public.catalogo_cupons for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Cupons: dona cria" on public.catalogo_cupons;
create policy "Cupons: dona cria" on public.catalogo_cupons for insert to authenticated
  with check (
    user_id = auth.uid()
    and (select count(*) from public.catalogo_cupons c where c.user_id = auth.uid()) < 100
  );
drop policy if exists "Cupons: dona edita" on public.catalogo_cupons;
create policy "Cupons: dona edita" on public.catalogo_cupons for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Cupom usado não se apaga: o pedido antigo continua mostrando o código.
drop policy if exists "Cupons: dona apaga sem uso" on public.catalogo_cupons;
create policy "Cupons: dona apaga sem uso" on public.catalogo_cupons for delete to authenticated
  using (user_id = auth.uid() and usos = 0);

-- ── 2. o pedido guarda o código ───────────────────────────────────────────
alter table public.vendas
  add column if not exists cupom_codigo text check (cupom_codigo is null or char_length(cupom_codigo) <= 30);

-- ── 3. a loja confere o cupom antes de mandar (só leitura) ───────────────
create or replace function public.cupom_da_loja(p_slug text, p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid;
  v_plano text;
  v_cupom public.catalogo_cupons;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select c.user_id, p.plano into v_uid, v_plano
    from catalogos c
    join profiles p on p.id = c.user_id
   where c.slug = lower(btrim(p_slug)) and c.ativo;
  if v_uid is null or coalesce(v_plano, '') not in ('projete', 'beta', 'controle') then
    return null;
  end if;
  select * into v_cupom from catalogo_cupons
   where user_id = v_uid and codigo = upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
  if not found or not v_cupom.ativo
     or (v_cupom.valido_ate is not null and v_cupom.valido_ate < v_hoje)
     or (v_cupom.limite_usos is not null and v_cupom.usos >= v_cupom.limite_usos) then
    return null;
  end if;
  return jsonb_build_object('codigo', v_cupom.codigo, 'tipo', v_cupom.tipo, 'valor', v_cupom.valor);
end;
$function$;
revoke all on function public.cupom_da_loja(text, text) from public, anon, authenticated;
grant execute on function public.cupom_da_loja(text, text) to service_role;

-- ── 4. o pedido da loja aplica o cupom ────────────────────────────────────
drop function if exists public.registrar_pedido_loja(text, text, jsonb, text, text, text, text);
create function public.registrar_pedido_loja(
  p_slug text,
  p_id_externo text,
  p_itens jsonb,
  p_cliente_nome text,
  p_whatsapp text,
  p_observacao text default null,
  p_ip_hash text default null,
  p_cupom text default null
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
  v_codigo text := upper(regexp_replace(coalesce(p_cupom, ''), '\s', '', 'g'));
  v_cupom public.catalogo_cupons;
  v_desconto numeric := 0;
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

  -- Cupom (ONE-239): conferido de novo aqui, com a linha travada, antes de
  -- gravar qualquer coisa. Sem cupom válido, nada entra e a loja avisa.
  if v_codigo <> '' then
    select * into v_cupom from catalogo_cupons
     where user_id = v_uid and codigo = v_codigo
     for update;
    if not found or not v_cupom.ativo
       or (v_cupom.valido_ate is not null and v_cupom.valido_ate < v_hoje)
       or (v_cupom.limite_usos is not null and v_cupom.usos >= v_cupom.limite_usos) then
      return 'cupom';
    end if;
    v_desconto := least(
      case when v_cupom.tipo = 'percentual' then round(v_subtotal * v_cupom.valor / 100, 2)
           else round(v_cupom.valor, 2) end,
      v_subtotal);
  end if;

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
      subtotal, desconto, frete, taxa_canal, total, observacao, andamento, entrega_em, cupom_codigo
    ) values (
      v_venda_id, v_uid, 'catalogo', p_id_externo, v_hoje, 'a_receber', 'Venda de produto',
      v_cliente_id, v_nome, v_subtotal, v_desconto, 0, 0, v_subtotal - v_desconto,
      left(nullif(btrim(p_observacao), ''), 500), 'a_fazer', v_entrega, v_cupom.codigo
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

  if v_cupom.id is not null then
    update catalogo_cupons set usos = usos + 1 where id = v_cupom.id;
  end if;

  insert into catalogo_envios (user_id, venda_id, ip_hash) values (v_uid, v_venda_id, v_ip);
  return 'ok';
end;
$function$;

revoke all on function public.registrar_pedido_loja(text, text, jsonb, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.registrar_pedido_loja(text, text, jsonb, text, text, text, text, text)
  to service_role;
