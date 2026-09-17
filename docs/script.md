# Diário de bordo

Registro curto, por sessão, do que mudou e por quê (regra do CLAUDE.md: escrever antes de mexer no código).

## 2026-09-17 — Founder Dashboard, bloco 1 (monitor em background)

Contexto: o Founder Dashboard vive no polia-admin (`office.usepolia.com.br/founder`), mas migrations e Edge Functions moram aqui. Plano completo em `~/.claude/plans/c-users-silnu-downloads-polia-founder-d-fizzy-hearth.md` (6 blocos, seguindo a prioridade do PDF de direcionamento).

- `supabase/functions/founder-monitor/`: health-checks por serviço (API `/health`, banco, auth, Stripe, Resend, IA via `ia_geracoes`, storage), snapshot diário em `founder_metricas_diarias`, regras de alerta com dedup em `founder_alertas`; alerta crítico novo repassa ao `alertas-criticos` com `tipo: founder:*`. Auth: header `x-founder-secret` (cron) ou JWT de admin (botão "Verificar agora").
- `supabase/migrations/20260917162924_founder_monitor_base.sql`: colunas de baseline, `chave_dedup`, `founder_jobs_falhos()`, `disparar_founder_monitor()` e `cron.schedule('founder-monitor', '*/10 * * * *')`.
- Segredo `founder_monitor_secret` criado no Vault e espelhado como `FOUNDER_MONITOR_SECRET` nos secrets das Edge Functions (fora de migration).
- Pendente (decisão da Sil): desagendar `checar-taxa-erro-alertas`, que passa a duplicar a regra `pico_erros_app` do monitor.
- Achado na primeira rodada: `STRIPE_SECRET_KEY` das Edge Functions expirada (HTTP 401 "Expired API Key") e `RESEND_API_KEY` inválida. O `stripe-webhook` depende da primeira.

Próximo: bloco 2, instrumentação de eventos (`founder_eventos`, `src/lib/founder-eventos.ts`, middleware de API em `src/start.ts`, eventos de assinatura no `stripe-webhook`).
