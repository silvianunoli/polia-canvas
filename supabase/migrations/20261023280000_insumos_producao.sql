-- ONE-133 (23/10/2026): estoque de insumos e produção. Decisões da Sil no
-- chat: a baixa acontece num botão "Registrar produção" (produzi N peças de um
-- produto: sai o material, entra o produto no estoque), e os insumos são uma
-- lista única com receita por produto (o papel kraft é um só, mesmo que vá em
-- três produtos).
--
--   insumos            material com unidade livre (folhas, m, g) e custo por
--                      unidade opcional.
--   insumo_movimentos  livro de entradas e saídas, como estoque_movimentos: o
--                      saldo é a soma (view insumo_saldos). Aceita fração
--                      (0,5 m de fita).
--   produto_insumos    receita: quanto de cada insumo vai numa peça.
--   producoes          cada produção registrada. O id vem do navegador: repetir
--                      o envio devolve a mesma produção, sem baixar duas vezes.
--
-- Mesmo modelo de segurança do VND-03: a usuária só LÊ as tabelas; toda
-- escrita passa pelas funções abaixo (SECURITY DEFINER, auth.uid() em cada
-- leitura e escrita).

-- ── insumos ────────────────────────────────────────────────────────────────
create table if not exists public.insumos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  unidade text not null check (char_length(unidade) between 1 and 20),
  custo_unitario numeric(12, 4) check (custo_unitario is null or custo_unitario >= 0),
  estoque_minimo numeric(12, 3) not null default 0 check (estoque_minimo >= 0),
  arquivado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists insumos_user_nome_uniq
  on public.insumos (user_id, lower(nome))
  where not arquivado;

drop trigger if exists insumos_updated on public.insumos;
create trigger insumos_updated before update on public.insumos
  for each row execute function public.vendas_tocar_updated_at();

-- ── producoes ──────────────────────────────────────────────────────────────
create table if not exists public.producoes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- set null + nome guardado: a lista de produções continua de pé.
  produto_id uuid references public.produtos (id) on delete set null,
  produto_nome text not null check (char_length(produto_nome) between 1 and 200),
  sku_id uuid references public.produto_skus (id) on delete set null,
  variacao text,
  quantidade integer not null check (quantidade between 1 and 100000),
  data date not null,
  observacao text check (observacao is null or char_length(observacao) <= 500),
  desfeita_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists producoes_user_idx on public.producoes (user_id, created_at desc);

-- ── insumo_movimentos ──────────────────────────────────────────────────────
create table if not exists public.insumo_movimentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- restrict: insumo com histórico só se arquiva.
  insumo_id uuid not null references public.insumos (id) on delete restrict,
  tipo text not null check (tipo in ('entrada', 'producao', 'perda', 'ajuste', 'estorno')),
  -- Com sinal: entrada/estorno positivos, produção/perda negativos, ajuste qualquer.
  quantidade numeric(12, 3) not null check (quantidade <> 0 and abs(quantidade) <= 1000000),
  motivo text check (motivo is null or char_length(motivo) <= 200),
  producao_id uuid references public.producoes (id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (tipo in ('entrada', 'estorno') and quantidade > 0)
    or (tipo in ('producao', 'perda') and quantidade < 0)
    or tipo = 'ajuste'
  )
);

create index if not exists insumo_movimentos_insumo_idx
  on public.insumo_movimentos (insumo_id, created_at desc);
create index if not exists insumo_movimentos_producao_idx
  on public.insumo_movimentos (producao_id)
  where producao_id is not null;

create or replace view public.insumo_saldos
with (security_invoker = true) as
select
  i.id,
  i.user_id,
  i.nome,
  i.unidade,
  i.custo_unitario,
  i.estoque_minimo,
  coalesce(sum(m.quantidade), 0)::numeric(14, 3) as saldo
from public.insumos i
left join public.insumo_movimentos m on m.insumo_id = i.id
where not i.arquivado
group by i.id;

-- ── produto_insumos (receita) ──────────────────────────────────────────────
create table if not exists public.produto_insumos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete cascade,
  insumo_id uuid not null references public.insumos (id) on delete restrict,
  quantidade numeric(12, 3) not null check (quantidade > 0 and quantidade <= 100000),
  created_at timestamptz not null default now(),
  unique (produto_id, insumo_id)
);

create index if not exists produto_insumos_user_idx on public.produto_insumos (user_id);

-- ── RLS: a usuária lê o que é dela; escrita só pelas funções ───────────────
alter table public.insumos enable row level security;
alter table public.producoes enable row level security;
alter table public.insumo_movimentos enable row level security;
alter table public.produto_insumos enable row level security;

revoke all on public.insumos, public.producoes, public.insumo_movimentos, public.produto_insumos
  from anon, authenticated;
grant select on public.insumos, public.producoes, public.insumo_movimentos, public.produto_insumos
  to authenticated;
grant select on public.insumo_saldos to authenticated;

drop policy if exists "Insumos: dona lê" on public.insumos;
create policy "Insumos: dona lê" on public.insumos for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Produções: dona lê" on public.producoes;
create policy "Produções: dona lê" on public.producoes for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Movimentos de insumo: dona lê" on public.insumo_movimentos;
create policy "Movimentos de insumo: dona lê" on public.insumo_movimentos for select
  to authenticated using (user_id = auth.uid());
drop policy if exists "Receita: dona lê" on public.produto_insumos;
create policy "Receita: dona lê" on public.produto_insumos for select to authenticated
  using (user_id = auth.uid());

-- ── salvar_insumo ──────────────────────────────────────────────────────────
-- p_id null cria (com o estoque inicial, se vier); com id, edita nome,
-- unidade, custo e mínimo. O saldo nunca é editado: só muda por movimento.
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
  return v_id;
end;
$$;

-- ── arquivar_insumo ────────────────────────────────────────────────────────
-- Insumo em receita de produto ativo não sai: a próxima produção ia parar.
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
  -- Receita de produto arquivado não segura o insumo.
  delete from produto_insumos r
  using produtos p
  where r.insumo_id = p_id and r.user_id = v_uid and p.id = r.produto_id and p.arquivado;
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

-- ── movimentar_insumo ──────────────────────────────────────────────────────
-- Compra, perda ou contagem à mão. Na contagem, p_quantidade é o que TEM e a
-- diferença sai daqui, com o insumo travado. Devolve o saldo novo.
create or replace function public.movimentar_insumo(
  p_insumo_id uuid,
  p_tipo text,
  p_quantidade numeric,
  p_motivo text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_saldo numeric;
  v_delta numeric;
  v_qtd numeric := round(p_quantidade, 3);
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  if p_tipo is null or p_tipo not in ('entrada', 'perda', 'ajuste') then
    raise exception 'Tipo inválido' using errcode = 'check_violation';
  end if;
  if v_qtd is null or v_qtd < 0 or v_qtd > 1000000 then
    raise exception 'Quantidade inválida' using errcode = 'check_violation';
  end if;
  perform 1 from insumos where id = p_insumo_id and user_id = v_uid and not arquivado for update;
  if not found then
    raise exception 'Insumo não encontrado' using errcode = 'no_data_found';
  end if;
  select coalesce(sum(quantidade), 0) into v_saldo
  from insumo_movimentos where insumo_id = p_insumo_id;

  v_delta := case p_tipo when 'entrada' then v_qtd when 'perda' then -v_qtd else v_qtd - v_saldo end;
  if v_delta = 0 then
    raise exception 'Nada a mudar' using errcode = 'check_violation';
  end if;
  insert into insumo_movimentos (user_id, insumo_id, tipo, quantidade, motivo)
  values (v_uid, p_insumo_id, p_tipo, v_delta, left(nullif(btrim(p_motivo), ''), 200));
  return v_saldo + v_delta;
end;
$$;

-- ── salvar_receita ─────────────────────────────────────────────────────────
-- p_itens: [{ "insumo_id": uuid, "quantidade": numeric }] (substitui a receita).
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
    if not exists (
      select 1 from insumos
      where id = (v_item ->> 'insumo_id')::uuid and user_id = v_uid and not arquivado
    ) then
      raise exception 'Insumo não encontrado' using errcode = 'no_data_found';
    end if;
    insert into produto_insumos (user_id, produto_id, insumo_id, quantidade)
    values (v_uid, p_produto_id, (v_item ->> 'insumo_id')::uuid, v_qtd);
  end loop;
end;
$$;

-- ── registrar_producao ─────────────────────────────────────────────────────
-- Baixa a receita x N de cada insumo e, com estoque ligado, soma N na variação
-- do produto. Saldo de insumo pode ficar negativo (a tela avisa antes), como
-- a venda faz com o estoque: travar a produção que já aconteceu só esconde.
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
  if exists (select 1 from producoes where id = p_id and user_id = v_uid) then
    return p_id;
  end if;
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 100000 then
    raise exception 'Quantidade inválida' using errcode = 'check_violation';
  end if;
  if p_data is null then
    raise exception 'Data inválida' using errcode = 'check_violation';
  end if;
  select * into v_produto from produtos
    where id = p_produto_id and user_id = v_uid and not arquivado
    for share;
  if not found then
    raise exception 'Produto não encontrado' using errcode = 'no_data_found';
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

-- ── desfazer_producao ──────────────────────────────────────────────────────
-- Devolve os insumos (estorno) e tira do estoque do produto o que tinha
-- entrado. O registro fica, marcado como desfeito.
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
    perform 1 from produto_skus where id = v_producao.sku_id for update;
    insert into estoque_movimentos (user_id, sku_id, tipo, quantidade, motivo)
    values (v_uid, v_producao.sku_id, 'ajuste', -v_producao.quantidade, 'produção desfeita');
  end if;

  update producoes set desfeita_em = now() where id = p_id;
end;
$$;

revoke all on function public.salvar_insumo(uuid, text, text, numeric, numeric, numeric) from public, anon;
revoke all on function public.arquivar_insumo(uuid) from public, anon;
revoke all on function public.movimentar_insumo(uuid, text, numeric, text) from public, anon;
revoke all on function public.salvar_receita(uuid, jsonb) from public, anon;
revoke all on function public.registrar_producao(uuid, uuid, uuid, integer, date, text) from public, anon;
revoke all on function public.desfazer_producao(uuid) from public, anon;
grant execute on function public.salvar_insumo(uuid, text, text, numeric, numeric, numeric) to authenticated;
grant execute on function public.arquivar_insumo(uuid) to authenticated;
grant execute on function public.movimentar_insumo(uuid, text, numeric, text) to authenticated;
grant execute on function public.salvar_receita(uuid, jsonb) to authenticated;
grant execute on function public.registrar_producao(uuid, uuid, uuid, integer, date, text) to authenticated;
grant execute on function public.desfazer_producao(uuid) to authenticated;
