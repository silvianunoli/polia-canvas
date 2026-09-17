# ADR-001: Instrumentação de produto própria (founder_eventos), gravada sempre pra usuária logada

- **Data:** 2026-09-17
- **Status:** ☑ Aceito

## Contexto

O Founder Dashboard (`office.usepolia.com.br/founder`) precisa responder "as pessoas estão realmente usando a Pólia? como?" com DAU/WAU/MAU, sessões, retenção, funil e uso por feature (seções 4, 5 e 8 do direcionamento). O tracker que existia (`src/lib/analytics.ts` → `eventos_analytics`) tem dois limites: só grava com consentimento de cookies de análise (quem recusa some dos números, e o produto inteiro fica subestimado) e mistura navegação pública com uso do produto. A fundadora exigiu que o dashboard fosse construído do zero, sem se apoiar nos dados antigos.

## Decisão

Criar uma instrumentação separada (`founder_eventos`, `founder_eventos_sistema`, `founder_api_chamadas`) com eventos estruturados (signup, login, logout, onboarding_started/completed, business_created, feature_opened/completed, create/edit_product, create/edit_goal, subscription_started/cancelled, payment_failed, heartbeat, sessao_fim), sessão por `sessao_id`, e **gravar sempre que há sessão logada**, sem depender do banner de cookies. Base legal: execução do contrato / legítimo interesse (é o registro de uso do serviço contratado). Minimização: sem IP, user agent, geolocalização nem conteúdo digitado; só `user_id`, evento, feature, rota normalizada e propriedades técnicas. Retenção de 180 dias. A política de privacidade ganhou o item correspondente.

Páginas públicas (site, quiz, manual, lista de espera) continuam no `track()` antigo, gated por consentimento.

## Alternativas consideradas

- **Reaproveitar `eventos_analytics` com o gate de consentimento:** rejeitada — números sistematicamente incompletos e sem sessão/duração; contraria a exigência "do zero".
- **Ferramenta de terceiro (PostHog, Mixpanel):** rejeitada — dado de uso saindo da nossa base, custo, e o mesmo problema de consentimento por ser rastreador.
- **Gravar tudo só com consentimento, inclusive logada:** rejeitada — DAU/WAU/retenção viram estimativa; o dashboard teria que exibir "cobertura X%" e a fundadora não conseguiria confiar no número.

## Consequências

- **Positivas:** métricas de uso completas; sessão e duração medidas (heartbeat); base para retenção, funil, segmentos e alertas de queda de uso; API medida por middleware global (p95/p99, taxa de erro) sem token da Cloudflare.
- **Negativas / trade-offs:** volume (heartbeat de 60 s por usuária ativa) exige retenção e, com crescimento, particionamento; a política de privacidade passa a descrever esse registro.
- **Riscos:** heartbeat inflar duração se a aba ficar aberta sem uso — mitigado exigindo atividade nos últimos 2 min; RLS de insert aberto a `anon` com `user_id` nulo (mesmo modelo de `erros_app`) pode receber lixo — o `check` de allowlist de eventos limita o estrago.

## Referências

- `polia_founder_dashboard_direcionamento.pdf`, seções 4, 8 e 9.
- Plano de implementação: `~/.claude/plans/c-users-silnu-downloads-polia-founder-d-fizzy-hearth.md`.
- Migration `supabase/migrations/20260917170020_founder_eventos_schema.sql`.
