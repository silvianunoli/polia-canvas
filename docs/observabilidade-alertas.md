# Alertas de incidente de produção

> Referência técnica. Consultada quando um alerta chega, ou pra ajustar limites/gatilhos.

## Por quê

Antes disso, a única observabilidade era a tabela `erros_app` (interna ao Supabase, consultada só via `/admin/qualidade` ou o botão manual em `/admin/alertas`). Se o Worker caísse por completo, ou a Cloudflare tivesse um incidente, nada avisava ninguém — e o produto processa pagamento real em Stripe LIVE.

## Provedor

**Telegram**, não WhatsApp — decisão explícita (ver conversa de 2026-07-10): sem aprovação de template, sem custo por mensagem, setup em minutos. Bot próprio via [@BotFather](https://t.me/BotFather).

## Arquitetura

Um ponto único de disparo: a edge function `supabase/functions/alertas-criticos`. Ela:

1. Autentica por segredo compartilhado (`ALERTAS_SECRET`, header `x-alertas-secret` ou query `?secret=`) — não por JWT de usuária, porque quem chama (Worker, webhook, cron) não tem sessão.
2. Aplica dedup/rate-limit por `tipo`: no máximo 1 mensagem a cada 10 min. Repetições dentro da janela só incrementam `ocorrencias` na linha aberta em `alertas_enviados`; quando a janela fecha, o próximo evento manda mensagem nova e menciona quantas vezes o tipo disparou em silêncio.
3. Envia a mensagem via Telegram Bot API (`sendMessage`).
4. Grava tudo em `alertas_enviados` (RLS: só admin lê; só a função — service role — escreve).

Três chamadores, três runtimes diferentes, todos batendo no mesmo endpoint HTTP:

| Chamador | Runtime | Onde |
|---|---|---|
| Worker Cloudflare | Node (nodejs_compat) | `src/lib/alertas.server.ts`, usado em `src/server.ts`, `src/lib/error-capture.ts`, `src/lib/stripe.functions.ts`, `src/lib/compra-publica.functions.ts` |
| Webhook do Stripe | Deno | `supabase/functions/stripe-webhook/index.ts` (função local `dispararAlerta`, mesmo segredo) |
| Checagem periódica de taxa de erro | Postgres (pg_cron + pg_net) | função `public.checar_taxa_erro_e_alertar()`, agendada a cada 5 min |

## Gatilhos configurados

| `tipo` | Onde dispara | O que significa |
|---|---|---|
| `health_down` | Webhook do monitor de uptime externo (configurar — ver abaixo) | `/health` não respondeu 200 — Worker ou Cloudflare fora do ar |
| `stripe_webhook_assinatura_invalida` | `stripe-webhook/index.ts` | Assinatura HMAC do Stripe não validou |
| `stripe_webhook_erro_processamento` | `stripe-webhook/index.ts` | Exceção ao processar um evento (`checkout.session.completed` etc.) — dinheiro passando batido |
| `erro_taxa_alta` | `checar_taxa_erro_e_alertar()` (pg_cron, a cada 5 min) | Mais de 15 linhas em `erros_app` nos últimos 10 min |
| `checkout_erro` | `stripe.functions.ts` (`iniciarAssinatura`) e `compra-publica.functions.ts` (`iniciarCompraPublica`) | Falha ao criar sessão/assinatura de checkout |
| `erro_servidor_critico` | `src/server.ts` (catch do fetch handler + resposta catastrófica do SSR) e `error-capture.ts` (erro/unhandledrejection global) | Erro não tratado no Worker — cobre falha de conexão com Supabase e qualquer exceção que escape dos try/catch específicos |

Threshold do `erro_taxa_alta` (15 erros / 10 min) está hardcoded em `checar_taxa_erro_e_alertar()` — mudar exige uma migration nova.

## Regra de dedup

1 mensagem por `tipo` a cada 10 minutos. Isso é por design (ver decisão de 2026-07-10): sem essa regra, um incidente real vira uma enxurrada de mensagens e o número acaba sendo silenciado.

## Setup necessário (passo a passo)

### 1. Criar o bot no Telegram

1. Abra conversa com [@BotFather](https://t.me/BotFather) no Telegram.
2. Envie `/newbot`, escolha um nome e um username (termina em `bot`).
3. O BotFather devolve um token (`123456:ABC-...`) — guarde, é o `TELEGRAM_BOT_TOKEN`.

### 2. Pegar seu chat_id

1. Envie qualquer mensagem pro bot recém-criado (ex: "oi").
2. Abra no navegador: `https://api.telegram.org/bot<SEU_TOKEN>/getUpdates`
3. No JSON retornado, pegue `result[0].message.chat.id` — é o `TELEGRAM_CHAT_ID`.

### 3. Configurar os secrets no Supabase

Rode no terminal, na pasta `polia-app/`:

```powershell
npx supabase secrets set TELEGRAM_BOT_TOKEN="<token do passo 1>" TELEGRAM_CHAT_ID="<chat_id do passo 2>" --project-ref egzwkyqpkexgrhbxwcvb
```

(`ALERTAS_SECRET` já foi configurado em 2026-07-10 — Worker + edge functions + Vault do Postgres.)

### 4. Configurar o monitor de uptime externo (UptimeRobot)

Isso **não pode viver dentro da Cloudflare** — se a Cloudflare cair, nada rodando dentro dela avisa sobre a própria queda.

1. Crie conta grátis em [uptimerobot.com](https://uptimerobot.com).
2. **Add New Monitor** → tipo HTTP(s) → URL `https://usepolia.com.br/health` → intervalo 5 min.
3. Em **Alert Contacts**, crie um contato tipo **Webhook**:
   - URL: `https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/alertas-criticos?secret=<ALERTAS_SECRET>`
   - Método: POST
   - Corpo customizado (JSON):
     ```json
     {"tipo":"health_down","titulo":"Health-check externo falhou","detalhes":{"monitor":"*monitorFriendlyName*","status":"*alertType*"},"link":"https://usepolia.com.br/admin/qualidade"}
     ```
4. Associe esse Alert Contact ao monitor do passo 2.

O valor de `ALERTAS_SECRET` está salvo no Vault do Postgres (`vault.decrypted_secrets`, nome `alertas_secret`) e nos secrets do Worker/Supabase — não está em nenhum arquivo versionado.

## Auditoria

`select * from alertas_enviados order by criado_em desc;` (via SQL Editor ou RPC admin) — mostra todo alerta disparado, se foi enviado com sucesso (`enviado`), a resposta do Telegram (`resposta_provedor`), e quantas ocorrências foram agregadas.

## O que falta (aberto)

- Sem UI dedicada em `/admin` pra ver `alertas_enviados` — hoje é consulta direta.
- Threshold de `erro_taxa_alta` fixo em 15/10min, não configurável pela UI de alertas existente (`alerta_regras`/`admin.alertas.tsx`) — são dois sistemas paralelos (o antigo é manual/sob demanda; este é automático).
