# Diário de bordo

Registro curto, por sessão, do que mudou e por quê (regra do CLAUDE.md: escrever antes de mexer no código).

## 2026-09-17 — Founder Dashboard, bloco 1 (monitor em background)

Contexto: o Founder Dashboard vive no polia-admin (`office.usepolia.com.br/founder`), mas migrations e Edge Functions moram aqui. Plano completo em `~/.claude/plans/c-users-silnu-downloads-polia-founder-d-fizzy-hearth.md` (6 blocos, seguindo a prioridade do PDF de direcionamento).

- `supabase/functions/founder-monitor/`: health-checks por serviço (API `/health`, banco, auth, Stripe, Resend, IA via `ia_geracoes`, storage), snapshot diário em `founder_metricas_diarias`, regras de alerta com dedup em `founder_alertas`; alerta crítico novo repassa ao `alertas-criticos` com `tipo: founder:*`. Auth: header `x-founder-secret` (cron) ou JWT de admin (botão "Verificar agora").
- `supabase/migrations/20260917162924_founder_monitor_base.sql`: colunas de baseline, `chave_dedup`, `founder_jobs_falhos()`, `disparar_founder_monitor()` e `cron.schedule('founder-monitor', '*/10 * * * *')`.
- Segredo `founder_monitor_secret` criado no Vault e espelhado como `FOUNDER_MONITOR_SECRET` nos secrets das Edge Functions (fora de migration).
- Pendente (decisão da Sil): desagendar `checar-taxa-erro-alertas`, que passa a duplicar a regra `pico_erros_app` do monitor.
- Achado na primeira rodada: `STRIPE_SECRET_KEY` das Edge Functions expirada (HTTP 401 "Expired API Key") e `RESEND_API_KEY` inválida. O `stripe-webhook` depende da primeira.

## 2026-09-17 — Founder Dashboard, bloco 2 (instrumentação de eventos)

- Migration `20260917170020_founder_eventos_schema.sql`: `founder_eventos` (allowlist de eventos, RLS insert próprio/nulo, leitura admin), `founder_eventos_sistema`, `founder_api_chamadas`, `founder_features` (seed do catálogo rota→feature).
- `src/lib/founder-features.ts` (+ teste): mapa rota→feature, normalização de página, ambiente pelo hostname.
- `src/lib/founder-eventos.ts` (client): sessão em sessionStorage (30 min), fila com flush em lote por fetch keepalive, heartbeat de 60 s só com aba visível e atividade recente, `sessao_fim` no pagehide, marcação de login/signup pendente pro fluxo do Google.
- `src/lib/founder-eventos.server.ts`: eventos de servidor, eventos de sistema, medição de chamadas e leitura do `sub` do bearer (só atribuição).
- `src/start.ts`: `medirServerFn` (toda server function → `founder_api_chamadas`; erro → `api_error`) e `medirRequest` (SSR amostrado).
- Hooks: `_authenticated.tsx` (feature_opened + heartbeat), cadastro/login (signup/login, Google via marcação), Sidebar/configuracoes (logout), onboarding (started/completed/business_created/create_product), produtos, metas, e `feature_completed` em aimer, clientes, financeiro, lançamento, planejamento, plano de conteúdo, projeção, raio-x, meta concluída.
- `gemini.server.ts` mede latência/falha de toda chamada de IA (`ia_call`/`ia_failure`); `calendarGoogle.functions.ts` registra `integration_failure` quando o refresh token é recusado.
- `stripe-webhook`: `subscription_started` (status vira ativo), `subscription_cancelled`, `payment_failed` e `webhook_failure`.
- Política de privacidade: item novo sobre registro de uso do serviço por quem tem conta (sem consentimento de cookie, base contratual). ADR-001 em `docs/adr/`.
- Decisão registrada: eventos de usuária logada gravam sempre; páginas públicas seguem no `track()` antigo com consentimento.

Próximo: bloco 3, analytics de uso no admin (`founder_sessoes`, 8 páginas + perfil individual).
