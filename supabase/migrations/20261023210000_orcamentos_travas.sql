-- ONE-129 (23/10/2026), depois da revisão de segurança: travas que a primeira
-- migration (20261023200000) deixou soltas.
--
--   1. Máquina de estados no gatilho. Só o link da cliente (service role, pela
--      server function aprovarOrcamento) aprova; só converter_orcamento marca
--      "convertido"; convertido e cancelado não voltam; orçamento que saiu de
--      "enviado" não muda itens, valores nem validade (a aprovação vale como
--      prova do que a cliente viu). Antes a dona conseguia, pela API, marcar
--      "aprovado pela cliente" sozinha ou mudar o valor depois da aprovação.
--   2. converter_orcamento: venda (registrar_venda com p_id = id do orçamento)
--      e status numa transação só. Antes eram duas escritas soltas no
--      navegador; se a segunda falhasse, o orçamento ficava sem "Virou venda".
--   3. Número sequencial com trava por conta (duas criações juntas colidiam).
--   4. Item valida variacao (texto curto ou nulo) e o tamanho do jsonb.
--   5. logo_path só no formato que o app grava (sem "..").

-- ── gatilho ────────────────────────────────────────────────────────────────
create or replace function public.orcamentos_antes_de_gravar()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_item jsonb;
  v_subtotal numeric(12, 2) := 0;
  v_convertendo boolean := coalesce(current_setting('polia.convertendo', true), '') = 'on';
begin
  if pg_column_size(new.itens) > 32768 then
    raise exception 'Orçamento grande demais' using errcode = 'check_violation';
  end if;
  for v_item in select * from jsonb_array_elements(new.itens) loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(char_length(v_item ->> 'produto_nome'), 0) not between 1 and 200
       or (v_item ->> 'quantidade') !~ '^\d{1,6}$'
       or (v_item ->> 'quantidade')::int < 1
       or (v_item ->> 'preco_unitario') !~ '^\d{1,10}(\.\d{1,2})?$'
       or coalesce(jsonb_typeof(v_item -> 'variacao'), 'null') not in ('string', 'null')
       or char_length(coalesce(v_item ->> 'variacao', '')) > 120 then
      raise exception 'Item do orçamento inválido' using errcode = 'check_violation';
    end if;
    v_subtotal := v_subtotal
      + round((v_item ->> 'quantidade')::int * (v_item ->> 'preco_unitario')::numeric, 2);
  end loop;
  new.subtotal := v_subtotal;
  new.total := greatest(v_subtotal - new.desconto + new.frete, 0);

  if tg_op = 'INSERT' then
    -- Uma criação por vez por conta: o max()+1 não colide.
    perform pg_advisory_xact_lock(hashtext('orcamentos:' || new.user_id::text));
    select coalesce(max(numero), 0) + 1 into new.numero
      from orcamentos where user_id = new.user_id;
    new.status := 'enviado';
    new.aprovado_em := null;
    new.venda_id := null;
    new.updated_at := now();
    return new;
  end if;

  new.link_token := old.link_token;
  new.numero := old.numero;

  if new.venda_id is distinct from old.venda_id and not v_convertendo then
    raise exception 'Venda do orçamento só muda ao virar venda' using errcode = 'check_violation';
  end if;

  if new.status <> old.status then
    -- Venda cancelada reabre o orçamento (gatilho em vendas, com a mesma
    -- marca de sessão): é a única saída de "convertido".
    if old.status = 'convertido' and v_convertendo and new.status in ('enviado', 'aprovado') then
      null;
    elsif old.status in ('convertido', 'cancelado') then
      raise exception 'Orçamento encerrado' using errcode = 'check_violation';
    elsif new.status = 'aprovado' then
      if coalesce(auth.role(), '') <> 'service_role' or old.status <> 'enviado' then
        raise exception 'Só a cliente aprova pelo link' using errcode = 'check_violation';
      end if;
      new.aprovado_em := now();
    elsif new.status = 'convertido' then
      if not v_convertendo or new.venda_id is null then
        raise exception 'Use Virar venda' using errcode = 'check_violation';
      end if;
    elsif new.status = 'enviado' then
      raise exception 'Orçamento respondido não volta' using errcode = 'check_violation';
    end if;
  end if;

  if old.status <> 'enviado' and (
    new.itens is distinct from old.itens
    or new.desconto is distinct from old.desconto
    or new.frete is distinct from old.frete
    or new.validade is distinct from old.validade
    or new.cliente_id is distinct from old.cliente_id
    or new.cliente_nome is distinct from old.cliente_nome
    or new.observacao is distinct from old.observacao
  ) then
    raise exception 'Orçamento respondido não muda' using errcode = 'check_violation';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- venda_id só pela função de converter.
revoke update (venda_id) on public.orcamentos from authenticated;

-- ── converter_orcamento ────────────────────────────────────────────────────
-- A venda tem id próprio (p_venda_id, gerado quando o modal abre): se ela for
-- cancelada, o orçamento reabre e pode virar outra venda. O lock no orçamento
-- serializa clique duplo: a segunda chamada já acha "convertido" e devolve a
-- mesma venda.
drop function if exists public.converter_orcamento(uuid, date, text, jsonb, uuid, text, numeric, numeric, numeric, boolean, text);
create or replace function public.converter_orcamento(
  p_orcamento_id uuid,
  p_venda_id uuid,
  p_data date,
  p_canal text,
  p_itens jsonb,
  p_cliente_id uuid default null,
  p_cliente_nome text default null,
  p_desconto numeric default 0,
  p_frete numeric default 0,
  p_taxa_canal numeric default 0,
  p_recebida boolean default true,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orc public.orcamentos;
begin
  select * into v_orc from orcamentos
    where id = p_orcamento_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Orçamento não encontrado' using errcode = 'no_data_found';
  end if;
  -- Reenvio depois de converter: devolve a mesma venda.
  if v_orc.status = 'convertido' and v_orc.venda_id is not null then
    return v_orc.venda_id;
  end if;
  if v_orc.status not in ('enviado', 'aprovado') then
    raise exception 'Orçamento encerrado' using errcode = 'check_violation';
  end if;

  perform registrar_venda(
    p_venda_id, p_data, p_canal, p_itens, p_cliente_id, p_cliente_nome,
    p_desconto, p_frete, p_taxa_canal, p_recebida, p_observacao, false
  );

  perform set_config('polia.convertendo', 'on', true);
  update orcamentos set status = 'convertido', venda_id = p_venda_id
    where id = p_orcamento_id;
  perform set_config('polia.convertendo', 'off', true);
  return p_venda_id;
end;
$$;

revoke all on function public.converter_orcamento(uuid, uuid, date, text, jsonb, uuid, text, numeric, numeric, numeric, boolean, text) from public, anon;
grant execute on function public.converter_orcamento(uuid, uuid, date, text, jsonb, uuid, text, numeric, numeric, numeric, boolean, text) to authenticated;

-- ── venda cancelada reabre o orçamento ─────────────────────────────────────
-- Volta pra "aprovado" se a cliente tinha aprovado pelo link, senão "enviado".
create or replace function public.vendas_cancelada_reabre_orcamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelada' and old.status <> 'cancelada' then
    perform set_config('polia.convertendo', 'on', true);
    update orcamentos
      set status = case when aprovado_em is not null then 'aprovado' else 'enviado' end,
          venda_id = null
      where venda_id = new.id and user_id = new.user_id and status = 'convertido';
    perform set_config('polia.convertendo', 'off', true);
  end if;
  return new;
end;
$$;

drop trigger if exists vendas_cancelada_reabre_orcamento on public.vendas;
create trigger vendas_cancelada_reabre_orcamento after update of status on public.vendas
  for each row execute function public.vendas_cancelada_reabre_orcamento();

-- ── logo no formato que o app grava ────────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_logo_path_check;
alter table public.profiles add constraint profiles_logo_path_check
  check (logo_path is null or logo_path ~ ('^' || id::text || '/logo-[0-9]{10,16}\.(png|jpg|webp)$'));
