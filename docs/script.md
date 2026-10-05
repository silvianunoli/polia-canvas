# Diário de bordo

Registro curto, por sessão, do que mudou e por quê (regra do CLAUDE.md: escrever antes de mexer no código).

## 2026-09-17 — Founder Dashboard, bloco 1 (monitor em background)

Contexto: o Founder Dashboard vive no polia-admin (`office.usepolia.com.br/founder`), mas migrations e Edge Functions moram aqui. Plano completo em `~/.claude/plans/c-users-silnu-downloads-polia-founder-d-fizzy-hearth.md` (6 blocos, seguindo a prioridade do PDF de direcionamento).

- `supabase/functions/founder-monitor/`: health-checks por serviço (API `/health`, banco, auth, Stripe, Resend, IA via `ia_geracoes`, storage), snapshot diário em `founder_metricas_diarias`, regras de alerta com dedup em `founder_alertas`; alerta crítico novo repassa ao `alertas-criticos` com `tipo: founder:*`. Auth: header `x-founder-secret` (cron) ou JWT de admin (botão "Verificar agora").
- `supabase/migrations/20260917162924_founder_monitor_base.sql`: colunas de baseline, `chave_dedup`, `founder_jobs_falhos()`, `disparar_founder_monitor()` e `cron.schedule('founder-monitor', '*/10 * * * *')`.
- Segredo `founder_monitor_secret` criado no Vault e espelhado como `FOUNDER_MONITOR_SECRET` nos secrets das Edge Functions (fora de migration).
- Desagendado pela Sil no mesmo dia: `checar-taxa-erro-alertas`, que duplicava a regra `pico_erros_app` do monitor.
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

Depois do deploy, nenhuma linha chegava em `founder_api_chamadas` em produção (no dev local chegava). Causa: o preset cloudflare-module do Nitro chama o `fetch` do `server.ts` só com a Request e guarda o ExecutionContext em `req.waitUntil` / `req.runtime.cloudflare.context`; sem `waitUntil`, o Worker cancela qualquer promessa solta quando a resposta sai. Solução em `src/lib/segundo-plano.server.ts`: resolve o contexto a partir da Request, guarda por AsyncLocalStorage e mantém uma fila global drenada pelo fetch handler. Detalhe do Worker: `Date.now()` só anda em I/O, então latência de SSR mede ~0 ms — o p95 do monitor usa só server functions.

Também corrigida a FK `founder_alertas.resolvido_por` (agora `on delete set null`): sem isso, apagar a conta de uma admin que resolveu um alerta travava o `auth.admin.deleteUser`.

## 2026-09-17 — Founder Dashboard, bloco 3 (analytics de uso, só no polia-admin)

- Migration `20260917185343_founder_analytics_funcoes.sql`: `founder_funil_config` (passos do funil editáveis, seed "Padrão") e funções SECURITY DEFINER `founder_sessoes_calc`, `founder_tempo_por_feature`, `founder_heatmap`, `founder_retencao_coortes` (execute só pro service role).
- No admin: `src/lib/founder-analytics.functions.ts` + 9 páginas em `/founder/analytics/*` (visão geral, usuárias, perfil `$id`, sessões, retenção, comportamento, funcionalidades, jornadas, segmentos). Em vez de view materializada, as sessões são calculadas na hora pela função SQL (volume pré-lançamento é pequeno); materializar quando `founder_eventos` passar de algumas centenas de milhares de linhas.

## 2026-09-17 — Founder Dashboard, bloco 4 (feature flags)

- Migration `20260917190737_founder_flags_schema.sql`: `founder_flags` (pk key+ambiente, estado on/off/beta, rollout_pct, beta_user_ids, atualizado_por), `founder_flags_historico` preenchida por trigger, seed das 5 flags de `feature_flags` em prod e preview com o mesmo estado.
- `src/lib/flags-regra.ts` (regra pura + bucket sha256 de `userId:key`, testada), `src/lib/flags.ts` (client, cache 60 s, ambiente pelo hostname) e `src/lib/flags.server.ts` (Worker, sem cache).
- Leitores migrados: `csat.ts` (padrão false), `aimer.functions.ts`, `planejamentoIa.functions.ts`, `planoConteudo.functions.ts`, `raiox.functions.ts` (padrão true, kill-switch) e o cron `raiox-mensal-cron` (off desliga o lote; rollout/beta filtram por usuária).
- `feature_flags` fica intocada até a Sil confirmar que tudo está lendo da nova (a tela antiga `/flags` do admin ainda escreve nela e não tem mais efeito).

## 2026-09-17 — Founder Dashboard, bloco 5 (produto, só no polia-admin)

- Migration `20260917192140_founder_experimentos_schema.sql`: `founder_experimentos` (flag + evento-métrica; variante = lado da flag).
- Admin: `src/lib/founder-produto.functions.ts` e páginas `/founder/produto/ativacao` (taxa de ativação = onboarding + 1ª ação de valor em 7 dias, tempo até o 1º valor, D1/D7/D30, coortes semanais, quem não ativou), `/produto/funil` (onboarding), `/produto/feedback` (CSAT de `feedback_responses` + chamados), `/produto/experimentos` (resultados com × sem flag) e `/features/experimentos` (configuração).

Próximo: bloco 6, operação/infra/negócio (erros, logs, jobs, integrações, API, banco, storage, IA, releases, receita/assinaturas/conversão/churn).

## 2026-09-17 — Founder Dashboard, bloco 6 (operação, infra, negócio, releases)

- Migration `20260917193353_founder_operacao_funcoes.sql`: funções SECURITY DEFINER `founder_jobs_status(p_horas)` (cron.job + job_run_details), `founder_banco_status()` (pg_database_size, pg_stat_activity, tabelas maiores, top 10 de `extensions.pg_stat_statements`) e `founder_storage_status(p_dias)` (buckets × objetos × bytes), execute só pro service role; tabela `founder_releases` (registro manual, RLS admin).
- Admin: `founder-operacao.functions.ts` (erros de `erros_app`, logs de `founder_eventos_sistema`, jobs, integrações: Stripe webhook, Resend, Google Agenda, IA), `founder-infra.functions.ts` (API p50/p95/p99 e taxa de erro de `founder_api_chamadas`, banco, storage, IA com custo estimado por modelo), `founder-negocio.functions.ts` (receita = faturas pagas no Stripe no período, MRR/ARR por price, assinaturas, conversão conta → assinante e teste → paga, churn sobre o snapshot diário; releases). 13 páginas trocam os últimos `EmConstrucao`.
- Detalhe do banco: `pg_stat_statements` mora no schema `extensions`, então a função qualifica o nome e põe `extensions` no `search_path`.

Com isso os 6 blocos do plano estão no ar. Pendências fora do código: `RESEND_API_KEY` rotacionada e válida; `STRIPE_SECRET_KEY` ainda precisa da chave `sk_live_` certa; cron duplicado já desagendado; dropar `feature_flags` numa migration própria quando a Sil confirmar.

## 2026-10-05 — Tour de boas-vindas e dicas de primeira visita (Pólia One)

- Proposta aprovada pela Sil no chat: 4 balões na primeira chegada ao Painel (Planejamento, Aimer, botão principal do Painel, presença) + uma faixa "Entendi" na primeira visita de 11 telas + "Rever o tour" em Configurações > Ajuda.
- Estado em `profiles.dicas_vistas text[]` (migration `20261005180000_profiles_dicas_vistas.sql`), não no localStorage, pra não voltar em outro aparelho. Se a coluna não existir ou a leitura falhar, nada aparece (fail closed).
- Código: textos e regra pura em `src/lib/dicas.ts` (+ teste), hook `useDicasVistas`, `components/dicas/` (TourBoasVindas com Popover do Radix ancorado em `data-tour`, DicaDaTela, BotaoReverTour) e prop `dica` no `PaginaLogada`, usada só no retorno principal de cada tela (nunca no carregamento nem no portão do Pro).
- Copy das dicas conferida contra o código de cada tela; 7 textos da proposta foram ajustados porque prometiam o que a tela não faz (Projeção sem "vender o dobro", Raio-x só lê totais, Clientes guarda um pedido por cliente, Painel só acompanha a Meta do mês, Plano de conteúdo gera o ano de uma vez, Calendário não mostra posts, Planner é por projeto).

## 2026-10-05 — Varredura de design system na área logada + Aimer fora do produto

- Botões das 25 telas no padrão de `lib/botoes.ts` (BTN_ACAO/CONTORNO/MIUDO/PRIMARIO); pílula clicável virou forma canônica; alvos de toque de 44px; `role="alert"` nos erros; erro cru do banco virou frase da Pólia (técnico no console).
- Decisões da Sil aplicadas: sidebar escondida no onboarding; foco dos campos sem a sombra turquesa-clara (reprovava 3:1), borda `--secondary-text` + contorno global; hover removido de elemento não clicável (cards do Financeiro, linha de cliente, chips de canal, "→ Abre agora"); Fraunces itálico de parágrafo virou Inter; rótulo em caixa alta = DM Sans 700 (`font-accent font-bold`); "pró-labore" virou "salário" com texto de apoio na Projeção, que agora avisa sucesso/erro ao salvar.
- Aimer sai de todo texto visível do produto (revoga exceção de 28/09): IA fala como Pólia One, menu "Assistente", prompts de sistema sem o nome. Registrado no CLAUDE.md.
- Movimento: balão do tour nasce do item apontado (zoom 95%→100%, 200ms); botões com `transition-colors` voltaram a animar o aperto.

## 2026-10-05 — Bugs do Planejamento + Pólia One em todo o produto

- Perda de dados: o rascunho de IA era salvo com o valor antigo (vazio), porque o array novo era montado dentro do updater do setState e o save rodava antes do render. Agora `definirValor` monta fora; upserts de resposta e de seção conferem o erro e mostram toast em vez de "Salvo" falso; a página do módulo usa `key` pelo número (estado não vaza do módulo 1 pro 2).
- Pulo pro Painel: o `router.invalidate` de cada renovação de login reexecutava o beforeLoad do onboarding, que redireciona quando `onboarding_completed` (vira true no passo 4). Agora só redireciona com `cause !== "stay"`.
- Clique em módulo concluído sem respostas abre o módulo (antes não fazia nada).
- IA do Planejamento complementa o texto da usuária (vai no prompt); com campo vazio o botão some e aparece a dica. Servidor recusa `sem_texto` antes de gastar cota.
- Presença removida da sidebar, do Painel e do tour (3 balões). Toasts com fundo por tipo. Lembrete diário do módulo em andamento (`LembretePlanejamento`, 1x por dia por aparelho, nunca junto do tour).
- "Pólia" → "Pólia One" nos textos do produto (script com o parser do TS); site público, iscas, remetente de e-mail, cookies e páginas de erro continuam "Pólia".

## 2026-10-05 — Plano de conteúdo pelo banco fixo de ideias (sem IA)

- Decisão da Sil: o Plano de conteúdo deixa de usar IA. `src/lib/bancoIdeias/` tem 8 nichos × 60 ideias (tipos, categorias, voz revisados; teste de qualidade em `bancoIdeias.test.ts`). A usuária escolhe UM nicho (`MAX_NICHOS = 1`) e `montarPlanoConteudoDoBanco` grava o ano em `ia_plano_conteudo` (mesma tabela e mesma tela). Trocar de nicho refaz só de hoje em diante.
- Sem cota, sem exigir Planejamento completo; continua no Pro. O código da geração por IA (`gerarPlanoConteudo`) ficou sem uso, apagar quando a Sil confirmar.
- Revisão das ideias pela Sil: https://claude.ai/artifact/ERUAoBZV2NtHs8juTZ5eZC
