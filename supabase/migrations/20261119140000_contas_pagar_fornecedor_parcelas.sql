-- ONE-207 Fase 1 (19/11/2026): contas a pagar no formato da planilha de
-- conciliação que a Sil trouxe (aba "Contas a pagar": data, fornecedor,
-- documento/parcela, descrição, valor original, valor pago).
--
--   fornecedor  quem recebe (Nina Rainha das Frutas, Consórcio Metrópole).
--   documento   NF-e, boleto, ID da transação do Pix. Livre, até 80.
--   valor_pago  o que saiu de fato. "valor" continua sendo o original: a conta
--               de R$ 400,00 paga com juros sai R$ 412,08 e as duas ficam
--               guardadas. Null em conta paga antes desta migration = pagou o
--               original (a tela lê valor_pago ?? valor).
--   parcela / parcelas  "2 de 3". A tela cria as N contas de uma vez, uma por
--               mês. Conta parcelada não repete todo mês: as duas coisas juntas
--               criariam parcela 4 de 3.
--
-- Tudo aditivo. pagar_conta ganha p_valor com default null, então a chamada
-- antiga (só p_conta_id e p_data, por nome) continua funcionando enquanto o
-- front novo não está no ar.

alter table public.contas_pagar
  add column if not exists fornecedor text,
  add column if not exists documento text,
  add column if not exists valor_pago numeric(12, 2),
  add column if not exists parcela smallint,
  add column if not exists parcelas smallint;

alter table public.contas_pagar drop constraint if exists contas_pagar_fornecedor_tamanho;
alter table public.contas_pagar add constraint contas_pagar_fornecedor_tamanho
  check (fornecedor is null or char_length(fornecedor) between 1 and 80);

alter table public.contas_pagar drop constraint if exists contas_pagar_documento_tamanho;
alter table public.contas_pagar add constraint contas_pagar_documento_tamanho
  check (documento is null or char_length(documento) between 1 and 80);

alter table public.contas_pagar drop constraint if exists contas_pagar_valor_pago_faixa;
alter table public.contas_pagar add constraint contas_pagar_valor_pago_faixa
  check (valor_pago is null or (valor_pago > 0 and valor_pago <= 99999999));

-- valor_pago só existe em conta paga (desfazer limpa junto).
alter table public.contas_pagar drop constraint if exists contas_pagar_valor_pago_so_paga;
alter table public.contas_pagar add constraint contas_pagar_valor_pago_so_paga
  check (valor_pago is null or status = 'paga');

alter table public.contas_pagar drop constraint if exists contas_pagar_parcelas_validas;
alter table public.contas_pagar add constraint contas_pagar_parcelas_validas
  check (
    (parcela is null and parcelas is null)
    or (parcelas between 2 and 60 and parcela between 1 and parcelas and recorrencia = 'nenhuma')
  );

-- Gatilho: além do que já fazia, apara fornecedor e documento e troca vazio por null.
create or replace function public.contas_pagar_antes_de_gravar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.vencimento is distinct from old.vencimento then
    new.dia_recorrencia := extract(day from new.vencimento)::smallint;
  end if;
  new.descricao := btrim(new.descricao);
  new.fornecedor := nullif(btrim(new.fornecedor), '');
  new.documento := nullif(btrim(new.documento), '');
  new.updated_at := now();
  return new;
end;
$$;

-- Escrita livre só nos campos da conta. parcela/parcelas só na criação (editar
-- uma parcela não muda o parcelamento); valor_pago só pelas funções.
grant insert (fornecedor, documento, parcela, parcelas) on public.contas_pagar to authenticated;
grant update (fornecedor, documento) on public.contas_pagar to authenticated;

-- ── pagar_conta com valor pago ─────────────────────────────────────────────
drop function if exists public.pagar_conta(uuid, date);

create or replace function public.pagar_conta(
  p_conta_id uuid,
  p_data date,
  p_valor numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conta public.contas_pagar;
  v_valor numeric(12, 2);
  v_descricao text;
  v_lancamento_id uuid;
  v_proxima_id uuid;
begin
  select * into v_conta from contas_pagar
    where id = p_conta_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Conta não encontrada' using errcode = 'no_data_found';
  end if;
  if v_conta.status <> 'a_pagar' then
    raise exception 'Conta já paga' using errcode = 'check_violation';
  end if;

  v_valor := round(coalesce(p_valor, v_conta.valor), 2);
  if v_valor <= 0 or v_valor > 99999999 then
    raise exception 'Valor pago inválido' using errcode = 'check_violation';
  end if;

  -- O histórico do Financeiro não tem coluna de fornecedor: a saída leva a
  -- parcela e o fornecedor na descrição ("Frutas (2/3) · Nina").
  v_descricao := left(
    v_conta.descricao
      || case when v_conta.parcelas is not null
           then ' (' || v_conta.parcela || '/' || v_conta.parcelas || ')' else '' end
      || coalesce(' · ' || v_conta.fornecedor, ''),
    200
  );

  insert into lancamentos (user_id, tipo, valor, data, descricao, categoria, id_externo)
  values (
    v_conta.user_id, 'saida', v_valor, coalesce(p_data, current_date),
    v_descricao, v_conta.categoria, 'conta:' || p_conta_id
  ) returning id into v_lancamento_id;

  if v_conta.recorrencia = 'mensal' then
    -- A do mês seguinte leva o fornecedor; o documento é de cada mês.
    insert into contas_pagar (user_id, descricao, valor, vencimento, categoria, recorrencia, fornecedor)
    values (
      v_conta.user_id, v_conta.descricao, v_conta.valor,
      contas_pagar_proximo_vencimento(v_conta.vencimento, v_conta.dia_recorrencia),
      v_conta.categoria, 'mensal', v_conta.fornecedor
    ) returning id into v_proxima_id;
    -- O gatilho recalcula o dia pelo vencimento novo; devolve o dia original.
    update contas_pagar set dia_recorrencia = v_conta.dia_recorrencia where id = v_proxima_id;
  end if;

  update contas_pagar
    set status = 'paga', pago_em = coalesce(p_data, current_date), valor_pago = v_valor,
        lancamento_id = v_lancamento_id, proxima_id = v_proxima_id
    where id = p_conta_id;
  return v_lancamento_id;
end;
$$;

-- ── desfazer_pagamento limpa o valor pago ──────────────────────────────────
create or replace function public.desfazer_pagamento(p_conta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conta public.contas_pagar;
begin
  select * into v_conta from contas_pagar
    where id = p_conta_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Conta não encontrada' using errcode = 'no_data_found';
  end if;
  if v_conta.status <> 'paga' then
    return;
  end if;
  if exists (
    select 1 from contas_pagar
    where id = v_conta.proxima_id and user_id = v_conta.user_id and status = 'paga'
  ) then
    raise exception 'Mês seguinte já pago' using errcode = 'check_violation';
  end if;

  if v_conta.lancamento_id is not null then
    delete from lancamentos where id = v_conta.lancamento_id and user_id = v_conta.user_id;
  end if;
  if v_conta.proxima_id is not null then
    delete from contas_pagar
      where id = v_conta.proxima_id and user_id = v_conta.user_id and status = 'a_pagar';
  end if;

  update contas_pagar
    set status = 'a_pagar', pago_em = null, valor_pago = null,
        lancamento_id = null, proxima_id = null
    where id = p_conta_id;
end;
$$;

revoke all on function public.pagar_conta(uuid, date, numeric) from public, anon;
revoke all on function public.desfazer_pagamento(uuid) from public, anon;
grant execute on function public.pagar_conta(uuid, date, numeric) to authenticated;
grant execute on function public.desfazer_pagamento(uuid) to authenticated;
