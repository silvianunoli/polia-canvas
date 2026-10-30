-- Catálogo próprio no Pro (ONE-148, fases 2 e 3, 29/10/2026). A dona monta a
-- loja dentro da Pólia One: escolhe quais Produtos aparecem, sobe até 4 fotos
-- por produto, define a cara da loja e as regras de venda. A loja pública mora
-- em one.usepolia.com.br/loja/<endereço> e o pedido entra em Pedidos pela
-- registrar_pedido_loja, com o PREÇO DO CADASTRO (o navegador só manda produto,
-- variação e quantidade). Domínio próprio continua sendo serviço da Pólia Lab
-- (registrar_pedido_catalogo, migration 20261029200000).
--
-- Reaproveita: vendas/venda_itens (pedido com andamento), clientes (pelo
-- WhatsApp), custo_do_item e estoque_movimentos (como a registrar_venda_canal),
-- catalogo_envios (limites), a regra de endereço dos links de captura e o
-- molde do bucket marca-logos.

-- ── 1. a loja ──────────────────────────────────────────────────────────────
create table if not exists public.catalogos (
  user_id uuid primary key references auth.users (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  ativo boolean not null default false,
  chamada text check (chamada is null or char_length(chamada) <= 120),
  subchamada text check (subchamada is null or char_length(subchamada) <= 300),
  cor_destaque text check (cor_destaque is null or cor_destaque ~ '^#[0-9A-Fa-f]{6}$'),
  capa_path text check (capa_path is null or (char_length(capa_path) <= 200 and capa_path like user_id::text || '/%')),
  whatsapp text check (whatsapp is null or whatsapp ~ '^55[0-9]{10,11}$'),
  instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  prazo_dias_uteis integer not null default 7 check (prazo_dias_uteis between 1 and 60),
  sinal_percentual integer not null default 0 check (sinal_percentual between 0 and 100),
  entrega_texto text check (entrega_texto is null or char_length(entrega_texto) <= 200),
  pede_endereco boolean not null default true,
  aviso text check (aviso is null or char_length(aviso) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists catalogos_slug_uniq on public.catalogos (slug);

-- Endereço é da primeira conta que usou, pra sempre (mesma regra dos links de captura).
create table if not exists public.catalogos_slugs (
  slug text primary key,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.catalogos_slugs enable row level security;
revoke all on public.catalogos_slugs from public, anon, authenticated;

create or replace function public.catalogos_reserva_slug()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dono uuid;
begin
  new.slug := lower(new.slug);
  if new.slug in (
    'polia', 'usepolia', 'polia-one', 'one', 'lab', 'admin', 'office', 'suporte', 'ajuda',
    'sil', 'oficial', 'teste', 'comunidade', 'blog', 'api', 'www', 'loja', 'catalogo'
  ) then
    raise exception 'Endereço reservado' using errcode = 'unique_violation';
  end if;
  select user_id into v_dono from catalogos_slugs where slug = new.slug;
  if v_dono is not null and v_dono <> new.user_id then
    raise exception 'Endereço já usado por outra marca' using errcode = 'unique_violation';
  end if;
  if v_dono is null then
    insert into catalogos_slugs (slug, user_id) values (new.slug, new.user_id);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists catalogos_slug on public.catalogos;
create trigger catalogos_slug before insert or update on public.catalogos
  for each row execute function public.catalogos_reserva_slug();

alter table public.catalogos enable row level security;
revoke all on public.catalogos from public, anon;
grant select, insert, update, delete on public.catalogos to authenticated;
drop policy if exists "Catálogo: dona lê" on public.catalogos;
create policy "Catálogo: dona lê" on public.catalogos for select to authenticated using (user_id = auth.uid());
drop policy if exists "Catálogo: dona cria" on public.catalogos;
create policy "Catálogo: dona cria" on public.catalogos for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Catálogo: dona edita" on public.catalogos;
create policy "Catálogo: dona edita" on public.catalogos for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Catálogo: dona apaga" on public.catalogos;
create policy "Catálogo: dona apaga" on public.catalogos for delete to authenticated using (user_id = auth.uid());

-- ── 2. produtos na loja ────────────────────────────────────────────────────
alter table public.produtos
  add column if not exists no_catalogo boolean not null default false,
  add column if not exists catalogo_ordem integer check (catalogo_ordem is null or catalogo_ordem between 0 and 10000);

-- ── 3. fotos dos produtos (até 4) ──────────────────────────────────────────
create table if not exists public.produto_fotos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete cascade,
  path text not null check (char_length(path) <= 200 and path like user_id::text || '/%'),
  ordem smallint not null check (ordem between 0 and 3),
  created_at timestamptz not null default now(),
  unique (produto_id, ordem)
);
create index if not exists produto_fotos_por_produto on public.produto_fotos (produto_id, ordem);
alter table public.produto_fotos enable row level security;
revoke all on public.produto_fotos from public, anon;
grant select, insert, update, delete on public.produto_fotos to authenticated;
drop policy if exists "Fotos: dona lê" on public.produto_fotos;
create policy "Fotos: dona lê" on public.produto_fotos for select to authenticated using (user_id = auth.uid());
drop policy if exists "Fotos: dona cria no próprio produto" on public.produto_fotos;
create policy "Fotos: dona cria no próprio produto" on public.produto_fotos for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.produtos p where p.id = produto_id and p.user_id = auth.uid()));
drop policy if exists "Fotos: dona reordena" on public.produto_fotos;
create policy "Fotos: dona reordena" on public.produto_fotos for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Fotos: dona apaga" on public.produto_fotos;
create policy "Fotos: dona apaga" on public.produto_fotos for delete to authenticated using (user_id = auth.uid());

-- Público pra leitura (a foto aparece na loja sem login). SVG fora, como no logo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos-fotos', 'produtos-fotos', true, 3145728, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Fotos de produto: dona lê a pasta" on storage.objects;
create policy "Fotos de produto: dona lê a pasta" on storage.objects for select to authenticated
  using (bucket_id = 'produtos-fotos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Fotos de produto: dona sobe na pasta" on storage.objects;
create policy "Fotos de produto: dona sobe na pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'produtos-fotos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Fotos de produto: dona apaga da pasta" on storage.objects;
create policy "Fotos de produto: dona apaga da pasta" on storage.objects for delete to authenticated
  using (bucket_id = 'produtos-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Capa da loja: no mesmo bucket do logo (marca-logos), na pasta da dona.

-- ── 4. registrar_pedido_loja ───────────────────────────────────────────────
-- Devolve 'ok', 'repetido', 'indisponivel' (loja desligada, inexistente ou
-- conta fora do Pro) ou 'limite'.
-- p_itens: [{ "produto_id": uuid, "sku_id": uuid|null, "quantidade": int }]
-- Preço, nome e variação saem do cadastro. Produto fora da loja é recusado.
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
as $fn$
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
  v_subtotal numeric := 0;
  v_custo numeric := 0;
  v_custo_conhecido boolean := true;
  v_custo_item numeric;
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
  -- Só no Pro (decisão da Sil, 29/10/2026), como temProjete em src/lib/planos.ts.
  if v_uid is null or coalesce(v_plano, '') not in ('projete', 'beta') then
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

  -- Primeiro passe: confere cada item contra o cadastro e soma pelo preço de lá.
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
    if v_item ->> 'sku_id' is not null then
      perform 1 from produto_skus
       where id = (v_item ->> 'sku_id')::uuid and produto_id = v_produto.id and user_id = v_uid and not arquivado;
      if not found then
        raise exception 'Variação fora da loja' using errcode = 'check_violation';
      end if;
    end if;
    v_subtotal := v_subtotal + v_qtd * round(v_produto.preco_venda, 2);
  end loop;

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

  -- Segundo passe: itens com custo e baixa de estoque, como na venda de canal.
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item ->> 'quantidade')::integer;
    select * into v_produto from produtos where id = (v_item ->> 'produto_id')::uuid and user_id = v_uid;
    v_sku := null;
    if v_item ->> 'sku_id' is not null then
      select * into v_sku from produto_skus where id = (v_item ->> 'sku_id')::uuid and user_id = v_uid for update;
    else
      select * into v_sku from produto_skus
       where produto_id = v_produto.id and user_id = v_uid and variacao is null and not arquivado
       limit 1 for update;
    end if;
    v_custo_item := custo_do_item(v_produto, v_uid);
    insert into venda_itens (
      user_id, venda_id, produto_id, sku_id, produto_nome, variacao, quantidade, preco_unitario, custo_unitario
    ) values (
      v_uid, v_venda_id, v_produto.id, v_sku.id, v_produto.nome, v_sku.variacao, v_qtd,
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
$fn$;

revoke all on function public.registrar_pedido_loja(text, text, jsonb, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.registrar_pedido_loja(text, text, jsonb, text, text, text, text)
  to service_role;
