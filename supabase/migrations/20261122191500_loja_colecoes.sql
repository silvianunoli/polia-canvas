-- Coleção separada da categoria (Sil, 22/11/2026). A categoria é o tipo do produto
-- (Canecas, Papelaria...) e vai no menu do topo da loja. A coleção é o tema da estampa
-- (Clube das Exaustas, Natal...) e vai nas bolinhas e no "Explore por coleção".
-- Cada produto tem uma categoria e pode ter uma coleção.

alter table public.produto_categorias
  add column if not exists tipo text not null default 'categoria',
  add column if not exists capa_path text;

do $$ begin
  alter table public.produto_categorias
    add constraint produto_categorias_tipo_check check (tipo in ('categoria', 'colecao'));
exception when duplicate_object then null; end $$;

alter table public.produtos
  add column if not exists colecao_id uuid references public.produto_categorias(id) on delete set null;

create index if not exists produtos_colecao_id_idx on public.produtos (colecao_id) where colecao_id is not null;

-- A coleção tem que ser da mesma dona e ser coleção mesmo.
create or replace function public.produtos_conferir_colecao()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.colecao_id is not null and not exists (
    select 1 from produto_categorias c
     where c.id = new.colecao_id and c.user_id = new.user_id and c.tipo = 'colecao'
  ) then
    raise exception 'Coleção inválida para este produto';
  end if;
  return new;
end;
$$;

drop trigger if exists produtos_conferir_colecao on public.produtos;
create trigger produtos_conferir_colecao
  before insert or update of colecao_id, user_id on public.produtos
  for each row execute function public.produtos_conferir_colecao();

-- Dados da Mundo de Aimer -------------------------------------------------------------
do $$
declare
  v_user uuid := '6ac87988-fdf7-4c2f-92b0-03a707f23218';
begin
  if not exists (select 1 from profiles where id = v_user) then
    return;
  end if;

  -- As 7 criadas junto com as estampas viram coleção.
  update produto_categorias set tipo = 'colecao'
   where user_id = v_user
     and slug in ('clube-das-exaustas', 'vida-de-pet', 'cafe-e-casa', 'mesa-de-trabalho', 'geek', 'natal');

  -- Decoração vira Casa; entra Escritório.
  update produto_categorias set nome = 'Casa', slug = 'casa'
   where user_id = v_user and slug = 'decoracao';

  insert into produto_categorias (user_id, nome, slug, ordem, tipo)
  values (v_user, 'Escritório', 'escritorio', 7, 'categoria')
  on conflict (user_id, slug) do nothing;
  update produto_categorias set ordem = 8 where user_id = v_user and slug = 'bolsas-e-necessaires';

  -- Estampas: a coleção sai da categoria e a categoria vira o tipo, pelo nome.
  update produtos p set colecao_id = p.categoria_id
   where p.user_id = v_user
     and p.observacao_interna like '[ESTAMPA-2026-11-22]%'
     and p.colecao_id is null
     and exists (select 1 from produto_categorias c where c.id = p.categoria_id and c.tipo = 'colecao');

  update produtos p set categoria_id = (
    select c.id from produto_categorias c
     where c.user_id = v_user
       and c.slug = case
         when p.nome ilike 'caneca%' then 'canecas'
         when p.nome ilike 'kit % xícaras%' or p.nome ilike 'xícara%' then 'xicaras'
         when p.nome ilike 'copo%' or p.nome ilike 'squeeze%' or p.nome ilike 'garrafa%' then 'copos-e-garrafas'
         when p.nome ilike 'caderno%' then 'papelaria'
         when p.nome ilike 'mouse pad%' or p.nome ilike 'porta-lápis%' then 'escritorio'
         when p.nome ilike 'ecobag%' or p.nome ilike 'necessaire%' or p.nome ilike 'sacola%' then 'bolsas-e-necessaires'
         when p.nome ilike 'chaveiro%' then 'chaveiros'
         else 'casa'
       end
  )
   where p.user_id = v_user
     and p.observacao_interna like '[ESTAMPA-2026-11-22]%'
     and p.colecao_id is not null
     and exists (select 1 from produto_categorias c where c.id = p.categoria_id and c.tipo = 'colecao');
end $$;

-- Função pública da loja: tipo e capa da categoria, coleção do produto e mais vendidos.
create or replace function public.loja_marca_publica(p_dominio text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_loja public.lojas_marca;
  v_nome text;
  v_logo text;
begin
  select * into v_loja from lojas_marca where dominio = lower(btrim(p_dominio)) and ativa;
  if not found then
    return null;
  end if;
  select nullif(btrim(business_name), ''), logo_path into v_nome, v_logo
    from profiles where id = v_loja.user_id;
  if v_nome is null then
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
      select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'slug', c.slug, 'tipo', c.tipo, 'capa_path', c.capa_path) order by c.ordem, c.nome)
        from produto_categorias c where c.user_id = v_loja.user_id
    ), '[]'::jsonb),
    -- Só a ordem, nunca a quantidade: o que mais saiu nos últimos 90 dias.
    'mais_vendidos', coalesce((
      select jsonb_agg(t.produto_id order by t.qtd desc, t.produto_id)
        from (
          select i.produto_id, sum(i.quantidade) qtd
            from venda_itens i
            join vendas v on v.id = i.venda_id
           where v.user_id = v_loja.user_id
             and v.status <> 'cancelada'
             and v.data >= current_date - 90
             and i.produto_id is not null
           group by i.produto_id
        ) t
    ), '[]'::jsonb),
    'produtos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nome', p.nome,
        'descricao', p.descricao,
        'preco', p.preco_venda,
        'categoria_id', p.categoria_id,
        'colecao_id', p.colecao_id,
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
$function$;

-- A loja também pede o título dos carrosséis por chave nova; o conteúdo antigo segue valendo.
update public.lojas_marca
   set conteudo = jsonb_set(
     jsonb_set(
       jsonb_set(conteudo, '{rotulos,produtos}', '{"titulo": "Mais Vendidos"}'::jsonb, true),
       '{rotulos,atalhos}', '{"acima": "Encontre mais rápido", "titulo": "Explore por coleção"}'::jsonb, true),
     '{rotulos,rotina}', '{"acima": "Para fechar o kit", "titulo": "Complete seu pedido"}'::jsonb, true)
 where user_id = '6ac87988-fdf7-4c2f-92b0-03a707f23218'
   and conteudo ? 'rotulos';
