-- Régua de ativação e de teste do Pro (GRW-66, aprovada pela Sil em 20/10/2026).
-- Estende os lembretes de conta (GRW-33): a mesma edge function lembretes-conta,
-- o mesmo cron de 15 min e a mesma tabela lembretes_conta (PK user_id + tipo:
-- cada e-mail sai uma vez só por conta).
--
-- Por comportamento, não por calendário. No máximo UM e-mail da régua por conta
-- a cada execução, e nunca dois no mesmo dia (o mais urgente primeiro).
--
--  teste_reativacao  conta do Grátis que ganhou 7 dias do Pro em 20/10 (origem 'reativacao')
--  teste_fim_2d      teste aberto que acaba nas próximas 48 horas
--  teste_acabou      teste fechado nas últimas 48 horas sem assinatura
--  checkout_1h       pagamento aberto no app e largado (incomplete) há 1 a 24 horas
--  guardar_d2        40 horas a 5 dias de conta, abriu a Calculadora e não guardou preço
--  segundo_passo_d4  4 a 8 dias de conta, já guardou preço, nenhuma meta
--  modulo_d7         6 a 12 dias de conta, começou o Planejamento e não fechou módulo
--
-- Dicas (guardar, segundo passo, módulo) respeitam profiles.notif_dicas. Teste e
-- checkout são aviso sobre a própria conta e saem pra todas.

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
    union all
    -- 7. Começou o Planejamento e parou
    select b.id, b.email, 'modulo_d7', 7, b.nome, b.utm_content, null
      from base b
     where b.dicas
       and b.created_at <= now() - interval '6 days'
       and b.created_at > now() - interval '12 days'
       and exists (select 1 from public.planejamento_respostas r where r.user_id = b.id)
       and not exists (
         select 1 from public.founder_eventos e
          where e.user_id = b.id and e.feature = 'planejamento' and e.evento = 'feature_completed'
       )
  )
  select distinct on (c.id) c.id, c.email, c.tipo, c.nome, c.utm_content, c.fim
    from candidatos c
   where not exists (
     select 1 from public.lembretes_conta l where l.user_id = c.id and l.tipo = c.tipo
   )
   order by c.id, c.prioridade;
$$;

revoke all on function public.contas_regua_ativacao() from public, anon, authenticated;

-- O disparo do cron só chamava a edge function quando havia conta pros
-- lembretes antigos. Agora chama também quando a régua tem candidata.
create or replace function public.disparar_lembretes_conta()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  segredo text;
begin
  if not exists (
    select 1 from auth.users u
     where u.email_confirmed_at is null
       and u.created_at <= now() - interval '1 hour'
       and u.created_at > now() - interval '7 days'
  ) and not exists (
    select 1 from auth.users u
     where u.email_confirmed_at is not null
       and u.email is not null
       and u.created_at <= now() - interval '20 hours'
       and u.created_at > now() - interval '72 hours'
       and not exists (
         select 1 from public.lembretes_conta l
          where l.user_id = u.id and l.tipo = 'preco_d1'
       )
       and not exists (
         select 1 from public.produtos p
          where p.user_id = u.id and p.calculadora_breakdown is not null
       )
  ) and not exists (
    select 1 from public.contas_regua_ativacao()
  ) then
    return;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'lembretes_conta_secret';
  if segredo is not null then
    perform net.http_post(
      url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/lembretes-conta',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-lembretes-conta-secret', segredo)
    );
  end if;
end;
$$;
