-- Checkout das lojas de marca pelo Mercado Pago (ONE-182, fase 2 do ONE-178).
-- Quem chama é o Worker do polia-lojas, com a service role; a compradora não tem sessão.
--
-- O caminho: a compradora finaliza > loja_checkout_abrir confere preço e estoque no
-- cadastro e reserva > o Worker cria a cobrança > o Mercado Pago avisa > o Worker lê o
-- pagamento na API e chama loja_checkout_confirmar > vira venda recebida, com lançamento.
--
-- A reserva é um movimento de "ajuste" no livro de estoque: o saldo cai na hora para
-- todos os canais, sem outra noção de "disponível". Pagou, vira movimento de venda.
-- Não pagou, o ajuste volta. Nada aqui depende do plano da conta.

create table public.loja_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dominio text not null,
  status text not null default 'aberto' check (status in ('aberto', 'pago', 'expirado', 'estornado')),
  -- Foto do pedido no momento da compra: [{produto_id, sku_id, produto_nome, variacao, tipo, quantidade, preco}].
  itens jsonb not null,
  -- O que foi reservado, somado por variação: [{sku_id, quantidade}].
  baixas jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  frete numeric(12,2) not null default 0 check (frete >= 0),
  total numeric(12,2) not null check (total > 0),
  prazo_dias_uteis integer not null,
  nome text not null check (char_length(nome) between 2 and 120),
  email text not null check (char_length(email) <= 200),
  whatsapp text not null check (whatsapp ~ '^[0-9]{12,13}$'),
  ip_hash text,
  mp_preference_id text,
  mp_payment_id text,
  venda_id uuid references public.vendas(id) on delete set null,
  expira_em timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index loja_checkouts_abertos on public.loja_checkouts (expira_em) where status = 'aberto';
create index loja_checkouts_ip on public.loja_checkouts (ip_hash, created_at) where ip_hash is not null;
create index loja_checkouts_marca on public.loja_checkouts (user_id, created_at);
create unique index loja_checkouts_pagamento on public.loja_checkouts (mp_payment_id) where mp_payment_id is not null;

-- Sem política: só a service role lê e grava. A dona vê o pedido em vendas.
alter table public.loja_checkouts enable row level security;

-- ── reserva volta para o estoque ──────────────────────────────────────────
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
  update loja_checkouts set status = p_status, updated_at = now() where id = p_id;
end;
$$;

-- ── abrir ─────────────────────────────────────────────────────────────────
-- Preço, nome e disponibilidade saem do cadastro; do navegador só vem o que foi escolhido.
-- p_anterior: tentativa anterior da mesma compradora, que devolve a reserva antes de refazer.
-- Resultado: ok | invalido | fechada | limite | indisponivel (com "produto").
create or replace function public.loja_checkout_abrir(
  p_dominio text,
  p_itens jsonb,
  p_nome text,
  p_email text,
  p_whatsapp text,
  p_ip_hash text default null,
  p_anterior uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dominio text := lower(btrim(p_dominio));
  v_nome text := left(btrim(coalesce(p_nome, '')), 120);
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_ip text := left(nullif(btrim(p_ip_hash), ''), 128);
  v_uid uuid;
  v_prazo_loja integer;
  v_prazo integer := 1;
  v_item jsonb;
  v_produto public.produtos;
  v_qtd integer;
  v_sku_id uuid;
  v_variacao text;
  v_preco_sku numeric;
  v_preco numeric;
  v_eh_kit boolean;
  v_subtotal numeric := 0;
  v_itens jsonb := '[]'::jsonb;
  v_pedidas jsonb := '[]'::jsonb;
  v_baixas jsonb := '[]'::jsonb;
  v_comp record;
  v_comp_sku uuid;
  v_linha record;
  v_id uuid;
begin
  if char_length(v_nome) < 2 or char_length(v_email) > 200
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or p_whatsapp is null or p_whatsapp !~ '^[0-9]{12,13}$'
     or p_itens is null or jsonb_typeof(p_itens) <> 'array'
     or jsonb_array_length(p_itens) = 0 or jsonb_array_length(p_itens) > 50 then
    return jsonb_build_object('resultado', 'invalido');
  end if;

  select l.user_id, l.prazo_dias_uteis into v_uid, v_prazo_loja
    from lojas_marca l join profiles p on p.id = l.user_id
   where l.dominio = v_dominio and l.ativa and nullif(btrim(p.business_name), '') is not null;
  if v_uid is null then
    return jsonb_build_object('resultado', 'fechada');
  end if;

  -- A reserva segura estoque: sem limite, uma pessoa só esvaziaria a loja sem pagar.
  if (v_ip is not null and (select count(*) from loja_checkouts
        where ip_hash = v_ip and created_at > now() - interval '1 hour') >= 10)
     or (select count(*) from loja_checkouts
        where user_id = v_uid and created_at > now() - interval '1 day') >= 500 then
    return jsonb_build_object('resultado', 'limite');
  end if;

  if p_anterior is not null and exists (
    select 1 from loja_checkouts where id = p_anterior and user_id = v_uid and status = 'aberto'
  ) then
    perform loja_checkout_liberar(p_anterior, 'expirado');
  end if;

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
    v_eh_kit := exists (select 1 from produto_componentes where kit_id = v_produto.id and user_id = v_uid);

    v_sku_id := null;
    v_variacao := null;
    v_preco_sku := null;
    if v_item ->> 'sku_id' is not null then
      select id, variacao, preco_venda into v_sku_id, v_variacao, v_preco_sku from produto_skus
       where id = (v_item ->> 'sku_id')::uuid and produto_id = v_produto.id and user_id = v_uid
         and not arquivado and variacao is not null;
      if not found then
        return jsonb_build_object('resultado', 'indisponivel', 'produto', v_produto.nome);
      end if;
    elsif exists (
      select 1 from produto_skus
       where produto_id = v_produto.id and user_id = v_uid and not arquivado and variacao is not null
    ) then
      return jsonb_build_object('resultado', 'indisponivel', 'produto', v_produto.nome);
    end if;

    v_preco := round(coalesce(v_preco_sku, v_produto.preco_venda), 2);
    if v_preco is null or v_preco < 0 then
      return jsonb_build_object('resultado', 'indisponivel', 'produto', v_produto.nome);
    end if;
    v_subtotal := v_subtotal + v_qtd * v_preco;

    -- Kit não tem estoque próprio: quem baixa são os itens dele, como em registrar_venda.
    if v_eh_kit then
      for v_comp in
        select c.componente_id, c.sku_id, c.quantidade, p.controla_estoque, p.arquivado
          from produto_componentes c join produtos p on p.id = c.componente_id
         where c.kit_id = v_produto.id and c.user_id = v_uid
      loop
        if v_comp.arquivado then
          return jsonb_build_object('resultado', 'indisponivel', 'produto', v_produto.nome);
        end if;
        continue when not v_comp.controla_estoque;
        v_comp_sku := v_comp.sku_id;
        if v_comp_sku is null then
          select id into v_comp_sku from produto_skus
           where produto_id = v_comp.componente_id and user_id = v_uid and variacao is null and not arquivado
           limit 1;
        elsif exists (select 1 from produto_skus where id = v_comp_sku and arquivado) then
          v_comp_sku := null;
        end if;
        if v_comp_sku is null then
          return jsonb_build_object('resultado', 'indisponivel', 'produto', v_produto.nome);
        end if;
        v_pedidas := v_pedidas || jsonb_build_object('sku_id', v_comp_sku, 'quantidade', v_qtd * v_comp.quantidade, 'produto', v_produto.nome);
      end loop;
    elsif v_produto.controla_estoque then
      if v_sku_id is null then
        select id into v_sku_id from produto_skus
         where produto_id = v_produto.id and user_id = v_uid and variacao is null and not arquivado
         limit 1;
        if v_sku_id is null then
          return jsonb_build_object('resultado', 'indisponivel', 'produto', v_produto.nome);
        end if;
      end if;
      v_pedidas := v_pedidas || jsonb_build_object('sku_id', v_sku_id, 'quantidade', v_qtd, 'produto', v_produto.nome);
    end if;

    -- Prazo do pedido: o mais longo dos itens. Item em estoque sai em 1 dia útil.
    if not v_produto.controla_estoque then
      v_prazo := greatest(v_prazo, coalesce(v_produto.prazo_dias_uteis, v_prazo_loja));
    end if;

    v_itens := v_itens || jsonb_build_object(
      'produto_id', v_produto.id,
      'sku_id', v_sku_id,
      'produto_nome', left(btrim(v_produto.nome), 200),
      'variacao', left(v_variacao, 80),
      'tipo', v_produto.tipo,
      'quantidade', v_qtd,
      'preco', v_preco
    );
  end loop;

  if v_subtotal <= 0 then
    return jsonb_build_object('resultado', 'indisponivel', 'produto', null);
  end if;

  -- Trava em ordem de id, para duas compras ao mesmo tempo não se travarem uma à outra.
  perform 1 from produto_skus
   where id in (select (e ->> 'sku_id')::uuid from jsonb_array_elements(v_pedidas) e)
   order by id for update;
  for v_linha in
    select (e ->> 'sku_id')::uuid sku_id, sum((e ->> 'quantidade')::integer)::integer quantidade, min(e ->> 'produto') produto
      from jsonb_array_elements(v_pedidas) e
     group by 1 order by 1
  loop
    if coalesce((select sum(m.quantidade) from estoque_movimentos m where m.sku_id = v_linha.sku_id), 0) < v_linha.quantidade then
      return jsonb_build_object('resultado', 'indisponivel', 'produto', v_linha.produto);
    end if;
    v_baixas := v_baixas || jsonb_build_object('sku_id', v_linha.sku_id, 'quantidade', v_linha.quantidade);
  end loop;

  insert into loja_checkouts (
    user_id, dominio, itens, baixas, subtotal, total, prazo_dias_uteis, nome, email, whatsapp, ip_hash, expira_em
  ) values (
    v_uid, v_dominio, v_itens, v_baixas, v_subtotal, v_subtotal, least(v_prazo, 120), v_nome, v_email, p_whatsapp, v_ip,
    now() + interval '30 minutes'
  ) returning id into v_id;

  insert into estoque_movimentos (user_id, sku_id, tipo, quantidade, motivo)
  select v_uid, (b ->> 'sku_id')::uuid, 'ajuste', -(b ->> 'quantidade')::integer, 'reserva da loja'
    from jsonb_array_elements(v_baixas) b;

  return jsonb_build_object('resultado', 'ok', 'id', v_id, 'total', v_subtotal, 'itens', v_itens, 'expira_em', now() + interval '30 minutes');
end;
$$;

-- ── guardar a cobrança criada, ou desistir se ela não saiu ─────────────────
create or replace function public.loja_checkout_preferencia(p_dominio text, p_id uuid, p_preference_id text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update loja_checkouts set mp_preference_id = left(p_preference_id, 200), updated_at = now()
   where id = p_id and dominio = lower(btrim(p_dominio)) and status = 'aberto';
$$;

create or replace function public.loja_checkout_desistir(p_dominio text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from loja_checkouts where id = p_id and dominio = lower(btrim(p_dominio))) then
    perform loja_checkout_liberar(p_id, 'expirado');
  end if;
end;
$$;

-- ── pagamento aprovado: vira venda ─────────────────────────────────────────
-- Só é chamada com dados lidos na API do Mercado Pago, nunca com o que veio no aviso.
-- Idempotente pelo checkout: o aviso repetido devolve "repetido" e não grava nada.
-- Pagamento depois da reserva vencer ainda vira venda, porque o dinheiro entrou.
-- Resultado: novo | repetido | outro_pagamento | estornado | valor_diferente | nao_encontrado.
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

  insert into vendas (
    id, user_id, canal, id_externo, data, status, categoria, cliente_id, cliente_nome,
    subtotal, desconto, frete, taxa_canal, total, custo_total, observacao, andamento, entrega_em
  ) values (
    v_venda_id, v.user_id, 'site', v.id::text, v_hoje, 'recebida', v_categoria, v_cliente_id, v.nome,
    v.subtotal, 0, v.frete, v_taxa, v.total,
    case when v_custo_conhecido then round(v_custo, 2) end,
    left(concat_ws(' · ', 'E-mail: ' || v.email, 'WhatsApp: ' || v.whatsapp, nullif(btrim(p_meio), ''),
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
    'entrega_em', v_entrega,
    'tarde', v_tarde
  );
end;
$$;

-- ── pagamento devolvido ou contestado ──────────────────────────────────────
-- Resultado: estornado | sem_efeito.
create or replace function public.loja_checkout_estornar(p_dominio text, p_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.loja_checkouts;
begin
  select * into v from loja_checkouts where id = p_id and dominio = lower(btrim(p_dominio)) for update;
  if not found or v.status in ('estornado', 'expirado') then
    return 'sem_efeito';
  end if;
  if v.status = 'aberto' then
    perform loja_checkout_liberar(v.id, 'estornado');
    return 'estornado';
  end if;

  perform cancelar_venda_canal(v.user_id, 'site', v.id::text);
  update loja_checkouts set status = 'estornado', updated_at = now() where id = v.id;
  begin
    insert into avisos (user_id, tipo, titulo, corpo, valor, link, ref_id)
    values (v.user_id, 'pedido', 'Pagamento da loja devolvido', left(v.nome || '. Pedido cancelado: se já saiu, confira o estoque.', 300), v.total, '/pedidos', v.id)
    on conflict (tipo, ref_id) do nothing;
  exception when others then
    raise warning 'loja_checkout_estornar aviso: %', sqlerrm;
  end;
  return 'estornado';
end;
$$;

-- ── o que a página de retorno mostra ──────────────────────────────────────
-- Quem tem o id é quem comprou (uuid vindo do próprio retorno). E-mail e WhatsApp não saem daqui.
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
    'total', c.total,
    'entrega_em', (select v.entrega_em from vendas v where v.id = c.venda_id)
  )
  from loja_checkouts c
  where c.id = p_id and c.dominio = lower(btrim(p_dominio));
$$;

-- ── reserva vencida ───────────────────────────────────────────────────────
-- A cobrança vale 30 minutos. A reserva espera mais 30, porque um Pix gerado no fim
-- do prazo ainda pode ser pago.
create or replace function public.loja_checkouts_expirar()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_total integer := 0;
begin
  for v_id in
    select id from loja_checkouts
     where status = 'aberto' and expira_em < now() - interval '30 minutes'
     order by expira_em limit 200
     for update skip locked
  loop
    perform loja_checkout_liberar(v_id, 'expirado');
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;

select cron.schedule('loja-checkouts-expirar', '*/5 * * * *', $$select public.loja_checkouts_expirar()$$);

revoke all on table public.loja_checkouts from public, anon, authenticated;
do $$
declare
  f text;
begin
  foreach f in array array[
    'loja_checkout_liberar(uuid, text)',
    'loja_checkout_abrir(text, jsonb, text, text, text, text, uuid)',
    'loja_checkout_preferencia(text, uuid, text)',
    'loja_checkout_desistir(text, uuid)',
    'loja_checkout_confirmar(text, uuid, text, numeric, numeric, text)',
    'loja_checkout_estornar(text, uuid)',
    'loja_checkout_situacao(text, uuid)',
    'loja_checkouts_expirar()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
