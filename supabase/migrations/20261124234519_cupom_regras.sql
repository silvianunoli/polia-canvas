-- Regras do cupom de desconto (24/11/2026, pedido da Sil, continuação do ONE-239).
--
-- O cupom agora pode valer:
--   * só para uma parte dos produtos: categoria, coleção ou produtos escolhidos (alcance);
--   * só para uma forma de pagamento: Pix ou cartão (meio). Só na loja da marca;
--   * como frete grátis, para o Brasil todo ou para estados e cidades escolhidos
--     (tipo frete_gratis, ufs, cidades). Só na loja da marca.
-- A Vitrine online não cobra nem calcula frete, então lá só vale a regra de produto
-- (decisão da Sil, 24/11/2026). Cupom de Pix ou de frete grátis é recusado na Vitrine.
--
-- Na loja da marca:
--   * loja_checkouts.desconto continua sendo o desconto que já vale;
--   * desconto_meio guarda o desconto que só vale se pagar no meio do cupom. A order do
--     Mercado Pago sai com ele só quando o meio bate (loja_checkout_tentar com p_meio), e
--     loja_checkout_confirmar reconhece o valor pago com ou sem ele;
--   * frete_gratis marca o pedido em que o cupom zerou o frete (o endereço bateu).
--   * O uso do cupom só conta quando o desconto (ou o frete grátis) de fato valeu.

-- ── cupom ──────────────────────────────────────────────────────────────────
alter table public.catalogo_cupons
  alter column valor drop not null,
  add column alcance text not null default 'todos',
  add column alcance_ids uuid[] not null default '{}',
  add column meio text,
  add column ufs text[] not null default '{}',
  add column cidades text[] not null default '{}';

alter table public.catalogo_cupons drop constraint catalogo_cupons_tipo_check;
alter table public.catalogo_cupons
  add constraint catalogo_cupons_tipo_check check (tipo in ('percentual', 'valor', 'frete_gratis')),
  add constraint catalogo_cupons_valor_do_tipo check ((tipo = 'frete_gratis') = (valor is null)),
  add constraint catalogo_cupons_alcance_check check (
    alcance in ('todos', 'categoria', 'colecao', 'produtos')
    and (alcance = 'todos') = (cardinality(alcance_ids) = 0)
    and cardinality(alcance_ids) <= 200),
  add constraint catalogo_cupons_meio_check check (meio is null or meio in ('pix', 'cartao')),
  -- Frete grátis vale para o pedido todo e qualquer pagamento; lugar só no frete grátis.
  add constraint catalogo_cupons_regras_do_tipo check (
    case when tipo = 'frete_gratis' then alcance = 'todos' and meio is null
         else cardinality(ufs) = 0 and cardinality(cidades) = 0 end),
  add constraint catalogo_cupons_ufs_check check (
    cardinality(ufs) <= 27 and array_to_string(ufs, ',') ~ '^([A-Z]{2}(,[A-Z]{2})*)?$'),
  -- Cidade guardada como "UF:Nome" (ex.: "SP:São Paulo"): o nome sozinho é ambíguo.
  add constraint catalogo_cupons_cidades_check check (
    cardinality(cidades) <= 50
    and array_to_string(cidades, E'\n') ~ '^([A-Z]{2}:[^\n:]{2,60}(\n[A-Z]{2}:[^\n:]{2,60})*)?$');

comment on column public.catalogo_cupons.alcance is
  'todos | categoria | colecao | produtos. Os ids ficam em alcance_ids (produto_categorias.id ou produtos.id).';
comment on column public.catalogo_cupons.meio is 'null = qualquer pagamento; pix ou cartao. Só na loja da marca.';
comment on column public.catalogo_cupons.cidades is 'Frete grátis por cidade, no formato UF:Nome (ex.: SP:São Paulo).';

-- ── checkout da loja ───────────────────────────────────────────────────────
alter table public.loja_checkouts
  add column desconto_meio numeric(12,2) not null default 0,
  add column cupom_regras jsonb,
  add column frete_gratis boolean not null default false;

-- ── ajudantes (sem security definer: rodam dentro das funções que já são) ──
create or replace function public.cupom_texto_comparavel(p text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select regexp_replace(
    lower(translate(btrim(coalesce(p, '')),
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '\s+', ' ', 'g');
$$;

create or replace function public.cupom_vale_produto(c public.catalogo_cupons, p public.produtos)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(
    c.alcance = 'todos'
    or (c.alcance = 'categoria' and p.categoria_id = any (c.alcance_ids))
    or (c.alcance = 'colecao' and p.colecao_id = any (c.alcance_ids))
    or (c.alcance = 'produtos' and p.id = any (c.alcance_ids)),
    false);
$$;

-- Ids dos produtos em que o cupom vale (null = todos), para a loja mostrar a prévia.
create or replace function public.cupom_produtos_validos(c public.catalogo_cupons)
returns jsonb
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select case when c.alcance = 'todos' then null
    else coalesce((
      select jsonb_agg(p.id)
        from produtos p
       where p.user_id = c.user_id and not p.arquivado and cupom_vale_produto(c, p)
    ), '[]'::jsonb)
  end;
$$;

-- O endereço bate com o lugar do frete grátis? Sem estado nem cidade, vale o Brasil todo.
create or replace function public.cupom_frete_vale(r jsonb, e jsonb)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(r ->> 'tipo' = 'frete_gratis', false) and (
    (jsonb_array_length(coalesce(r -> 'ufs', '[]')) = 0 and jsonb_array_length(coalesce(r -> 'cidades', '[]')) = 0)
    or upper(btrim(coalesce(e ->> 'uf', ''))) in (select jsonb_array_elements_text(coalesce(r -> 'ufs', '[]')))
    or upper(btrim(coalesce(e ->> 'uf', ''))) || ':' || cupom_texto_comparavel(e ->> 'cidade') in (
      select left(x, 2) || ':' || cupom_texto_comparavel(substr(x, 4))
        from jsonb_array_elements_text(coalesce(r -> 'cidades', '[]')) x)
  );
$$;

revoke all on function public.cupom_texto_comparavel(text) from public, anon, authenticated;
revoke all on function public.cupom_vale_produto(public.catalogo_cupons, public.produtos) from public, anon, authenticated;
revoke all on function public.cupom_produtos_validos(public.catalogo_cupons) from public, anon, authenticated;
revoke all on function public.cupom_frete_vale(jsonb, jsonb) from public, anon, authenticated;

-- ── conferência do cupom (só leitura) ──────────────────────────────────────
-- Vitrine online: só cupom de desconto sem regra de pagamento.
create or replace function public.cupom_da_loja(p_slug text, p_codigo text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid;
  v_plano text;
  v_cupom public.catalogo_cupons;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select c.user_id, p.plano into v_uid, v_plano
    from catalogos c
    join profiles p on p.id = c.user_id
   where c.slug = lower(btrim(p_slug)) and c.ativo;
  if v_uid is null or coalesce(v_plano, '') not in ('projete', 'beta', 'controle') then
    return null;
  end if;
  select * into v_cupom from catalogo_cupons
   where user_id = v_uid and codigo = upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
  if not found or not v_cupom.ativo
     or (v_cupom.valido_ate is not null and v_cupom.valido_ate < v_hoje)
     or (v_cupom.limite_usos is not null and v_cupom.usos >= v_cupom.limite_usos) then
    return null;
  end if;
  if v_cupom.tipo = 'frete_gratis' or v_cupom.meio is not null then
    return jsonb_build_object('codigo', v_cupom.codigo, 'so_loja', true);
  end if;
  return jsonb_build_object(
    'codigo', v_cupom.codigo, 'tipo', v_cupom.tipo, 'valor', v_cupom.valor,
    'produtos', cupom_produtos_validos(v_cupom));
end;
$function$;

-- Loja da marca: devolve as regras para a prévia no carrinho e no checkout.
create or replace function public.loja_cupom_conferir(p_dominio text, p_codigo text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid;
  v_cupom public.catalogo_cupons;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select l.user_id into v_uid
    from lojas_marca l
   where l.dominio = lower(btrim(p_dominio)) and l.ativa;
  if v_uid is null then
    return null;
  end if;
  select * into v_cupom from catalogo_cupons
   where user_id = v_uid and codigo = upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
  if not found or not v_cupom.ativo
     or (v_cupom.valido_ate is not null and v_cupom.valido_ate < v_hoje)
     or (v_cupom.limite_usos is not null and v_cupom.usos >= v_cupom.limite_usos) then
    return null;
  end if;
  return jsonb_build_object(
    'codigo', v_cupom.codigo,
    'tipo', v_cupom.tipo,
    'valor', v_cupom.valor,
    'produtos', cupom_produtos_validos(v_cupom),
    'meio', v_cupom.meio,
    'ufs', to_jsonb(v_cupom.ufs),
    'cidades', to_jsonb(v_cupom.cidades));
end;
$function$;

-- ── tentativa de cobrança: o valor depende do meio ─────────────────────────
drop function public.loja_checkout_tentar(text, uuid);
create function public.loja_checkout_tentar(p_dominio text, p_id uuid, p_meio text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v public.loja_checkouts;
begin
  select * into v from loja_checkouts where id = p_id and dominio = lower(btrim(p_dominio)) for update;
  if not found then
    return jsonb_build_object('resultado', 'nao_encontrado');
  end if;
  if v.status = 'pago' then
    return jsonb_build_object('resultado', 'pago');
  end if;
  if v.status <> 'aberto' or v.expira_em < now() or v.entrega_tipo is null then
    return jsonb_build_object('resultado', 'fechado');
  end if;
  if v.tentativas >= 10 then
    return jsonb_build_object('resultado', 'limite');
  end if;
  update loja_checkouts set tentativas = tentativas + 1, updated_at = now() where id = v.id;
  return jsonb_build_object(
    'resultado', 'ok',
    'tentativa', v.tentativas + 1,
    'total', v.total - case when v.desconto_meio > 0 and v.cupom_regras ->> 'meio' = p_meio then v.desconto_meio else 0 end,
    'nome', v.nome,
    'email', v.email,
    'mp_order_id', v.mp_order_id,
    'mp_meio', v.mp_meio
  );
end;
$function$;
revoke all on function public.loja_checkout_tentar(text, uuid, text) from public, anon, authenticated;
grant execute on function public.loja_checkout_tentar(text, uuid, text) to service_role;

-- ── troca de trechos nas funções grandes ───────────────────────────────────
-- Cada trecho precisa aparecer exatamente uma vez; senão a migration para.
do $migra$
declare
  v_def text;
  v_troca record;
  v_n integer;
begin
  for v_troca in
    select * from (values
      -- loja_checkout_abrir
      (1, 'loja_checkout_abrir(text,jsonb,text,text,text,text,uuid,text)',
       $a$  v_desconto numeric := 0;
$a$,
       $b$  v_desconto numeric := 0;
  v_elegivel numeric := 0;
  v_desconto_meio numeric := 0;
  v_regras jsonb;
$b$),
      (2, 'loja_checkout_abrir(text,jsonb,text,text,text,text,uuid,text)',
       $a$    v_subtotal := v_subtotal + v_qtd * v_preco;
$a$,
       $b$    v_subtotal := v_subtotal + v_qtd * v_preco;
    if v_cupom.id is not null and cupom_vale_produto(v_cupom, v_produto) then
      v_elegivel := v_elegivel + v_qtd * v_preco;
    end if;
$b$),
      (3, 'loja_checkout_abrir(text,jsonb,text,text,text,text,uuid,text)',
       $a$  if v_cupom.id is not null then
    v_desconto := least(
      case when v_cupom.tipo = 'percentual' then round(v_subtotal * v_cupom.valor / 100, 2)
           else round(v_cupom.valor, 2) end,
      greatest(v_subtotal - 1, 0));
  end if;
$a$,
       $b$  -- Desconto só nos produtos em que o cupom vale. Cupom só do Pix (ou do cartão)
  -- guarda o desconto à parte: ele entra na cobrança só se o meio bater.
  if v_cupom.id is not null and v_cupom.tipo <> 'frete_gratis' then
    if v_elegivel <= 0 then
      return jsonb_build_object('resultado', 'cupom');
    end if;
    v_desconto := least(
      case when v_cupom.tipo = 'percentual' then round(v_elegivel * v_cupom.valor / 100, 2)
           else round(v_cupom.valor, 2) end,
      v_elegivel,
      greatest(v_subtotal - 1, 0));
    if v_cupom.meio is not null then
      v_desconto_meio := v_desconto;
      v_desconto := 0;
    end if;
  end if;
  if v_cupom.id is not null then
    v_regras := jsonb_build_object('tipo', v_cupom.tipo, 'meio', v_cupom.meio,
      'ufs', to_jsonb(v_cupom.ufs), 'cidades', to_jsonb(v_cupom.cidades));
  end if;
$b$),
      (4, 'loja_checkout_abrir(text,jsonb,text,text,text,text,uuid,text)',
       $a$subtotal, desconto, cupom_codigo, total,$a$,
       $b$subtotal, desconto, desconto_meio, cupom_regras, cupom_codigo, total,$b$),
      (5, 'loja_checkout_abrir(text,jsonb,text,text,text,text,uuid,text)',
       $a$v_subtotal, v_desconto, v_cupom.codigo,$a$,
       $b$v_subtotal, v_desconto, v_desconto_meio, v_regras, v_cupom.codigo,$b$),
      (6, 'loja_checkout_abrir(text,jsonb,text,text,text,text,uuid,text)',
       $a$'desconto', v_desconto, 'cupom', v_cupom.codigo,$a$,
       $b$'desconto', v_desconto, 'cupom', v_cupom.codigo,
    'desconto_meio', v_desconto_meio, 'cupom_meio', v_cupom.meio,
    'frete_gratis', coalesce(v_cupom.tipo = 'frete_gratis', false),$b$),

      -- loja_checkout_definir_entrega
      (7, 'loja_checkout_definir_entrega(text,uuid,text,numeric,jsonb,jsonb,text)',
       $a$  v_envio jsonb;
$a$,
       $b$  v_envio jsonb;
  v_gratis boolean := false;
$b$),
      (8, 'loja_checkout_definir_entrega(text,uuid,text,numeric,jsonb,jsonb,text)',
       $a$  update loja_checkouts
     set entrega_tipo = 'frete', frete = v_frete,$a$,
       $b$  -- Cupom de frete grátis: zera o frete quando o endereço bate com o lugar do cupom.
  if cupom_frete_vale(v.cupom_regras, p_endereco) then
    v_frete := 0;
    v_gratis := true;
  end if;

  update loja_checkouts
     set entrega_tipo = 'frete', frete = v_frete, frete_gratis = v_gratis,$b$),

      -- loja_checkout_situacao
      (9, 'loja_checkout_situacao(text,uuid)',
       $a$'cupom', c.cupom_codigo,$a$,
       $b$'cupom', c.cupom_codigo,
    'desconto_meio', c.desconto_meio,
    'cupom_meio', c.cupom_regras ->> 'meio',
    'frete_gratis', c.frete_gratis,$b$),

      -- loja_checkout_confirmar
      (10, 'loja_checkout_confirmar(text,uuid,text,numeric,numeric,text)',
       $a$  v_entrega_texto text;
$a$,
       $b$  v_entrega_texto text;
  v_cupom_vale boolean := false;
$b$),
      (11, 'loja_checkout_confirmar(text,uuid,text,numeric,numeric,text)',
       $a$  if p_valor is null or abs(p_valor - v.total) > 0.01 then
    return jsonb_build_object('resultado', 'valor_diferente');
  end if;
$a$,
       $b$  -- Cupom só do Pix (ou do cartão): a order sai com o desconto só quando o meio bate,
  -- então o valor pago diz se ele valeu.
  if p_valor is not null and v.desconto_meio > 0 and abs(p_valor - (v.total - v.desconto_meio)) <= 0.01 then
    v.desconto := v.desconto + v.desconto_meio;
    v.total := v.total - v.desconto_meio;
    v_cupom_vale := true;
    update loja_checkouts set desconto = v.desconto, total = v.total, updated_at = now() where id = v.id;
  elsif p_valor is null or abs(p_valor - v.total) > 0.01 then
    return jsonb_build_object('resultado', 'valor_diferente');
  else
    v_cupom_vale := v.cupom_codigo is not null and (v.desconto > 0 or v.frete_gratis);
  end if;
$b$),
      (12, 'loja_checkout_confirmar(text,uuid,text,numeric,numeric,text)',
       $a$nullif(btrim(p_meio), ''), v_entrega_texto,$a$,
       $b$nullif(btrim(p_meio), ''), v_entrega_texto,
      case when v.frete_gratis then 'Frete grátis pelo cupom ' || v.cupom_codigo || ': a etiqueta fica por conta da marca' end,$b$),
      (13, 'loja_checkout_confirmar(text,uuid,text,numeric,numeric,text)',
       $a$forma_do_meio_mp(p_meio, v.mp_meio), v.cupom_codigo$a$,
       $b$forma_do_meio_mp(p_meio, v.mp_meio), case when v_cupom_vale then v.cupom_codigo end$b$),
      (14, 'loja_checkout_confirmar(text,uuid,text,numeric,numeric,text)',
       $a$  if v.cupom_codigo is not null then
    update catalogo_cupons$a$,
       $b$  if v_cupom_vale then
    update catalogo_cupons$b$),
      (15, 'loja_checkout_confirmar(text,uuid,text,numeric,numeric,text)',
       $a$'cupom', v.cupom_codigo,$a$,
       $b$'cupom', case when v_cupom_vale then v.cupom_codigo end,
    'frete_gratis', v.frete_gratis,$b$),

      -- registrar_pedido_loja (Vitrine online)
      (16, 'registrar_pedido_loja(text,text,jsonb,text,text,text,text,text)',
       $a$  v_desconto numeric := 0;
$a$,
       $b$  v_desconto numeric := 0;
  v_elegivel numeric := 0;
$b$),
      (17, 'registrar_pedido_loja(text,text,jsonb,text,text,text,text,text)',
       $a$       or (v_cupom.limite_usos is not null and v_cupom.usos >= v_cupom.limite_usos) then
      return 'cupom';
    end if;
    v_desconto := least(
      case when v_cupom.tipo = 'percentual' then round(v_subtotal * v_cupom.valor / 100, 2)
           else round(v_cupom.valor, 2) end,
      v_subtotal);
$a$,
       $b$       or (v_cupom.limite_usos is not null and v_cupom.usos >= v_cupom.limite_usos)
       -- Pix e frete grátis só existem na loja da marca: a Vitrine não cobra nem calcula frete.
       or v_cupom.tipo = 'frete_gratis' or v_cupom.meio is not null then
      return 'cupom';
    end if;
    select coalesce(sum((i ->> 'quantidade')::integer * round(preco_que_vale(p), 2)), 0) into v_elegivel
      from jsonb_array_elements(p_itens) i
      join produtos p on p.id = (i ->> 'produto_id')::uuid and p.user_id = v_uid
     where cupom_vale_produto(v_cupom, p);
    if v_elegivel <= 0 then
      return 'cupom';
    end if;
    v_desconto := least(
      case when v_cupom.tipo = 'percentual' then round(v_elegivel * v_cupom.valor / 100, 2)
           else round(v_cupom.valor, 2) end,
      v_elegivel);
$b$)
    ) as t(ordem, funcao, antes, depois)
    order by ordem
  loop
    v_def := replace(pg_get_functiondef(v_troca.funcao::regprocedure), E'\r\n', E'\n');
    v_n := (char_length(v_def) - char_length(replace(v_def, v_troca.antes, ''))) / char_length(v_troca.antes);
    if v_n <> 1 then
      raise exception 'Trecho % de % aparece % vezes', v_troca.ordem, v_troca.funcao, v_n;
    end if;
    execute replace(v_def, v_troca.antes, v_troca.depois);
  end loop;
end;
$migra$;
