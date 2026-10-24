-- ONE-136 (23/10/2026): recompensa por completar os primeiros passos.
-- Decisões da Sil no chat: +7 dias no teste do Pro, uma vez só, e só pra
-- quem completa os passos com o teste aberto (quem já voltou pro Grátis ou
-- já assina não ganha nada).
--
-- O navegador só PEDE o bônus; quem confere os três passos é o banco, com a
-- mesma régua do Painel (lib/primeirosPassos.ts):
--   preço     produto salvo pela Calculadora (calculadora_breakdown não nulo)
--   módulo 1  as 5 seções do Módulo 1 concluídas (planejamento_secoes;
--             ids 1.1 a 1.5, os mesmos de secoesDoModulo(1) em lib/planejamento.ts)
--   nome      profiles.business_name preenchido
-- O cron encerrar_testes_pro() já olha testes_pro.fim, então estender o fim
-- é tudo que precisa: a régua de e-mail e a faixa do teste seguem a data nova.

alter table public.testes_pro
  add column if not exists bonus_passos_em timestamptz;

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
  -- for update: duas abas pedindo ao mesmo tempo, só a primeira ganha.
  select * into v_teste from testes_pro where user_id = v_uid for update;
  if not found
     or v_teste.bonus_passos_em is not null
     or v_teste.encerrado_em is not null
     or v_teste.fim <= now() then
    -- Sem teste, já ganhou ou o teste acabou: nada a fazer, sem erro.
    return null;
  end if;

  if not exists (
    select 1 from produtos where user_id = v_uid and calculadora_breakdown is not null
  ) then
    raise exception 'Falta o primeiro preço' using errcode = 'check_violation';
  end if;
  if (
    select count(distinct secao) from planejamento_secoes
    where user_id = v_uid and concluido and secao in ('1.1', '1.2', '1.3', '1.4', '1.5')
  ) < 5 then
    raise exception 'Falta fechar o Módulo 1' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from profiles where id = v_uid and nullif(btrim(business_name), '') is not null
  ) then
    raise exception 'Falta o nome do negócio' using errcode = 'check_violation';
  end if;

  update testes_pro
    set fim = fim + interval '7 days', bonus_passos_em = now()
    where user_id = v_uid
    returning fim into v_teste.fim;
  return v_teste.fim;
end;
$$;

revoke all on function public.resgatar_bonus_primeiros_passos() from public, anon;
grant execute on function public.resgatar_bonus_primeiros_passos() to authenticated;
