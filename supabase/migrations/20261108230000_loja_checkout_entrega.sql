-- Frete pelo Melhor Envio, etapa 2 (ONE-189): a entrega no checkout da loja.
--
-- O navegador só escolhe. O Worker pede a loja_envio_preparar (medidas e valores saem do
-- cadastro), cota na função melhor-envio, reserva pela loja_checkout_abrir de sempre e grava
-- o frete cotado no servidor pela loja_checkout_definir_entrega. Sem entrega definida, a
-- compra não paga.
--
-- CPF e endereço ficam só aqui, sem política de leitura: só a service role alcança. Compra
-- que não foi paga perde os dois quando a reserva cai.

alter table public.loja_checkouts
  add column entrega_tipo text check (entrega_tipo in ('frete', 'retirada')),
  -- {id, nome, empresa, prazo, pacotes}: o que a etiqueta vai precisar na etapa 3.
  add column frete_servico jsonb check (frete_servico is null or octet_length(frete_servico::text) <= 4000),
  -- {cep, rua, numero, complemento, bairro, cidade, uf}
  add column endereco jsonb check (endereco is null or octet_length(endereco::text) <= 1000),
  add column cpf text check (cpf is null or cpf ~ '^[0-9]{11}$');

-- Cada cotação gasta chamada no Melhor Envio com o token da marca: limite por aparelho.
create table public.loja_frete_contagem (
  ip_hash text not null,
  hora timestamptz not null,
  n integer not null default 1,
  primary key (ip_hash, hora)
);
alter table public.loja_frete_contagem enable row level security;
revoke all on table public.loja_frete_contagem from public, anon, authenticated;

-- ── o que a cotação precisa ───────────────────────────────────────────────
-- Do navegador só vêm produto, variação e quantidade. Valor e medidas saem do cadastro;
-- produto sem medida usa a caixa padrão da loja. "frete" só é verdadeiro com tudo que a
-- etiqueta vai exigir, para a loja não vender o que não consegue despachar.
-- Resultado: ok | invalido | fechada | limite | indisponivel (com "produto").
create or replace function public.loja_envio_preparar(p_dominio text, p_itens jsonb, p_ip_hash text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dominio text := lower(btrim(p_dominio));
  v_ip text := left(nullif(btrim(p_ip_hash), ''), 128);
  v_uid uuid;
  v_envio jsonb;
  v_prazo_loja integer;
  v_prazo integer := 1;
  v_caixa jsonb;
  v_cep text;
  v_n integer;
  v_item jsonb;
  v_produto public.produtos;
  v_qtd integer;
  v_preco_sku numeric;
  v_preco numeric;
  v_peso numeric;
  v_altura numeric;
  v_largura numeric;
  v_comprimento numeric;
  v_medidas_ok boolean := true;
  v_produtos jsonb := '[]'::jsonb;
  v_frete boolean;
  v_retirada boolean;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array'
     or jsonb_array_length(p_itens) = 0 or jsonb_array_length(p_itens) > 50 then
    return jsonb_build_object('resultado', 'invalido');
  end if;

  select l.user_id, l.envio, l.prazo_dias_uteis into v_uid, v_envio, v_prazo_loja
    from lojas_marca l join profiles p on p.id = l.user_id
   where l.dominio = v_dominio and l.ativa and nullif(btrim(p.business_name), '') is not null;
  if v_uid is null then
    return jsonb_build_object('resultado', 'fechada');
  end if;

  if v_ip is not null then
    insert into loja_frete_contagem (ip_hash, hora) values (v_ip, date_trunc('hour', now()))
    on conflict (ip_hash, hora) do update set n = loja_frete_contagem.n + 1
    returning n into v_n;
    delete from loja_frete_contagem where hora < now() - interval '1 day';
    if v_n > 120 then
      return jsonb_build_object('resultado', 'limite');
    end if;
  end if;

  v_caixa := coalesce(v_envio -> 'caixa_padrao', '{}'::jsonb);
  v_cep := v_envio ->> 'cep_origem';

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item ->> 'quantidade')::integer;
    if v_qtd is null or v_qtd < 1 or v_qtd > 99 then
      return jsonb_build_object('resultado', 'invalido');
    end if;
    select * into v_produto from produtos
     where id = (v_item ->> 'produto_id')::uuid and user_id = v_uid and not arquivado and no_catalogo;
    if not found then
      return jsonb_build_object('resultado', 'indisponivel', 'produto', null);
    end if;

    v_preco_sku := null;
    if v_item ->> 'sku_id' is not null then
      select preco_venda into v_preco_sku from produto_skus
       where id = (v_item ->> 'sku_id')::uuid and produto_id = v_produto.id and user_id = v_uid
         and not arquivado and variacao is not null;
      if not found then
        return jsonb_build_object('resultado', 'indisponivel', 'produto', v_produto.nome);
      end if;
    end if;
    v_preco := round(coalesce(v_preco_sku, v_produto.preco_venda), 2);
    if v_preco is null or v_preco < 0 then
      return jsonb_build_object('resultado', 'indisponivel', 'produto', v_produto.nome);
    end if;

    v_peso := coalesce(v_produto.peso_kg, (v_caixa ->> 'peso_kg')::numeric);
    v_altura := coalesce(v_produto.altura_cm, (v_caixa ->> 'altura_cm')::numeric);
    v_largura := coalesce(v_produto.largura_cm, (v_caixa ->> 'largura_cm')::numeric);
    v_comprimento := coalesce(v_produto.comprimento_cm, (v_caixa ->> 'comprimento_cm')::numeric);
    if v_peso is null or v_altura is null or v_largura is null or v_comprimento is null then
      v_medidas_ok := false;
    end if;

    -- Mesma regra do prazo na loja_checkout_abrir.
    if not v_produto.controla_estoque then
      v_prazo := greatest(v_prazo, coalesce(v_produto.prazo_dias_uteis, v_prazo_loja));
    end if;

    v_produtos := v_produtos || jsonb_build_object(
      'id', v_produto.id,
      'quantidade', v_qtd,
      'peso_kg', v_peso,
      'altura_cm', v_altura,
      'largura_cm', v_largura,
      'comprimento_cm', v_comprimento,
      'valor', v_preco
    );
  end loop;

  v_frete := v_medidas_ok
    and coalesce(v_cep ~ '^[0-9]{8}$', false)
    and exists (select 1 from canal_conexoes where user_id = v_uid and canal = 'melhor_envio' and status = 'conectada')
    and not exists (
      select 1 from unnest(array['nome', 'documento', 'telefone', 'email', 'cep', 'rua', 'numero', 'bairro', 'cidade', 'uf']) k
       where coalesce(btrim(v_envio -> 'remetente' ->> k), '') = ''
    );
  v_retirada := (v_envio -> 'retirada' ->> 'ativa') = 'true'
    and coalesce(btrim(v_envio -> 'retirada' ->> 'instrucoes'), '') <> '';

  return jsonb_build_object(
    'resultado', 'ok',
    'user_id', v_uid,
    'cep_origem', v_cep,
    'frete', v_frete,
    'retirada', coalesce(v_retirada, false),
    'prazo_producao', least(v_prazo, 120),
    'produtos', v_produtos
  );
end;
$$;

-- ── a entrega da compra ───────────────────────────────────────────────────
-- Só o Worker chama, com o frete que ele mesmo cotou. Vale uma vez por compra.
-- Resultado: ok | invalido | fechado | repetido.
create or replace function public.loja_checkout_definir_entrega(
  p_dominio text,
  p_id uuid,
  p_tipo text,
  p_frete numeric default 0,
  p_servico jsonb default null,
  p_endereco jsonb default null,
  p_cpf text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.loja_checkouts;
  v_frete numeric := round(coalesce(p_frete, 0), 2);
  v_envio jsonb;
begin
  select * into v from loja_checkouts
   where id = p_id and dominio = lower(btrim(p_dominio)) and status = 'aberto' for update;
  if not found then
    return 'fechado';
  end if;
  if v.entrega_tipo is not null then
    return 'repetido';
  end if;

  if p_tipo = 'retirada' then
    select envio into v_envio from lojas_marca where user_id = v.user_id and dominio = v.dominio;
    if (v_envio -> 'retirada' ->> 'ativa') is distinct from 'true' then
      return 'invalido';
    end if;
    update loja_checkouts
       set entrega_tipo = 'retirada', frete = 0, total = subtotal, updated_at = now()
     where id = v.id;
    return 'ok';
  end if;

  if p_tipo is distinct from 'frete' or v_frete < 0 or v_frete > 9999
     or p_servico is null or jsonb_typeof(p_servico) <> 'object'
     or p_endereco is null or jsonb_typeof(p_endereco) <> 'object'
     or p_cpf is null or p_cpf !~ '^[0-9]{11}$'
     or exists (
       select 1 from unnest(array['cep', 'rua', 'numero', 'bairro', 'cidade', 'uf']) k
        where coalesce(btrim(p_endereco ->> k), '') = ''
     ) then
    return 'invalido';
  end if;

  update loja_checkouts
     set entrega_tipo = 'frete', frete = v_frete, total = subtotal + v_frete,
         frete_servico = p_servico, endereco = p_endereco, cpf = p_cpf, updated_at = now()
   where id = v.id;
  return 'ok';
end;
$$;

-- ── reserva volta para o estoque ──────────────────────────────────────────
-- Igual à de 20261106160000, e quem não pagou não deixa CPF nem endereço guardados.
create or replace function public.loja_checkout_liberar(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.loja_checkouts;
begin
  select * into v from loja_checkouts where id = p_id and status = 'aberto' for update;
  if not found then
    return;
  end if;
  insert into estoque_movimentos (user_id, sku_id, tipo, quantidade, motivo)
  select v.user_id, (b ->> 'sku_id')::uuid, 'ajuste', (b ->> 'quantidade')::integer, 'reserva da loja liberada'
    from jsonb_array_elements(v.baixas) b;
  update loja_checkouts set status = p_status, cpf = null, endereco = null, updated_at = now() where id = p_id;
end;
$$;

-- ── nova tentativa de pagar ───────────────────────────────────────────────
-- Igual à de 20261107180000, e compra sem entrega definida não cobra.
create or replace function public.loja_checkout_tentar(p_dominio text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
    'total', v.total,
    'nome', v.nome,
    'email', v.email,
    'mp_order_id', v.mp_order_id,
    'mp_meio', v.mp_meio
  );
end;
$$;

-- ── pagamento aprovado: vira venda ─────────────────────────────────────────
-- Igual à de 20261106160000, com a entrega na observação da venda e no retorno, para os
-- e-mails. O CPF não sai daqui.
create or replace function public.loja_checkout_confirmar(
  p_dominio text,
  p_id uuid,
  p_payment_id text,
  p_valor numeric,
  p_taxa numeric default 0,
  p_meio text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.loja_checkouts;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_tarde boolean;
  v_taxa numeric := greatest(round(coalesce(p_taxa, 0), 2), 0);
  v_venda_id uuid := gen_random_uuid();
  v_cliente_id uuid;
  v_entrega date;
  v_dias integer;
  v_item jsonb;
  v_produto public.produtos;
  v_custo_item numeric;
  v_custo numeric := 0;
  v_custo_conhecido boolean := true;
  v_so_servico boolean := true;
  v_categoria text;
  v_lancamento_id uuid;
  v_marca text;
  v_email_dona text;
  v_endereco text;
  v_instrucoes text;
  v_entrega_texto text;
begin
  select * into v from loja_checkouts where id = p_id and dominio = lower(btrim(p_dominio)) for update;
  if not found then
    return jsonb_build_object('resultado', 'nao_encontrado');
  end if;
  if v.status = 'pago' then
    return jsonb_build_object('resultado', case when v.mp_payment_id = p_payment_id then 'repetido' else 'outro_pagamento' end);
  end if;
  if v.status = 'estornado' then
    return jsonb_build_object('resultado', 'estornado');
  end if;
  if p_valor is null or abs(p_valor - v.total) > 0.01 then
    return jsonb_build_object('resultado', 'valor_diferente');
  end if;
  v_tarde := v.status = 'expirado';

  select id into v_cliente_id from clientes where user_id = v.user_id and whatsapp = v.whatsapp;
  if v_cliente_id is null then
    insert into clientes (user_id, nome, contato, whatsapp, origem, status_pedido)
    values (v.user_id, v.nome, v.email, v.whatsapp, 'site', 'Em produção')
    on conflict (user_id, whatsapp) where whatsapp is not null do nothing
    returning id into v_cliente_id;
    if v_cliente_id is null then
      select id into v_cliente_id from clientes where user_id = v.user_id and whatsapp = v.whatsapp;
    end if;
  end if;

  v_entrega := v_hoje;
  v_dias := v.prazo_dias_uteis;
  while v_dias > 0 loop
    v_entrega := v_entrega + 1;
    if extract(isodow from v_entrega) < 6 then
      v_dias := v_dias - 1;
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(v.itens) loop
    select * into v_produto from produtos where id = (v_item ->> 'produto_id')::uuid and user_id = v.user_id;
    v_custo_item := case when found then custo_do_item(v_produto, v.user_id) end;
    if v_custo_item is null then
      v_custo_conhecido := false;
    else
      v_custo := v_custo + (v_item ->> 'quantidade')::integer * v_custo_item;
    end if;
    if v_item ->> 'tipo' is distinct from 'servico' then
      v_so_servico := false;
    end if;
  end loop;
  v_categoria := case when v_so_servico then 'Prestação de serviço' else 'Venda de produto' end;

  if v.endereco is not null then
    v_endereco := concat_ws(', ',
      nullif(btrim(concat_ws(' ', v.endereco ->> 'rua', v.endereco ->> 'numero')), ''),
      nullif(btrim(v.endereco ->> 'complemento'), ''),
      nullif(btrim(v.endereco ->> 'bairro'), ''),
      nullif(btrim(concat_ws('/', v.endereco ->> 'cidade', v.endereco ->> 'uf')), ''),
      'CEP ' || (v.endereco ->> 'cep'));
  end if;
  if v.entrega_tipo = 'retirada' then
    select envio -> 'retirada' ->> 'instrucoes' into v_instrucoes
      from lojas_marca where user_id = v.user_id and dominio = v.dominio;
    v_entrega_texto := 'Retirada com a marca';
  elsif v.entrega_tipo = 'frete' then
    v_entrega_texto := concat_ws(': ', 'Entrega ' || coalesce(v.frete_servico ->> 'nome', ''), v_endereco);
  end if;

  insert into vendas (
    id, user_id, canal, id_externo, data, status, categoria, cliente_id, cliente_nome,
    subtotal, desconto, frete, taxa_canal, total, custo_total, observacao, andamento, entrega_em
  ) values (
    v_venda_id, v.user_id, 'site', v.id::text, v_hoje, 'recebida', v_categoria, v_cliente_id, v.nome,
    v.subtotal, 0, v.frete, v_taxa, v.total,
    case when v_custo_conhecido then round(v_custo, 2) end,
    left(concat_ws(' · ', 'E-mail: ' || v.email, 'WhatsApp: ' || v.whatsapp, nullif(btrim(p_meio), ''), v_entrega_texto,
      case when v_tarde then 'Pagamento chegou depois da reserva vencer: confira o estoque' end), 500),
    'a_fazer', v_entrega
  );

  for v_item in select * from jsonb_array_elements(v.itens) loop
    select * into v_produto from produtos where id = (v_item ->> 'produto_id')::uuid and user_id = v.user_id;
    insert into venda_itens (user_id, venda_id, produto_id, sku_id, produto_nome, variacao, quantidade, preco_unitario, custo_unitario)
    values (
      v.user_id, v_venda_id, case when found then v_produto.id end, (v_item ->> 'sku_id')::uuid,
      v_item ->> 'produto_nome', v_item ->> 'variacao', (v_item ->> 'quantidade')::integer,
      (v_item ->> 'preco')::numeric, case when found then custo_do_item(v_produto, v.user_id) end
    );
  end loop;

  -- A reserva vira venda. Se ela já tinha vencido, o estoque já voltou: só baixa.
  if not v_tarde then
    insert into estoque_movimentos (user_id, sku_id, tipo, quantidade, motivo)
    select v.user_id, (b ->> 'sku_id')::uuid, 'ajuste', (b ->> 'quantidade')::integer, 'reserva da loja virou venda'
      from jsonb_array_elements(v.baixas) b;
  end if;
  insert into estoque_movimentos (user_id, sku_id, tipo, quantidade, venda_id)
  select v.user_id, (b ->> 'sku_id')::uuid, 'venda', -(b ->> 'quantidade')::integer, v_venda_id
    from jsonb_array_elements(v.baixas) b;

  if v.total - v_taxa > 0 then
    insert into lancamentos (user_id, tipo, valor, data, descricao, categoria, id_externo)
    values (
      v.user_id, 'entrada', v.total - v_taxa, v_hoje,
      left(concat_ws(' · ', 'Venda', canal_venda_nome('site'), v.nome), 200),
      v_categoria, 'venda:' || v_venda_id
    ) returning id into v_lancamento_id;
    update vendas set lancamento_id = v_lancamento_id where id = v_venda_id;
  end if;

  update loja_checkouts
     set status = 'pago', mp_payment_id = left(p_payment_id, 200), venda_id = v_venda_id, updated_at = now()
   where id = v.id;

  begin
    insert into avisos (user_id, tipo, titulo, corpo, valor, link, ref_id)
    values (
      v.user_id, 'pedido', 'Pedido pago na loja',
      left(concat_ws('. ', v.nome, case when v_tarde then 'Pagamento chegou depois da reserva vencer: confira o estoque' end), 300),
      v.total, '/pedidos', v_venda_id
    ) on conflict (tipo, ref_id) do nothing;
  exception when others then
    raise warning 'loja_checkout_confirmar aviso: %', sqlerrm;
  end;

  select nullif(btrim(business_name), '') into v_marca from profiles where id = v.user_id;
  select email into v_email_dona from auth.users where id = v.user_id;
  return jsonb_build_object(
    'resultado', 'novo',
    'venda_id', v_venda_id,
    'marca', v_marca,
    'email_dona', v_email_dona,
    'nome', v.nome,
    'email', v.email,
    'itens', v.itens,
    'total', v.total,
    'frete', v.frete,
    'entrega_em', v_entrega,
    'tarde', v_tarde,
    'entrega', jsonb_build_object(
      'tipo', v.entrega_tipo,
      'servico', v.frete_servico ->> 'nome',
      'prazo', (v.frete_servico ->> 'prazo')::integer,
      'endereco', v_endereco,
      'instrucoes', v_instrucoes
    )
  );
end;
$$;

-- ── o que a página da compra mostra ───────────────────────────────────────
-- Igual à de 20261107180000, mais o frete. Endereço e CPF não saem daqui, e as instruções
-- da retirada só aparecem para quem já pagou.
create or replace function public.loja_checkout_situacao(p_dominio text, p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'status', c.status,
    'nome', c.nome,
    'itens', c.itens,
    'subtotal', c.subtotal,
    'frete', c.frete,
    'total', c.total,
    'entrega_em', (select v.entrega_em from vendas v where v.id = c.venda_id),
    'expira_em', c.expira_em,
    'mp_order_id', c.mp_order_id,
    'mp_meio', c.mp_meio,
    'entrega', jsonb_build_object(
      'tipo', c.entrega_tipo,
      'servico', c.frete_servico ->> 'nome',
      'prazo', (c.frete_servico ->> 'prazo')::integer,
      'instrucoes', case when c.status = 'pago' and c.entrega_tipo = 'retirada' then
        (select l.envio -> 'retirada' ->> 'instrucoes' from lojas_marca l where l.user_id = c.user_id and l.dominio = c.dominio)
      end
    )
  )
  from loja_checkouts c
  where c.id = p_id and c.dominio = lower(btrim(p_dominio));
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'loja_envio_preparar(text, jsonb, text)',
    'loja_checkout_definir_entrega(text, uuid, text, numeric, jsonb, jsonb, text)',
    'loja_checkout_liberar(uuid, text)',
    'loja_checkout_tentar(text, uuid)',
    'loja_checkout_confirmar(text, uuid, text, numeric, numeric, text)',
    'loja_checkout_situacao(text, uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
