-- Loja da marca em "Em breve" (27/11/2026, Sil: "quero fazer isso diretamente pela
-- pólia one e poder colocar a frase que eu quiser" e "continuar acessando a loja em um
-- link alternativo, que só eu vou ter").
--
-- em_breve liga a página Em breve no site da marca; em_breve_texto é a frase que a dona
-- escreve. previa_token é o link de teste: quem abre <site>/previa/<token> ganha um
-- cookie e vê a loja aberta. Sem o token certo, loja_marca_publica devolve só nome,
-- logo, tema, rodapé legal e a frase: produto nenhum sai, e sem produto o checkout
-- não abre. site_url é o endereço público do site (o dominio é a chave interna e
-- pode não abrir no navegador).

alter table public.lojas_marca
  add column if not exists em_breve boolean not null default false,
  add column if not exists em_breve_texto text,
  add column if not exists previa_token text not null default replace(gen_random_uuid()::text, '-', ''),
  add column if not exists site_url text;

alter table public.lojas_marca
  add constraint lojas_marca_em_breve_texto_tamanho
    check (em_breve_texto is null or char_length(em_breve_texto) between 1 and 200),
  add constraint lojas_marca_previa_token_formato
    check (previa_token ~ '^[0-9a-f]{32}$'),
  add constraint lojas_marca_site_url_formato
    check (site_url is null or site_url ~ '^https://[a-z0-9.-]+$');

-- O site da Mundo de Aimer abre no domínio da marca; o dominio provisório não resolve.
update public.lojas_marca
   set site_url = 'https://mundodeaimer.com.br'
 where dominio = 'mundodeaimer.lojas.usepolia.com.br'
   and site_url is null;

-- A leitura pública ganha o token de prévia (opcional). Chamada antiga, só com
-- p_dominio, continua valendo.
drop function if exists public.loja_marca_publica(text);

create or replace function public.loja_marca_publica(p_dominio text, p_previa text default null)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_loja public.lojas_marca;
  v_nome text;
  v_logo text;
  v_previa boolean;
begin
  select * into v_loja from lojas_marca where dominio = lower(btrim(p_dominio)) and ativa;
  if not found then
    return null;
  end if;
  select coalesce(nullif(btrim(v_loja.nome), ''), nullif(btrim(business_name), '')), v_loja.logo_path
    into v_nome, v_logo
    from profiles where id = v_loja.user_id;
  if v_nome is null then
    return null;
  end if;

  v_previa := coalesce(p_previa, '') = v_loja.previa_token;

  -- Em breve sem o link de teste: só o que a página Em breve mostra.
  if v_loja.em_breve and not v_previa then
    return jsonb_build_object(
      'dominio', v_loja.dominio,
      'nome', v_nome,
      'logo_path', v_logo,
      'indexar', false,
      'prazo_dias_uteis', v_loja.prazo_dias_uteis,
      'tema', v_loja.tema,
      'conteudo', jsonb_strip_nulls(jsonb_build_object(
        'instagram', v_loja.conteudo -> 'instagram',
        'whatsapp', v_loja.conteudo -> 'whatsapp'
      )),
      'legal', v_loja.legal,
      'categorias', '[]'::jsonb,
      'mais_vendidos', '[]'::jsonb,
      'produtos', '[]'::jsonb,
      'em_breve', jsonb_build_object('texto', v_loja.em_breve_texto, 'previa', false)
    );
  end if;

  return jsonb_build_object(
    'dominio', v_loja.dominio,
    'nome', v_nome,
    'logo_path', v_logo,
    'indexar', v_loja.indexar and not v_loja.em_breve,
    'prazo_dias_uteis', v_loja.prazo_dias_uteis,
    'tema', v_loja.tema,
    'conteudo', v_loja.conteudo,
    'legal', v_loja.legal,
    'em_breve', case when v_loja.em_breve
      then jsonb_build_object('texto', v_loja.em_breve_texto, 'previa', true) end,
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
        'preco', preco_que_vale(p),
        'preco_de', case when preco_que_vale(p) < p.preco_venda then p.preco_venda end,
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
         and (p.foto_url like 'https://%' or exists (select 1 from produto_fotos f where f.produto_id = p.id))
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.loja_marca_publica(text, text) from public;
grant execute on function public.loja_marca_publica(text, text) to anon, authenticated, service_role;

-- A dona liga e desliga o Em breve e escreve a frase (lojas_marca segue sem UPDATE pela API).
create or replace function public.loja_marca_salvar_em_breve(p_ativo boolean, p_texto text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if not exists (select 1 from lojas_marca where user_id = v_uid) then
    raise exception 'Conta sem loja da marca' using errcode = '42501';
  end if;
  if v_texto is not null and char_length(v_texto) > 200 then
    raise exception 'A frase passa de 200 caracteres' using errcode = '22023';
  end if;

  update lojas_marca
     set em_breve = coalesce(p_ativo, false),
         em_breve_texto = v_texto,
         updated_at = now()
   where user_id = v_uid;
end;
$function$;

-- Link de teste novo: o antigo para de abrir a loja na hora.
create or replace function public.loja_marca_trocar_link_previa()
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  update lojas_marca
     set previa_token = replace(gen_random_uuid()::text, '-', ''),
         updated_at = now()
   where user_id = v_uid
  returning previa_token into v_token;
  if v_token is null then
    raise exception 'Conta sem loja da marca' using errcode = '42501';
  end if;
  return v_token;
end;
$function$;

revoke all on function public.loja_marca_salvar_em_breve(boolean, text) from public, anon;
revoke all on function public.loja_marca_trocar_link_previa() from public, anon;
grant execute on function public.loja_marca_salvar_em_breve(boolean, text) to authenticated, service_role;
grant execute on function public.loja_marca_trocar_link_previa() to authenticated, service_role;
