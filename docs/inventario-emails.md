# Inventário de e-mails da Pólia

Varredura de 17/08/2026. Todo ponto do código que dispara e-mail, onde ele mora,
quem recebe e por qual template.

**14 e-mails no total:** 11 pelo Resend (4 no app, 7 nas edge functions) e 3 pelo
Supabase Auth (template no dashboard, não no repositório).

Remetente único em todos os 11 do Resend: `Pólia <naoresponda@usepolia.com.br>`.

---

## 1. Pelo Resend, no app (Worker `tanstack-start-app`)

Todos usam o template central [`src/lib/email-template.ts`](../src/lib/email-template.ts)
(`emailPolia` + `enviarEmailResend`), que já está na paleta v3 e com Cabinet Grotesk.

| # | E-mail | Assunto | Vai para | Gatilho | Arquivo |
|---|---|---|---|---|---|
| 1 | Boas-vindas | `Bem-vinda à Pólia` | a usuária | primeiro load do `/onboarding` (só marca como enviado se o Resend confirmar) | [boas-vindas.functions.ts](../src/lib/boas-vindas.functions.ts) |
| 2 | Convite | `Você foi convidada pra Pólia` | a convidada | admin cria convite em `/admin/convites` | [convites.functions.ts](../src/lib/convites.functions.ts) |
| 3 | Diagnóstico do quiz | `Seu diagnóstico: {faixa}` | o lead | fim do `/quiz`, após o gate de e-mail | [quiz.functions.ts](../src/lib/quiz.functions.ts) + [quiz/email.ts](../src/lib/quiz/email.ts) |
| 4 | Contato (interno) | `[Contato] {assunto} · {nome}` | `oi@usepolia.com.br` | envio do formulário `/contato` | [contato.functions.ts](../src/lib/contato.functions.ts) |

O nº 3 é o **único** com `List-Unsubscribe`, link de descadastro no rodapé e
`reply-to: oi@usepolia.com.br` — correto, é o único que não é transacional puro.
O nº 4 também tem `reply-to`, apontando pra quem escreveu.

## 2. Pelo Resend, nas edge functions do Supabase

As 4 do Stripe passaram a usar o template compartilhado em 17/08/2026 (ver
"O que a varredura encontrou", item 1). As outras 3 ainda não.

| # | E-mail | Assunto | Vai para | Gatilho | Arquivo |
|---|---|---|---|---|---|
| 5 | Compra confirmada / ativação | `Sua compra foi confirmada — crie sua senha` | quem comprou | `checkout.session.completed` | [stripe-webhook](../supabase/functions/stripe-webhook/index.ts) |
| 6 | Pagamento recusado | `Não conseguimos cobrar seu cartão` | a assinante | `invoice.payment_failed` | stripe-webhook |
| 7 | Cancelamento | `Sua assinatura foi cancelada` | a assinante | `customer.subscription.deleted` | stripe-webhook |
| 8 | Renovação chegando | `Sua assinatura renova em breve` | a assinante | `invoice.upcoming` | stripe-webhook |
| 9 | Raio-x pronto | `Seu raio-x de {mês} está pronto` | a assinante Projete | cron mensal | [raiox-mensal-cron](../supabase/functions/raiox-mensal-cron/index.ts) |
| 10 | Falha do token do Instagram (interno) | `A renovação do token do Instagram falhou ({conta})` | a Sil | cron de renovação falhou | [social-token-renovar](../supabase/functions/social-token-renovar/index.ts) |
| 11 | DM respondida (interno) | `Alguém respondeu a DM do @usepolia` | a Sil | webhook do IG, janela de 24h aberta | [ig-webhook](../supabase/functions/ig-webhook/index.ts) |

## 3. Pelo Supabase Auth (template fora do repositório)

Não passam pelo Resend nem pela marca da Pólia — saem no layout padrão do Supabase,
configurado no dashboard do projeto.

| # | E-mail | Gatilho | Onde o código chama |
|---|---|---|---|
| 12 | Confirmação de cadastro | `signUp` no `/auth/cadastro`; reenvio em `/auth/login` e `/auth/verificacao` | [cadastro.tsx:119](../src/routes/auth/cadastro.tsx#L119) |
| 13 | Redefinição de senha | `resetPasswordForEmail` no `/auth/esqueci-senha` | [esqueci-senha.tsx:42](../src/routes/auth/esqueci-senha.tsx#L42) |
| 14 | Troca de endereço de e-mail | `updateUser({ email })` em `/configuracoes` | [configuracoes.tsx:340](../src/routes/_authenticated/configuracoes.tsx#L340) |

---

## O que a varredura encontrou de errado

### Alta — os 4 e-mails que mais valem dinheiro estavam fora da marca · CORRIGIDO 17/08/2026

`stripe-webhook/index.ts:144` tinha uma **cópia própria de `emailPolia`** que não
acompanhou a virada v3. Ela usava:

- `font-family:Georgia,'Times New Roman',serif` no logo e no `<h1>` — serifada de
  display, exatamente o que o CLAUDE.md proíbe. O template central usa Cabinet Grotesk.
- rodapé em `#9E9E9E`, que o comentário do template central marca por escrito como
  cor morta ("reprova AA sobre `#F2F0ED`, saiu do sistema"). O certo é `#6B6B6B`.
- sem `letter-spacing:-0.02em` no título, sem caixa de destaque pêssego.

Isso atingia compra confirmada, pagamento recusado, cancelamento e renovação — os
quatro momentos em que a assinante mais olha o e-mail.

**Como ficou:** a casca HTML saiu dos dois lugares e virou uma cópia só, em
[`supabase/functions/_shared/email-polia.ts`](../supabase/functions/_shared/email-polia.ts).
Mora em `_shared` porque é a única pasta que o `supabase functions deploy` garante
empacotar; o build do app resolve o caminho relativo sem problema, então
`src/lib/email-template.ts` só reexporta e ficou com o transporte (chave, fetch,
registro de falha). O `stripe-webhook` importa de lá e perdeu a cópia local.

O comentário antigo mandava "manter os dois em sync" e não manteve. No lugar dele
entrou [`src/lib/email-template.test.ts`](../src/lib/email-template.test.ts), que
trava as invariantes da marca (Cabinet Grotesk, nenhuma serifada, só hex que é
token, nada de `#9E9E9E`/`#767676`) e varre todas as edge functions atrás de
qualquer uma que volte a declarar a própria casca.

### Alta — o e-mail do raio-x não tem HTML nenhum

`raiox-mensal-cron` manda só `text`, com a URL solta no corpo. Chega como texto puro,
sem marca, sem botão. É o e-mail do recurso mais caro do produto.

### Média — quem entra na lista de espera não recebe nada

`lista-espera.functions.ts` grava a linha e encerra. Nenhuma confirmação sai. Até
outubro todo CTA público aponta pra lá, então é o fim de linha silencioso do funil.

### Média — falha de envio nas edge functions não chega no admin

O app registra falha de e-mail em `erros_app` (tela no `/admin`). As 7 edge functions
só fazem `console.error` no log do Worker. Foi assim que a `RESEND_API_KEY` faltante
passou despercebida até 12/08.

### Baixa — os dois avisos internos mandam HTML cru

`ig-webhook` e `social-token-renovar` montam `<p>` na mão. São internos, só pra Sil,
então o impacto é estético — mas passariam pelo template central sem custo.
