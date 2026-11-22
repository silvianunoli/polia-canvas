-- Detalhes do produto na loja da marca (Sil, 22/11/2026): a página do produto ganha as abas
-- "Descrição" e "Detalhes do produto", uma tabela com as medidas e o que mais a dona quiser
-- (Capacidade: 325 ml; Material: cerâmica). Cada linha é {nome, valor}; até 20 linhas.
-- Não usa peso_kg/altura_cm/...: esses são da embalagem, pro frete, não do produto.

create or replace function public.produto_detalhes_validos(p jsonb)
returns boolean
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select jsonb_typeof(p) = 'array'
     and jsonb_array_length(p) <= 20
     and not exists (
       select 1 from jsonb_array_elements(p) e
        where jsonb_typeof(e) <> 'object'
           or jsonb_typeof(e->'nome') is distinct from 'string'
           or jsonb_typeof(e->'valor') is distinct from 'string'
           or length(btrim(e->>'nome')) not between 1 and 60
           or length(btrim(e->>'valor')) not between 1 and 200
     );
$$;

alter table public.produtos
  add column if not exists detalhes_loja jsonb not null default '[]'::jsonb;

alter table public.produtos
  drop constraint if exists produtos_detalhes_loja_validos;
alter table public.produtos
  add constraint produtos_detalhes_loja_validos check (public.produto_detalhes_validos(detalhes_loja));

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
        'detalhes', p.detalhes_loja,
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
