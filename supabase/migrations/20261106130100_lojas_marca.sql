-- E-commerce white label sobre a Pólia One (ONE-178, fase 1, 06/11/2026). O site
-- das marcas mora em outro repositório (polia-lojas) e lê daqui. Tudo aqui só
-- soma: nenhuma tela ou função existente muda de comportamento.
--
--   lojas_marca          domínio, cara e textos de cada marca. Sem escrita pela
--                        API por enquanto: a tela de aparência entra na fase 6.
--   produto_categorias   categorias da vitrine.
--   produtos             categoria, prazo próprio de encomenda e eixos de
--                        variação (["Cor", "Tamanho"]).
--   produto_skus         opções da variação ({"Cor": "Azul"}), preço e foto
--                        próprios. Nulos seguem o produto. O campo variacao
--                        continua sendo o nome que Pedidos e Estoque mostram.
--   loja_marca_publica   o que o site lê. Só sai o que a vitrine mostra em
--                        público: nunca custo nem quantidade em estoque.

-- ── 1. a loja da marca ─────────────────────────────────────────────────────
create table if not exists public.lojas_marca (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dominio text not null unique
    check (dominio ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' and char_length(dominio) <= 120),
  ativa boolean not null default false,
  -- Fica fora do Google até a loja abrir de verdade (fase 4).
  indexar boolean not null default false,
  prazo_dias_uteis integer not null default 7 check (prazo_dias_uteis between 1 and 120),
  tema jsonb not null default '{}' check (jsonb_typeof(tema) = 'object' and octet_length(tema::text) <= 4000),
  conteudo jsonb not null default '{}' check (jsonb_typeof(conteudo) = 'object' and octet_length(conteudo::text) <= 20000),
  legal jsonb not null default '{}' check (jsonb_typeof(legal) = 'object' and octet_length(legal::text) <= 60000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists lojas_marca_updated on public.lojas_marca;
create trigger lojas_marca_updated before update on public.lojas_marca
  for each row execute function public.vendas_tocar_updated_at();

alter table public.lojas_marca enable row level security;
revoke all on public.lojas_marca from public, anon, authenticated;
grant select on public.lojas_marca to authenticated;
drop policy if exists "Loja da marca: dona lê" on public.lojas_marca;
create policy "Loja da marca: dona lê" on public.lojas_marca for select to authenticated using (user_id = auth.uid());

-- ── 2. categorias ──────────────────────────────────────────────────────────
create table if not exists public.produto_categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 60),
  slug text not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$'),
  ordem integer not null default 0 check (ordem between 0 and 10000),
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);

alter table public.produto_categorias enable row level security;
revoke all on public.produto_categorias from public, anon;
grant select, insert, update, delete on public.produto_categorias to authenticated;
drop policy if exists "Categorias: dona lê" on public.produto_categorias;
create policy "Categorias: dona lê" on public.produto_categorias for select to authenticated using (user_id = auth.uid());
drop policy if exists "Categorias: dona cria" on public.produto_categorias;
create policy "Categorias: dona cria" on public.produto_categorias for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Categorias: dona edita" on public.produto_categorias;
create policy "Categorias: dona edita" on public.produto_categorias for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Categorias: dona apaga" on public.produto_categorias;
create policy "Categorias: dona apaga" on public.produto_categorias for delete to authenticated using (user_id = auth.uid());

-- ── 3. produtos e variações ────────────────────────────────────────────────
alter table public.produtos
  add column if not exists categoria_id uuid references public.produto_categorias (id) on delete set null,
  add column if not exists prazo_dias_uteis integer check (prazo_dias_uteis is null or prazo_dias_uteis between 1 and 120),
  add column if not exists eixos_variacao jsonb not null default '[]'
    check (jsonb_typeof(eixos_variacao) = 'array' and jsonb_array_length(eixos_variacao) <= 3);

alter table public.produto_skus
  add column if not exists opcoes jsonb not null default '{}' check (jsonb_typeof(opcoes) = 'object'),
  add column if not exists preco_venda numeric(12, 2) check (preco_venda is null or preco_venda >= 0),
  add column if not exists foto_path text
    check (foto_path is null or (char_length(foto_path) <= 200 and foto_path like user_id::text || '/%'));

-- ── 4. leitura pública ─────────────────────────────────────────────────────
-- Null quando a loja não existe, está desligada, a conta saiu do Pro ou a marca
-- está sem nome. Sob encomenda (controla_estoque false) está sempre disponível.
-- Com estoque, disponível é ter saldo: a quantidade em si não sai daqui.
create or replace function public.loja_marca_publica(p_dominio text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_loja public.lojas_marca;
  v_nome text;
  v_logo text;
  v_plano text;
begin
  select * into v_loja from lojas_marca where dominio = lower(btrim(p_dominio)) and ativa;
  if not found then
    return null;
  end if;
  select nullif(btrim(business_name), ''), logo_path, plano into v_nome, v_logo, v_plano
    from profiles where id = v_loja.user_id;
  -- Só no Pro, como temProjete em src/lib/planos.ts do polia-app.
  if v_nome is null or coalesce(v_plano, '') not in ('projete', 'beta') then
    return null;
  end if;

  return jsonb_build_object(
    'dominio', v_loja.dominio,
    'nome', v_nome,
    'logo_path', v_logo,
    'indexar', v_loja.indexar,
    'prazo_dias_uteis', v_loja.prazo_dias_uteis,
    'tema', v_loja.tema,
    'conteudo', v_loja.conteudo,
    'legal', v_loja.legal,
    'categorias', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'slug', c.slug) order by c.ordem, c.nome)
        from produto_categorias c where c.user_id = v_loja.user_id
    ), '[]'::jsonb),
    'produtos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nome', p.nome,
        'descricao', p.descricao,
        'preco', p.preco_venda,
        'categoria_id', p.categoria_id,
        'sob_encomenda', not p.controla_estoque,
        'prazo_dias_uteis', p.prazo_dias_uteis,
        'eixos', p.eixos_variacao,
        'foto_url', p.foto_url,
        'fotos', coalesce((
          select jsonb_agg(f.path order by f.ordem) from produto_fotos f where f.produto_id = p.id
        ), '[]'::jsonb),
        'tem_saldo', exists (
          select 1 from produto_skus s
           where s.produto_id = p.id and not s.arquivado
             and (select coalesce(sum(m.quantidade), 0) from estoque_movimentos m where m.sku_id = s.id) > 0
        ),
        'variacoes', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', s.id,
            'nome', s.variacao,
            'opcoes', s.opcoes,
            'preco', s.preco_venda,
            'foto_path', s.foto_path,
            'tem_saldo', (select coalesce(sum(m.quantidade), 0) from estoque_movimentos m where m.sku_id = s.id) > 0
          ) order by s.variacao)
            from produto_skus s
           where s.produto_id = p.id and not s.arquivado and s.variacao is not null
        ), '[]'::jsonb)
      ) order by p.catalogo_ordem nulls last, p.created_at)
        from produtos p
       where p.user_id = v_loja.user_id and not p.arquivado and p.no_catalogo
    ), '[]'::jsonb)
  );
end;
$fn$;

revoke all on function public.loja_marca_publica(text) from public;
grant execute on function public.loja_marca_publica(text) to anon, authenticated, service_role;
