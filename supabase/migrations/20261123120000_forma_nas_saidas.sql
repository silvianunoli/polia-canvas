-- ONE-207 (23/11/2026, Sil: "precisa ter a forma de pagamento nas saidas tbm,
-- só tem nas entradas"). Forma de pagamento nas saídas e nas contas a pagar.
--
--   lancamentos.forma  passa a aceitar 'boleto' (só faz sentido em saída: é
--                      como se paga aluguel e fornecedor). As outras formas
--                      valem pros dois lados.
--   contas_pagar.forma como ela costuma pagar essa conta, escolhida no
--                      cadastro. O "Paguei" de um clique usa ela; o "Paguei em
--                      outra data ou valor" deixa trocar. A conta do mês
--                      seguinte (repete todo mês) herda.
--   pagar_conta        ganha p_forma (default null = a da conta). A chamada
--                      antiga, por nome e sem p_forma, continua valendo.
-- Aditivo: forma nula = não informada.

alter table public.lancamentos drop constraint if exists lancamentos_forma_valida;
alter table public.lancamentos add constraint lancamentos_forma_valida
  check (forma is null or forma in (
    'pix', 'dinheiro', 'debito', 'credito', 'credito_parcelado', 'link', 'boleto'
  ));

alter table public.contas_pagar
  add column if not exists forma text;
alter table public.contas_pagar drop constraint if exists contas_pagar_forma_valida;
alter table public.contas_pagar add constraint contas_pagar_forma_valida
  check (forma is null or forma in (
    'pix', 'dinheiro', 'debito', 'credito', 'credito_parcelado', 'link', 'boleto'
  ));

grant insert (forma) on public.contas_pagar to authenticated;
grant update (forma) on public.contas_pagar to authenticated;

-- ── pagar_conta com forma ──────────────────────────────────────────────────
drop function if exists public.pagar_conta(uuid, date, numeric);

create or replace function public.pagar_conta(
  p_conta_id uuid,
  p_data date,
  p_valor numeric default null,
  p_forma text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conta public.contas_pagar;
  v_valor numeric(12, 2);
  v_forma text;
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
  v_forma := coalesce(nullif(btrim(p_forma), ''), v_conta.forma);

  v_descricao := left(
    v_conta.descricao
      || case when v_conta.parcelas is not null
           then ' (' || v_conta.parcela || '/' || v_conta.parcelas || ')' else '' end
      || coalesce(' · ' || v_conta.fornecedor, ''),
    200
  );

  insert into lancamentos (user_id, tipo, valor, data, descricao, categoria, id_externo, forma)
  values (
    v_conta.user_id, 'saida', v_valor, coalesce(p_data, current_date),
    v_descricao, v_conta.categoria, 'conta:' || p_conta_id, v_forma
  ) returning id into v_lancamento_id;

  if v_conta.recorrencia = 'mensal' then
    insert into contas_pagar (user_id, descricao, valor, vencimento, categoria, recorrencia, fornecedor, forma)
    values (
      v_conta.user_id, v_conta.descricao, v_conta.valor,
      contas_pagar_proximo_vencimento(v_conta.vencimento, v_conta.dia_recorrencia),
      v_conta.categoria, 'mensal', v_conta.fornecedor, v_conta.forma
    ) returning id into v_proxima_id;
    update contas_pagar set dia_recorrencia = v_conta.dia_recorrencia where id = v_proxima_id;
  end if;

  -- A forma desta conta passa a ser a usada no pagamento.
  update contas_pagar
    set status = 'paga', pago_em = coalesce(p_data, current_date), valor_pago = v_valor,
        forma = v_forma, lancamento_id = v_lancamento_id, proxima_id = v_proxima_id
    where id = p_conta_id;
  return v_lancamento_id;
end;
$$;

revoke all on function public.pagar_conta(uuid, date, numeric, text) from public, anon;
grant execute on function public.pagar_conta(uuid, date, numeric, text) to authenticated;
