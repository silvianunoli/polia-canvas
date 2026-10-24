-- ONE-136 (24/10/2026), decisão da Sil: os 7 dias por completar os primeiros
-- passos são só da conta nova (testes_pro.origem = 'cadastro'). Conta de
-- reativação não vê o bloco "Primeiros passos" nem o convite, então o bônus
-- viraria presente sem motivo.

create or replace function public.resgatar_bonus_primeiros_passos()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_teste public.testes_pro;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  select * into v_teste from testes_pro where user_id = v_uid for update;
  if not found
     or v_teste.origem <> 'cadastro'
     or v_teste.bonus_passos_em is not null
     or v_teste.encerrado_em is not null
     or v_teste.fim <= now() then
    return null;
  end if;

  -- A mesma régua do Painel (lib/primeirosPassos.ts). Seções do Módulo 1:
  -- secoesDoModulo(1) em lib/planejamento.ts, travadas por teste em
  -- bonusPrimeirosPassos.test.ts ("mudou lá, migration nova aqui").
  if not exists (
       select 1 from produtos where user_id = v_uid and calculadora_breakdown is not null
     )
     or (
       select count(distinct secao) from planejamento_secoes
       where user_id = v_uid and concluido and secao in ('1.1', '1.2', '1.3', '1.4', '1.5')
     ) < 5
     or not exists (
       select 1 from profiles where id = v_uid and nullif(btrim(business_name), '') is not null
     ) then
    return null;
  end if;

  update testes_pro
    set fim = fim + interval '7 days', bonus_passos_em = now()
    where user_id = v_uid
    returning fim into v_teste.fim;
  delete from lembretes_conta where user_id = v_uid and tipo = 'teste_fim_2d';
  return v_teste.fim;
end;
$$;

revoke all on function public.resgatar_bonus_primeiros_passos() from public, anon;
grant execute on function public.resgatar_bonus_primeiros_passos() to authenticated;
