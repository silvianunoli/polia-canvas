-- O lembrete "modulo_d7" (O Planejamento ficou no meio) sai da régua de
-- ativação (decisão da Sil, 31/10/2026): o Planejamento saiu da Pólia One e
-- vira ferramenta do Pólia Lab. O e-mail já não sai pelo código
-- (supabase/functions/_shared/lembretesConta.ts tirou o tipo); aqui o banco
-- para de escolher a conta pra ele, e o cron deixa de chamar a edge function
-- só por causa dele.
--
-- É a contas_regua_ativacao de 20261020121000 sem o bloco 7, o resto igual.
-- ANTES DE APLICAR: conferir que a função no banco ainda é essa (outra sessão
-- pode ter mudado direto no banco):
--   select pg_get_functiondef('public.contas_regua_ativacao()'::regprocedure);
-- Nada é apagado: as linhas antigas de lembretes_conta com tipo 'modulo_d7'
-- continuam como registro de envio.

create or replace function public.contas_regua_ativacao()
returns table (user_id uuid, email text, tipo text, nome text, utm_content text, teste_fim timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  with base as (
    select u.id, u.email::text as email, u.created_at,
           nullif(u.raw_user_meta_data -> 'origem_campanha' ->> 'utm_content', '') as utm_content,
           coalesce(nullif(trim(p.display_name), ''), nullif(split_part(trim(p.full_name), ' ', 1), '')) as nome,
           coalesce(p.notif_dicas, true) as dicas,
           p.plano
      from auth.users u
      join public.profiles p on p.id = u.id
     where u.email_confirmed_at is not null
       and u.email is not null
       and coalesce(p.is_admin, false) = false
       -- Nada da régua no mesmo dia de outro e-mail dela ou dos lembretes antigos.
       and not exists (
         select 1 from public.lembretes_conta l
          where l.user_id = u.id and l.enviado_em > now() - interval '20 hours'
       )
  ),
  candidatos as (
    -- 1. Teste liberado pra quem já tinha conta
    select b.id, b.email, 'teste_reativacao'::text as tipo, 1 as prioridade, b.nome, b.utm_content, t.fim
      from base b join public.testes_pro t on t.user_id = b.id
     where t.origem = 'reativacao' and t.encerrado_em is null and t.fim > now() + interval '2 days'
    union all
    -- 2. Faltam 2 dias
    select b.id, b.email, 'teste_fim_2d', 2, b.nome, b.utm_content, t.fim
      from base b join public.testes_pro t on t.user_id = b.id
     where t.encerrado_em is null and t.fim > now() and t.fim <= now() + interval '48 hours'
    union all
    -- 3. O teste acabou
    select b.id, b.email, 'teste_acabou', 3, b.nome, b.utm_content, t.fim
      from base b join public.testes_pro t on t.user_id = b.id
     where t.resultado = 'voltou_gratis' and t.encerrado_em > now() - interval '48 hours'
    union all
    -- 4. Pagamento largado no meio
    select b.id, b.email, 'checkout_1h', 4, b.nome, b.utm_content, null
      from base b join public.assinaturas a on a.user_id = b.id
     where a.status in ('incomplete', 'incomplete_expired')
       and coalesce(a.cortesia, false) = false
       and a.updated_at <= now() - interval '1 hour'
       and a.updated_at > now() - interval '24 hours'
    union all
    -- 5. Calculou e não guardou
    select b.id, b.email, 'guardar_d2', 5, b.nome, b.utm_content, null
      from base b
     where b.dicas
       and b.created_at <= now() - interval '40 hours'
       and b.created_at > now() - interval '5 days'
       and exists (select 1 from public.founder_eventos e where e.user_id = b.id and e.feature = 'calculadora')
       and not exists (select 1 from public.produtos p where p.user_id = b.id and p.calculadora_breakdown is not null)
    union all
    -- 6. Guardou preço, falta o segundo passo (a Meta do mês)
    select b.id, b.email, 'segundo_passo_d4', 6, b.nome, b.utm_content, null
      from base b
     where b.dicas
       and b.created_at <= now() - interval '4 days'
       and b.created_at > now() - interval '8 days'
       and exists (select 1 from public.produtos p where p.user_id = b.id and p.calculadora_breakdown is not null)
       and not exists (select 1 from public.metas m where m.user_id = b.id)
    -- 7. modulo_d7 (Começou o Planejamento e parou) saiu em 31/10/2026.
  )
  select distinct on (c.id) c.id, c.email, c.tipo, c.nome, c.utm_content, c.fim
    from candidatos c
   where not exists (
     select 1 from public.lembretes_conta l where l.user_id = c.id and l.tipo = c.tipo
   )
   order by c.id, c.prioridade;
$$;

revoke all on function public.contas_regua_ativacao() from public, anon, authenticated;
