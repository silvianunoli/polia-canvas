-- Custos da marca (ONE-258, 24/11/2026, pedido da Sil): o que a Calculadora
-- usa e não é da peça (custos fixos do mês, peças vendidas por mês, imposto e
-- taxa de recebimento) sai da tela do produto e é cadastrado uma vez no
-- Financeiro. O pró-labore continua em profiles.pro_labore_desejado, o mesmo
-- da Projeção. `acrescimo_canais` guarda o % a mais por marketplace
-- (ONE-259): {"mercado_livre": 40, "tiktok_shop": 40, "shopee": 40}.
create table if not exists public.custos_marca (
  user_id uuid primary key references auth.users (id) on delete cascade,
  fixos_mes numeric(12, 2) not null default 0
    check (fixos_mes >= 0 and fixos_mes < 10000000),
  -- Detalhe por item (chaves de ITENS_CUSTO_FIXO), valores em texto como a Calculadora.
  fixos_detalhe jsonb not null default '{}'::jsonb
    check (jsonb_typeof(fixos_detalhe) = 'object'),
  pecas_mes integer
    check (pecas_mes is null or (pecas_mes >= 1 and pecas_mes <= 1000000)),
  imposto_pct numeric(5, 2) not null default 0
    check (imposto_pct >= 0 and imposto_pct < 100),
  taxa_recebimento_pct numeric(5, 2) not null default 0
    check (taxa_recebimento_pct >= 0 and taxa_recebimento_pct < 100),
  acrescimo_canais jsonb not null default '{}'::jsonb
    check (jsonb_typeof(acrescimo_canais) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.custos_marca enable row level security;

drop policy if exists "custos_marca_select_propria" on public.custos_marca;
create policy "custos_marca_select_propria" on public.custos_marca
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "custos_marca_insert_propria" on public.custos_marca;
create policy "custos_marca_insert_propria" on public.custos_marca
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "custos_marca_update_propria" on public.custos_marca;
create policy "custos_marca_update_propria" on public.custos_marca
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.custos_marca to authenticated;

-- Encomenda sob medida (ONE-258): na tela é o quarto Tipo; no banco é produto
-- físico com esta marca. Um tipo 'encomenda' novo quebraria receita,
-- produção, kit e estoque, que exigem tipo = 'fisico'.
alter table public.produtos
  add column if not exists sob_medida boolean not null default false;
