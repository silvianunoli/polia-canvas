-- Fecha a brecha da policy de insert de founder_eventos: pelo client (anon ou
-- usuária logada) só entra origem 'client' e nunca os eventos que só o
-- stripe-webhook (service role) pode gerar. Sem isso, qualquer sessão podia
-- gravar um subscription_started/payment_failed e poluir Negócio/alertas.
-- Aplicada em produção em 17/09/2026 (version 20260917173725).

drop policy if exists "founder_eventos: insere com user_id proprio ou nulo" on public.founder_eventos;

create policy "founder_eventos: insere com user_id proprio ou nulo"
  on public.founder_eventos for insert
  to anon, authenticated
  with check (
    ((auth.uid() is null and user_id is null) or auth.uid() = user_id)
    and origem = 'client'
    and evento not in ('subscription_started', 'subscription_cancelled', 'payment_failed')
  );
