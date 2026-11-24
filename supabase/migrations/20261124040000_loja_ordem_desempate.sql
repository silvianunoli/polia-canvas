-- Desempate da ordem da loja (24/11/2026, ONE-239). Produtos importados juntos
-- têm o mesmo created_at, e sem desempate cada leitura devolvia uma ordem: a
-- tela mostrava "Almofada linda" em 7º e a loja, "Mouse pad redondo". Agora o
-- empate decide pelo nome (pt-BR) e, por fim, pelo id, a mesma regra de
-- compararOrdemDaVitrine (src/lib/catalogoProdutos.ts). Só muda o order by final.
CREATE OR REPLACE FUNCTION public.loja_marca_publica(p_dominio text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      ) order by p.catalogo_ordem nulls last, p.created_at desc, p.nome collate "pt-BR-x-icu", p.id)
        from produtos p
       where p.user_id = v_loja.user_id and not p.arquivado and p.no_catalogo
    ), '[]'::jsonb)
  );
end;
$function$;