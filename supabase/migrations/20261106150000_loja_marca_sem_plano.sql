-- A loja de marca é um serviço do Lab, não um recurso da assinatura (Sil, 06/11/2026,
-- ONE-178): o plano da conta não liga nem desliga a loja. Quem faz isso é lojas_marca.ativa.
-- Conta que cai de plano segue com o site no ar. Só muda a checagem de plano.

create or replace function public.loja_marca_publica(p_dominio text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
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
$$;
