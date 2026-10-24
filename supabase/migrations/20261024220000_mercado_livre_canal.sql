-- Fase 3c, etapa 3c.1 (VND-30): o Mercado Livre entra nas tabelas de canal.
-- Plano: docs/plano-fase3c-mercado-livre.md §3.
--
-- Nenhuma tabela nova: a Fase 3a já guardou o canal em coluna. Aqui só:
-- 1. 'mercado_livre' passa a valer nos checks de canal (e como chave de taxa);
-- 2. verificador do PKCE guardado na conexão, como o state;
-- 3. vendas.custo_envio: frete que a vendedora paga, separado da tarifa
--    (decisão da Sil, 24/10), e a registrar_venda_canal que grava esse valor.

-- ── 1. checks de canal ────────────────────────────────────────────────────
alter table public.vendas drop constraint if exists vendas_canal_check;
alter table public.vendas
  add constraint vendas_canal_check check (canal in (
    'instagram', 'whatsapp', 'presencial', 'encomenda', 'site', 'shopee', 'tiktok_shop',
    'mercado_livre', 'outro'
  ));

alter table public.taxas_recebimento drop constraint if exists taxas_recebimento_chave_check;
alter table public.taxas_recebimento
  add constraint taxas_recebimento_chave_check check (chave in (
    'pix', 'dinheiro', 'debito', 'credito', 'credito_parcelado', 'link', 'shopee', 'tiktok_shop',
    'mercado_livre'
  ));

alter table public.canal_conexoes drop constraint if exists canal_conexoes_canal_check;
alter table public.canal_conexoes
  add constraint canal_conexoes_canal_check
  check (canal in ('tiktok_shop', 'shopee', 'mercado_livre'));

alter table public.anuncio_vinculos drop constraint if exists anuncio_vinculos_canal_check;
alter table public.anuncio_vinculos
  add constraint anuncio_vinculos_canal_check
  check (canal in ('tiktok_shop', 'shopee', 'mercado_livre'));

alter table public.canal_eventos drop constraint if exists canal_eventos_canal_check;
alter table public.canal_eventos
  add constraint canal_eventos_canal_check
  check (canal in ('tiktok_shop', 'shopee', 'mercado_livre'));

alter table public.canal_fila_estoque drop constraint if exists canal_fila_estoque_canal_check;
alter table public.canal_fila_estoque
  add constraint canal_fila_estoque_canal_check
  check (canal in ('tiktok_shop', 'shopee', 'mercado_livre'));

-- ── 2. PKCE ───────────────────────────────────────────────────────────────
-- Gerado no Conectar junto do state, conferido na volta (o Mercado Livre pede o
-- verificador na troca do code) e zerado depois. A tabela não é lida pelo navegador.
alter table public.canal_conexoes
  add column if not exists verificador_pendente text
  check (verificador_pendente is null or char_length(verificador_pendente) between 43 and 128);

-- ── 3. frete pago pela vendedora ──────────────────────────────────────────
-- vendas.frete continua sendo o que a cliente pagou de frete (entra no total).
-- custo_envio é o que o canal cobrou DELA pelo envio: sai do lucro, como a tarifa.
alter table public.vendas
  add column if not exists custo_envio numeric(12, 2) not null default 0
  check (custo_envio >= 0 and custo_envio <= 100000);

-- Parâmetro novo muda a assinatura: a antiga sai para o PostgREST não ver duas.
-- Quem chama hoje (tiktok-sync) passa os parâmetros por nome e fica com o padrão 0.
drop function if exists public.registrar_venda_canal(uuid, text, text, date, jsonb, numeric, text);

create or replace function public.registrar_venda_canal(
  p_user_id uuid,
  p_canal text,
  p_id_externo text,
  p_data date,
  p_itens jsonb,
  p_taxa_canal numeric default 0,
  p_observacao text default null,
  p_custo_envio numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_item jsonb;
  v_sku public.produto_skus;
  v_produto public.produtos;
  v_qtd integer;
  v_preco numeric;
  v_subtotal numeric := 0;
  v_custo numeric := 0;
  v_custo_conhecido boolean := true;
  v_custo_item numeric;
  v_taxa numeric := round(coalesce(p_taxa_canal, 0), 2);
  v_envio numeric := round(coalesce(p_custo_envio, 0), 2);
begin
  if p_user_id is null or p_canal not in ('tiktok_shop', 'shopee', 'mercado_livre')
     or nullif(btrim(p_id_externo), '') is null or char_length(p_id_externo) > 200 then
    raise exception 'Venda do canal inválida' using errcode = 'check_violation';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array'
     or jsonb_array_length(p_itens) = 0 or jsonb_array_length(p_itens) > 100 then
    raise exception 'Venda sem itens' using errcode = 'check_violation';
  end if;

  select id into v_id from vendas
    where user_id = p_user_id and canal = p_canal and id_externo = p_id_externo;
  if found then
    return v_id;
  end if;
  v_id := gen_random_uuid();

  -- Primeiro passe: valida e soma.
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item ->> 'quantidade')::integer;
    v_preco := round((v_item ->> 'preco_unitario')::numeric, 2);
    if v_qtd is null or v_qtd <= 0 or v_qtd > 100000 or v_preco is null or v_preco < 0 then
      raise exception 'Item com quantidade ou preço inválido' using errcode = 'check_violation';
    end if;
    v_subtotal := v_subtotal + v_qtd * v_preco;
  end loop;
  if v_taxa < 0 or v_envio < 0 then
    raise exception 'Valor negativo' using errcode = 'check_violation';
  end if;
  v_taxa := least(v_taxa, v_subtotal);
  -- O frete pode passar do preço (produto barato, envio caro): fica o valor real,
  -- só com o teto da coluna.
  v_envio := least(v_envio, 100000);

  begin
    insert into vendas (
      id, user_id, canal, id_externo, data, status, categoria,
      subtotal, desconto, frete, taxa_canal, custo_envio, total, observacao
    ) values (
      v_id, p_user_id, p_canal, p_id_externo, p_data, 'a_receber', 'Venda de produto',
      v_subtotal, 0, 0, v_taxa, v_envio, v_subtotal, left(nullif(btrim(p_observacao), ''), 500)
    );
  exception when unique_violation then
    -- O mesmo pedido chegou duas vezes ao mesmo tempo: a outra chamada já registrou.
    select id into v_id from vendas
      where user_id = p_user_id and canal = p_canal and id_externo = p_id_externo;
    return v_id;
  end;

  -- Segundo passe: itens, custo e estoque.
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item ->> 'quantidade')::integer;
    v_preco := round((v_item ->> 'preco_unitario')::numeric, 2);
    v_sku := null;
    v_produto := null;
    if v_item ->> 'sku_id' is not null then
      select * into v_sku from produto_skus
        where id = (v_item ->> 'sku_id')::uuid and user_id = p_user_id and not arquivado
        for update;
      if found then
        select * into v_produto from produtos
          where id = v_sku.produto_id and user_id = p_user_id and not arquivado
          for share;
      end if;
    end if;

    if v_produto.id is not null then
      v_custo_item := custo_do_item(v_produto, p_user_id);
      insert into venda_itens (
        user_id, venda_id, produto_id, sku_id, produto_nome, variacao, quantidade,
        preco_unitario, custo_unitario
      ) values (
        p_user_id, v_id, v_produto.id, v_sku.id, v_produto.nome, v_sku.variacao, v_qtd,
        v_preco, v_custo_item
      );
      if v_produto.controla_estoque then
        insert into estoque_movimentos (user_id, sku_id, tipo, quantidade, venda_id)
        values (p_user_id, v_sku.id, 'venda', -v_qtd, v_id);
      end if;
    else
      -- Anúncio ainda sem produto da Pólia: a venda conta, o estoque não mexe.
      v_custo_item := null;
      insert into venda_itens (
        user_id, venda_id, produto_id, sku_id, produto_nome, variacao, quantidade,
        preco_unitario, custo_unitario
      ) values (
        p_user_id, v_id, null, null,
        left(coalesce(nullif(btrim(v_item ->> 'nome'), ''), 'Anúncio sem produto ligado'), 200),
        left(nullif(btrim(v_item ->> 'variacao'), ''), 80), v_qtd, v_preco, null
      );
    end if;

    if v_custo_item is null then
      v_custo_conhecido := false;
    else
      v_custo := v_custo + v_qtd * v_custo_item;
    end if;
  end loop;

  update vendas
     set custo_total = case when v_custo_conhecido then round(v_custo, 2) else null end
   where id = v_id;
  return v_id;
end;
$$;

revoke all on function public.registrar_venda_canal(uuid, text, text, date, jsonb, numeric, text, numeric)
  from public, anon, authenticated;
grant execute on function public.registrar_venda_canal(uuid, text, text, date, jsonb, numeric, text, numeric)
  to service_role;
