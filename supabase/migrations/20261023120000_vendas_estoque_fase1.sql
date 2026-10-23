-- VND-03 (23/10/2026): Fase 1 do módulo Vendas. Plano completo em
-- docs/plano-modulo-vendas-canais.md.
--
-- Quatro tabelas novas e uma coluna em produtos:
--   produtos.controla_estoque  liga o estoque por produto. Nasce false: produto
--                              antigo não aparece com "0 no estoque" do nada.
--   produto_skus               variação vendável (cor, tamanho). variacao null
--                              é a variação padrão de produto sem variação.
--   estoque_movimentos         livro de entradas e saídas. O saldo é a soma
--                              (view estoque_saldos), nunca um número que alguém
--                              sobrescreve. Erro se corrige com outro movimento.
--   vendas / venda_itens       pedido de qualquer canal. canal + id_externo já
--                              preparam a Shopee e o TikTok Shop (fase 3).
--
-- Toda escrita passa pelas funções abaixo (SECURITY DEFINER, com auth.uid()
-- filtrado em cada leitura e escrita). Pela API a usuária só LÊ estas tabelas,
-- mais a observação da venda. Motivo (revisão de segurança de 23/10): com
-- UPDATE livre dava pra voltar uma venda cancelada pra "a receber" e receber de
-- novo sem baixar o estoque, e um DELETE em variação apagava o histórico.
--
-- Wireframes aprovados em 23/10/2026 (VND-12). Aplicar no SQL Editor do
-- Supabase ANTES do deploy das telas de Vendas e Estoque.

-- ── produtos ───────────────────────────────────────────────────────────────
alter table public.produtos
  add column if not exists controla_estoque boolean not null default false;

-- ── produto_skus ───────────────────────────────────────────────────────────
create table if not exists public.produto_skus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete cascade,
  variacao text check (variacao is null or char_length(variacao) between 1 and 80),
  sku text check (sku is null or char_length(sku) between 1 and 60),
  estoque_minimo integer not null default 0 check (estoque_minimo >= 0),
  arquivado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uma variação com o mesmo nome por produto; a padrão (null) conta como ''.
create unique index if not exists produto_skus_produto_variacao_uniq
  on public.produto_skus (produto_id, coalesce(lower(variacao), ''))
  where not arquivado;
-- Código repetido na mesma conta confundiria o vínculo com o anúncio (fase 3).
create unique index if not exists produto_skus_user_sku_uniq
  on public.produto_skus (user_id, lower(sku))
  where sku is not null and not arquivado;
create index if not exists produto_skus_produto_idx on public.produto_skus (produto_id);

-- ── vendas ─────────────────────────────────────────────────────────────────
create table if not exists public.vendas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  canal text not null check (canal in (
    'instagram', 'whatsapp', 'presencial', 'encomenda', 'site', 'shopee', 'tiktok_shop', 'outro'
  )),
  id_externo text check (id_externo is null or char_length(id_externo) <= 200),
  data date not null,
  status text not null default 'recebida' check (status in ('recebida', 'a_receber', 'cancelada')),
  cliente_id uuid references public.clientes (id) on delete set null,
  cliente_nome text check (cliente_nome is null or char_length(cliente_nome) <= 120),
  -- A venda veio do "Registrar venda" de Clientes e marcou a cliente; cancelar desmarca.
  marcou_cliente boolean not null default false,
  -- Categoria do lançamento, decidida no registro (receber depois não recalcula).
  categoria text not null check (categoria in ('Venda de produto', 'Prestação de serviço')),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  desconto numeric(12, 2) not null default 0 check (desconto >= 0),
  frete numeric(12, 2) not null default 0 check (frete >= 0),
  taxa_canal numeric(12, 2) not null default 0 check (taxa_canal >= 0),
  -- subtotal - desconto + frete: o que a cliente pagou.
  total numeric(12, 2) not null check (total >= 0),
  -- Soma dos custos dos itens no dia da venda; null se algum item não tem custo.
  custo_total numeric(12, 2) check (custo_total is null or custo_total >= 0),
  observacao text check (observacao is null or char_length(observacao) <= 500),
  lancamento_id uuid references public.lancamentos (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (desconto <= subtotal)
);

create unique index if not exists vendas_user_canal_externo_uniq
  on public.vendas (user_id, canal, id_externo)
  where id_externo is not null;
create index if not exists vendas_user_data_idx on public.vendas (user_id, data desc);

-- ── venda_itens ────────────────────────────────────────────────────────────
create table if not exists public.venda_itens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  venda_id uuid not null references public.vendas (id) on delete cascade,
  -- set null + nome guardado: o ranking continua de pé se o produto sumir.
  produto_id uuid references public.produtos (id) on delete set null,
  sku_id uuid references public.produto_skus (id) on delete set null,
  produto_nome text not null check (char_length(produto_nome) between 1 and 200),
  variacao text,
  quantidade integer not null check (quantidade > 0 and quantidade <= 100000),
  preco_unitario numeric(12, 2) not null check (preco_unitario >= 0),
  -- produtos.preco_custo no dia da venda, o mesmo custo que o card do produto usa.
  custo_unitario numeric(12, 2) check (custo_unitario is null or custo_unitario >= 0),
  created_at timestamptz not null default now()
);

create index if not exists venda_itens_venda_idx on public.venda_itens (venda_id);
create index if not exists venda_itens_user_produto_idx on public.venda_itens (user_id, produto_id);

-- ── estoque_movimentos ─────────────────────────────────────────────────────
create table if not exists public.estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- restrict: variação com histórico só se arquiva, nunca some com o livro.
  sku_id uuid not null references public.produto_skus (id) on delete restrict,
  tipo text not null check (tipo in ('entrada', 'venda', 'devolucao', 'ajuste', 'perda')),
  -- Com sinal: entrada/devolução positivas, venda/perda negativas, ajuste qualquer.
  quantidade integer not null check (quantidade <> 0 and abs(quantidade) <= 100000),
  motivo text check (motivo is null or char_length(motivo) <= 200),
  venda_id uuid references public.vendas (id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (tipo in ('entrada', 'devolucao') and quantidade > 0)
    or (tipo in ('venda', 'perda') and quantidade < 0)
    or tipo = 'ajuste'
  )
);

create index if not exists estoque_movimentos_sku_idx
  on public.estoque_movimentos (sku_id, created_at desc);
create index if not exists estoque_movimentos_venda_idx
  on public.estoque_movimentos (venda_id)
  where venda_id is not null;

-- Saldo por variação. security_invoker: a view respeita a RLS de quem lê.
create or replace view public.estoque_saldos
with (security_invoker = true) as
select
  s.id as sku_id,
  s.user_id,
  s.produto_id,
  s.variacao,
  s.sku,
  s.estoque_minimo,
  coalesce(sum(m.quantidade), 0)::integer as saldo
from public.produto_skus s
left join public.estoque_movimentos m on m.sku_id = s.id
where not s.arquivado
group by s.id;

-- ── updated_at ─────────────────────────────────────────────────────────────
create or replace function public.vendas_tocar_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists produto_skus_updated on public.produto_skus;
create trigger produto_skus_updated before update on public.produto_skus
  for each row execute function public.vendas_tocar_updated_at();
drop trigger if exists vendas_updated on public.vendas;
create trigger vendas_updated before update on public.vendas
  for each row execute function public.vendas_tocar_updated_at();

-- ── RLS: a usuária lê o que é dela; escrita só pelas funções ───────────────
alter table public.produto_skus enable row level security;
alter table public.vendas enable row level security;
alter table public.venda_itens enable row level security;
alter table public.estoque_movimentos enable row level security;

revoke all on public.produto_skus, public.vendas, public.venda_itens, public.estoque_movimentos
  from anon, authenticated;
grant select on public.produto_skus, public.vendas, public.venda_itens, public.estoque_movimentos
  to authenticated;
-- Único campo editável direto: a observação da venda.
grant update (observacao) on public.vendas to authenticated;
grant select on public.estoque_saldos to authenticated;

drop policy if exists "SKU: dona lê" on public.produto_skus;
create policy "SKU: dona lê" on public.produto_skus for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Vendas: dona lê" on public.vendas;
create policy "Vendas: dona lê" on public.vendas for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Vendas: dona edita observação" on public.vendas;
create policy "Vendas: dona edita observação" on public.vendas for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Itens: dona lê" on public.venda_itens;
create policy "Itens: dona lê" on public.venda_itens for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Movimentos: dona lê" on public.estoque_movimentos;
create policy "Movimentos: dona lê" on public.estoque_movimentos for select to authenticated
  using (user_id = auth.uid());

-- ── salvar_estoque_produto ─────────────────────────────────────────────────
-- Liga/desliga o estoque e grava as variações numa transação só (antes eram
-- vários passos no navegador; uma falha no meio deixava o produto com estoque
-- ligado e sem variação, e a venda não baixava nada).
-- p_variacoes: [{ "id": uuid|null, "variacao": text|null, "sku": text|null,
--                 "minimo": int, "inicial": int }]
-- Sem variação nomeada, mande um item só com "variacao": null (a padrão).
-- Variação que sai da lista é arquivada; a padrão só some quando passa a ter
-- variação e está zerada.
create or replace function public.salvar_estoque_produto(
  p_produto_id uuid,
  p_controla boolean,
  p_variacoes jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_id uuid;
  v_nomeadas boolean;
  v_inicial integer;
  v_minimo integer;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  perform 1 from produtos where id = p_produto_id and user_id = v_uid for update;
  if not found then
    raise exception 'Produto não encontrado' using errcode = 'no_data_found';
  end if;

  update produtos set controla_estoque = coalesce(p_controla, false)
  where id = p_produto_id and user_id = v_uid;
  if not coalesce(p_controla, false) then
    return;
  end if;

  if p_variacoes is null or jsonb_typeof(p_variacoes) <> 'array'
     or jsonb_array_length(p_variacoes) = 0 or jsonb_array_length(p_variacoes) > 200 then
    raise exception 'Variações inválidas' using errcode = 'check_violation';
  end if;
  select bool_or(nullif(btrim(e ->> 'variacao'), '') is not null)
    into v_nomeadas from jsonb_array_elements(p_variacoes) e;

  -- Arquiva o que saiu da lista (antes de inserir, pra liberar nome e código).
  update produto_skus s set arquivado = true
  where s.produto_id = p_produto_id and s.user_id = v_uid and not s.arquivado
    and not exists (
      select 1 from jsonb_array_elements(p_variacoes) e
      where nullif(e ->> 'id', '')::uuid = s.id
    )
    and (
      s.variacao is not null
      or (v_nomeadas and coalesce(
        (select sum(m.quantidade) from estoque_movimentos m where m.sku_id = s.id), 0) = 0)
    );

  for v_item in select * from jsonb_array_elements(p_variacoes) loop
    v_minimo := greatest(coalesce((v_item ->> 'minimo')::integer, 0), 0);
    v_inicial := greatest(coalesce((v_item ->> 'inicial')::integer, 0), 0);
    v_id := nullif(v_item ->> 'id', '')::uuid;

    if v_id is not null then
      update produto_skus set
        variacao = nullif(btrim(v_item ->> 'variacao'), ''),
        sku = nullif(btrim(v_item ->> 'sku'), ''),
        estoque_minimo = v_minimo
      where id = v_id and produto_id = p_produto_id and user_id = v_uid and not arquivado;
      if not found then
        raise exception 'Variação não encontrada' using errcode = 'no_data_found';
      end if;
    else
      insert into produto_skus (user_id, produto_id, variacao, sku, estoque_minimo)
      values (
        v_uid, p_produto_id, nullif(btrim(v_item ->> 'variacao'), ''),
        nullif(btrim(v_item ->> 'sku'), ''), v_minimo
      ) returning id into v_id;
      if v_inicial > 0 then
        insert into estoque_movimentos (user_id, sku_id, tipo, quantidade, motivo)
        values (v_uid, v_id, 'entrada', v_inicial, 'estoque inicial');
      end if;
    end if;
  end loop;
end;
$$;

-- ── movimentar_estoque ─────────────────────────────────────────────────────
-- Entrada, perda ou contagem feita à mão. Na contagem, p_quantidade é o que
-- TEM na prateleira e a diferença é calculada aqui, com a variação travada:
-- calculada no navegador, uma venda no meio fazia o saldo final errar.
-- Devolve o saldo novo.
create or replace function public.movimentar_estoque(
  p_sku_id uuid,
  p_tipo text,
  p_quantidade integer,
  p_motivo text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_saldo integer;
  v_delta integer;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  if p_tipo not in ('entrada', 'perda', 'ajuste') or p_quantidade is null or p_quantidade < 0 then
    raise exception 'Movimento inválido' using errcode = 'check_violation';
  end if;
  perform 1 from produto_skus
    where id = p_sku_id and user_id = v_uid and not arquivado for update;
  if not found then
    raise exception 'Variação não encontrada' using errcode = 'no_data_found';
  end if;
  select coalesce(sum(quantidade), 0) into v_saldo from estoque_movimentos where sku_id = p_sku_id;

  v_delta := case p_tipo
    when 'entrada' then p_quantidade
    when 'perda' then -p_quantidade
    else p_quantidade - v_saldo
  end;
  if v_delta <> 0 then
    insert into estoque_movimentos (user_id, sku_id, tipo, quantidade, motivo)
    values (v_uid, p_sku_id, p_tipo, v_delta, left(nullif(btrim(p_motivo), ''), 200));
  end if;
  return v_saldo + v_delta;
end;
$$;

-- ── registrar_venda ────────────────────────────────────────────────────────
-- p_id: gerado pela tela quando o modal abre. Se a resposta se perder e ela
-- tentar de novo, a venda que já entrou volta, sem duplicar venda nem lançamento.
-- p_itens: [{ "produto_id": uuid, "sku_id": uuid|null, "quantidade": int,
--             "preco_unitario": number }]
-- Estoque pode ficar negativo de propósito: barrar uma venda que aconteceu é
-- pior do que mostrar "-1 no estoque" (a tela avisa antes de registrar).
-- Lançamento no Financeiro só quando recebida, pelo valor que entrou na conta
-- (total - taxa do canal), com id_externo 'venda:<id>' pra nunca duplicar.
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
  -- Vindo do "Registrar venda" de Clientes: marca a cliente na mesma transação.
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
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  if p_id is null then
    raise exception 'Venda sem id' using errcode = 'check_violation';
  end if;
  -- Repetição do mesmo envio: devolve a venda que já existe.
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
    -- Trava a cliente: dois cliques simultâneos não marcam e registram duas vezes.
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

  -- Primeiro passe: valida tudo e soma, antes de gravar qualquer linha.
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item ->> 'quantidade')::integer;
    v_preco := round((v_item ->> 'preco_unitario')::numeric, 2);
    if v_qtd is null or v_qtd <= 0 or v_qtd > 100000 or v_preco is null or v_preco < 0 then
      raise exception 'Item com quantidade ou preço inválido' using errcode = 'check_violation';
    end if;
    select * into v_produto from produtos
      where id = (v_item ->> 'produto_id')::uuid and user_id = v_uid;
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
    if v_produto.preco_custo is null then
      v_custo_conhecido := false;
    else
      v_custo := v_custo + v_qtd * v_produto.preco_custo;
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

  -- Segundo passe: itens e baixa no estoque.
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item ->> 'quantidade')::integer;
    select * into v_produto from produtos
      where id = (v_item ->> 'produto_id')::uuid and user_id = v_uid;
    v_sku_id := null;
    v_sku_variacao := null;
    if v_item ->> 'sku_id' is not null then
      select id, variacao into v_sku_id, v_sku_variacao from produto_skus
        where id = (v_item ->> 'sku_id')::uuid and user_id = v_uid
        for update;
    elsif v_produto.controla_estoque then
      -- Produto com estoque e sem variação escolhida: usa a variação padrão.
      select id, variacao into v_sku_id, v_sku_variacao from produto_skus
        where produto_id = v_produto.id and user_id = v_uid and variacao is null and not arquivado
        limit 1
        for update;
    end if;
    -- Estoque ligado e nenhuma variação: avisar em vez de não baixar calado.
    if v_produto.controla_estoque and v_sku_id is null then
      raise exception 'Escolha a variação de %', v_produto.nome using errcode = 'check_violation';
    end if;

    insert into venda_itens (
      user_id, venda_id, produto_id, sku_id, produto_nome, variacao, quantidade,
      preco_unitario, custo_unitario
    ) values (
      v_uid, p_id, v_produto.id, v_sku_id, v_produto.nome, v_sku_variacao, v_qtd,
      round((v_item ->> 'preco_unitario')::numeric, 2), v_produto.preco_custo
    );

    if v_produto.controla_estoque then
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

-- ── receber_venda ──────────────────────────────────────────────────────────
create or replace function public.receber_venda(p_venda_id uuid, p_data date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venda public.vendas;
  v_lancamento_id uuid;
begin
  select * into v_venda from vendas
    where id = p_venda_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Venda não encontrada' using errcode = 'no_data_found';
  end if;
  if v_venda.status <> 'a_receber' then
    raise exception 'Venda não está a receber' using errcode = 'check_violation';
  end if;

  if v_venda.total - v_venda.taxa_canal > 0 then
    insert into lancamentos (user_id, tipo, valor, data, descricao, categoria, id_externo)
    values (
      v_venda.user_id, 'entrada', v_venda.total - v_venda.taxa_canal, coalesce(p_data, v_venda.data),
      left(concat_ws(' · ', 'Venda', v_venda.canal, v_venda.cliente_nome), 200),
      v_venda.categoria, 'venda:' || p_venda_id
    ) returning id into v_lancamento_id;
  end if;

  update vendas set status = 'recebida', lancamento_id = v_lancamento_id where id = p_venda_id;
  return v_lancamento_id;
end;
$$;

-- ── cancelar_venda ─────────────────────────────────────────────────────────
-- Devolve ao estoque o que saiu, apaga o lançamento que a própria venda criou
-- e, se a venda veio de Clientes, libera a cliente pra registrar de novo.
create or replace function public.cancelar_venda(p_venda_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venda public.vendas;
begin
  select * into v_venda from vendas
    where id = p_venda_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Venda não encontrada' using errcode = 'no_data_found';
  end if;
  if v_venda.status = 'cancelada' then
    return;
  end if;

  insert into estoque_movimentos (user_id, sku_id, tipo, quantidade, venda_id, motivo)
  select v_venda.user_id, m.sku_id, 'devolucao', -m.quantidade, p_venda_id, 'venda cancelada'
  from estoque_movimentos m
  where m.venda_id = p_venda_id and m.tipo = 'venda' and m.user_id = v_venda.user_id;

  if v_venda.lancamento_id is not null then
    delete from lancamentos where id = v_venda.lancamento_id and user_id = v_venda.user_id;
  end if;

  if v_venda.marcou_cliente and v_venda.cliente_id is not null then
    update clientes set venda_registrada = false, updated_at = now()
    where id = v_venda.cliente_id and user_id = v_venda.user_id;
  end if;

  update vendas set status = 'cancelada', lancamento_id = null where id = p_venda_id;
end;
$$;

revoke all on function public.salvar_estoque_produto(uuid, boolean, jsonb) from public, anon;
revoke all on function public.movimentar_estoque(uuid, text, integer, text) from public, anon;
revoke all on function public.registrar_venda(uuid, date, text, jsonb, uuid, text, numeric, numeric, numeric, boolean, text, boolean) from public, anon;
revoke all on function public.receber_venda(uuid, date) from public, anon;
revoke all on function public.cancelar_venda(uuid) from public, anon;
grant execute on function public.salvar_estoque_produto(uuid, boolean, jsonb) to authenticated;
grant execute on function public.movimentar_estoque(uuid, text, integer, text) to authenticated;
grant execute on function public.registrar_venda(uuid, date, text, jsonb, uuid, text, numeric, numeric, numeric, boolean, text, boolean) to authenticated;
grant execute on function public.receber_venda(uuid, date) to authenticated;
grant execute on function public.cancelar_venda(uuid) to authenticated;
