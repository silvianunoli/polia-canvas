# Plano técnico: Fase 3c, Mercado Livre direto

> 24/10/2026 · **aprovado pela Sil em 24/10, com as 4 sugestões da §9.** Cards VND-30 (esta fase), VND-31 (app
> no DevCenter).
> Base: `docs/plano-modulo-vendas-canais.md` §5 e §8 (um adaptador por canal com a mesma interface),
> `docs/plano-fase3a-tiktok-shop.md` (o desenho que já está no ar) e o que a 3a deixou no banco
> (`20261024100000_canal_conexoes_tiktok.sql` até `20261024200000_tiktok_revisao_seguranca.sql`).
> A documentação do Mercado Livre devolveu 403 para leitura automática em 24/10; os pontos marcados
> **(conferir)** saíram de busca e precisam ser confirmados na doc oficial ou na conta de teste.

## 1. O que a usuária ganha, em uma frase

Ela conecta a conta do Mercado Livre em Configurações, liga cada anúncio ao produto da Pólia na mesma prévia do
TikTok, e a partir daí **todo pedido pago no Mercado Livre vira venda na Pólia sozinho**, já com a tarifa real
que o Mercado Livre cobrou e o frete que ela pagou. Se "a Pólia cuida do estoque" estiver ligado, a quantidade
volta para o Mercado Livre a cada venda ou ajuste, em qualquer canal.

A diferença que mais importa para a Ana: no TikTok a taxa entra **estimada** (a conta de teste não tem as APIs
financeiras). No Mercado Livre a comissão vem **no próprio pedido**, item por item. O "quanto lucra" por canal
fica exato desde o primeiro pedido.

Fica fora desta fase: criar anúncio (Fase 7), perguntas e mensagens das compradoras (Fase 6), saldo e repasse do
Mercado Pago (outra API, outro card), etiqueta de envio.

## 2. O que muda em relação ao TikTok Shop

| Ponto | TikTok Shop (3a) | Mercado Livre (3c) | Efeito no código |
|---|---|---|---|
| Cadastro do app | Partner Center, aprovação de parceiro | DevCenter, sem aprovação: Client ID e Secret na hora | dá para começar já, sem fila de espera |
| Ambiente de teste | loja de desenvolvimento | **não tem sandbox**: usuários de teste criados pela API (`POST /users/test_user`), que operam em produção, até 10 por conta, só compram e vendem entre si e somem após 60 dias parados | criar 1 vendedora e 1 compradora de teste; nunca testar com conta real |
| Token de acesso | 7 dias | **6 horas** | renovação bem mais frequente |
| Token de renovação | reaproveitável | **uso único**: cada renovação devolve um novo, e o velho morre | duas renovações ao mesmo tempo derrubam a conexão; ver §5 |
| PKCE | não | opcional e recomendado | ligar, guarda o verificador junto do `state` |
| Webhook | assinado (HMAC) | **sem assinatura**; o aviso traz só `resource`, `user_id`, `topic`, `application_id` | nunca confiar no aviso: conferir app e vendedora conhecida e buscar o pedido na API com o token dela |
| Tempo de resposta do webhook | < 3 s | responder 200 na hora, a doc fala em 500 ms **(conferir)** | a função só grava na fila, como já faz o `tiktok-webhook` |
| Aviso perdido | varredura de 15 min | varredura de 15 min + `GET /missed_feeds?app_id=` | a varredura usa os dois |
| Taxa do canal | estimada pela regra em `taxas.ts` | **real**: `sale_fee` em cada item do pedido | a estimativa só fica para a calculadora (`listing_prices`) |
| Frete | não entra | custo do envio que a vendedora paga sai do envio do pedido (`/shipments/{id}/costs`) **(conferir campo)** | coluna nova, ver §3 |
| Estoque no centro do canal | não existe | anúncio no **Full** tem o estoque no galpão do Mercado Livre, e a API não deixa editar | anúncio Full só lê, nunca recebe estoque da Pólia |
| Identificador da loja | `shop_id` + `shop_cipher` | `user_id` da vendedora no Mercado Livre | entra em `shop_id`; `shop_cipher` fica vazio |

## 3. Banco (uma migration)

Nenhuma tabela nova. A 3a já criou tudo com `canal` como coluna, então o Mercado Livre entra ampliando a lista:

| Objeto | Mudança |
|---|---|
| `check (canal in (...))` em `canal_conexoes`, `anuncio_vinculos`, `canal_eventos`, `canal_fila_estoque` e na lista de canais de `vendas` | entra `'mercado_livre'` |
| `registrar_venda_canal` / `cancelar_venda_canal` | aceitam `'mercado_livre'`; `registrar_venda_canal` ganha `p_custo_envio numeric default 0` |
| `vendas.custo_envio` (nova coluna, `>= 0`, default 0) | frete pago pela vendedora, separado da tarifa. Decisão 3 da §9 |
| `canal_conexoes.verificador_pendente` | verificador do PKCE, gravado no Conectar e zerado na volta, igual ao `state_pendente` |
| RPC `canal_token_reservar_renovacao(conexao_id)` | trava a linha (`for update skip locked`) e só devolve o token de renovação para quem pegou a trava. Ver §5 |
| `disparar_ml_sync()` + `cron.schedule('ml-sync', '* * * * *', ...)` | mesmo padrão do `disparar_tiktok_sync` |
| formas de recebimento de `taxas_recebimento` | entra `mercado_livre`, para venda manual e calculadora por canal |

A limpeza de `canal_eventos` com mais de 7 dias, que a 3a.5 agendou, já cobre o canal novo.

## 4. Código

| Arquivo | O que faz |
|---|---|
| `supabase/functions/_shared/canais.ts` | **sai do `tiktokShop.ts`** o que não é do TikTok: `sugerirVinculos`, `AnuncioCanal`, `SkuPolia`, `ItemVendaCanal`, `StatusVendaCanal`. O TikTok passa a importar daqui, sem mudar comportamento (testes atuais seguram) |
| `supabase/functions/_shared/mercadoLivre.ts` | regras puras: URL de autorização com PKCE, status do pedido → status da venda, pedido → itens, tarifa real do pedido, aviso → id do pedido (com a conferência de app e vendedora), corpo de estoque por anúncio e variação, anúncio Full ou não |
| `supabase/functions/_shared/mercadoLivreCliente.ts` | cliente HTTP: trocar o código por token, renovar, `/users/me`, anúncios da vendedora, detalhe do anúncio, pedido, custo do envio, pedidos alterados desde, `missed_feeds`, atualizar estoque |
| `src/lib/mercadoLivre.functions.ts` | server functions: status, iniciar conexão, finalizar conexão, desconectar, ligar/desligar "cuida do estoque" |
| `src/lib/mercadoLivreAnuncios.functions.ts` | listar anúncios para a prévia e salvar vínculos |
| `src/lib/mercadoLivreAcesso.server.ts` | pega o token válido da conexão (igual ao `tiktokShopAcesso.server.ts`) |
| `supabase/functions/ml-webhook` | recebe o aviso, confere `application_id` e se a vendedora tem conexão, grava na fila, responde 200 |
| `supabase/functions/ml-sync` | processa a fila de pedidos e de estoque, faz a varredura de 15 min com `missed_feeds` e renova tokens |
| `src/routes/_authenticated/configuracoes_.integracoes.mercado-livre.tsx` | volta da autorização (code + state) |
| `src/routes/_authenticated/configuracoes_.integracoes.mercado-livre_.anuncios.tsx` | prévia de vínculo (mesma tela do TikTok, com a marca "Full") |
| `configuracoes.tsx` (seção Integrações) | card do Mercado Livre abaixo do TikTok Shop |
| `src/lib/taxas.ts` | `mercado_livre` em `MARKETPLACES_COM_TAXA` e `ROTULO_TAXA` |

Variáveis de ambiente: `MERCADO_LIVRE_CLIENT_ID`, `MERCADO_LIVRE_CLIENT_SECRET`, `MERCADO_LIVRE_REDIRECT_URI`, no
Worker e nas Edge Functions. Integração escondida quando faltar alguma, como as outras.

## 5. Regras de negócio

- **Quando o pedido vira venda:** status `paid`. `payment_required` e `payment_in_process` não entram. Entra
  como **a receber**, como no TikTok.
- **Cancelado** (`cancelled`) depois de virar venda: `cancelar_venda_canal` devolve o estoque e tira do
  Financeiro. **Devolução parcial** (`partially_refunded`): a venda fica e o card avisa, sem mexer em estoque.
  Ajuste fino fica para o card de repasse.
- **Pedido com a tag `fraud_risk_detected`:** não vira venda. Se já tinha virado, cancela.
- **Carrinho com vários anúncios:** o Mercado Livre agrupa pedidos num `pack`, mas cada pedido tem id próprio.
  A Pólia registra **um pedido = uma venda**, com o id do pedido como `id_externo`. Assim a idempotência que já
  existe vale sem mudança.
- **Tarifa:** soma de `sale_fee × quantidade` dos itens do pedido. Sem estimativa.
- **Frete:** o que a vendedora pagou pelo envio entra em `custo_envio`. Frete pago pela compradora não entra,
  porque não passa pelo caixa dela.
- **Item sem vínculo:** entra sem baixar estoque e o card avisa, mesma decisão do TikTok (24/10).
- **Compradora:** a Pólia não guarda nome, apelido, telefone nem endereço. A venda fica sem cliente.
- **Estoque Pólia → Mercado Livre:** manda o saldo absoluto (`available_quantity`), por anúncio ou por variação.
  Saldo zero pausa o anúncio no Mercado Livre e saldo acima de zero reativa. A tela avisa isso antes de ela
  ligar. **Anúncio Full fica de fora**: a Pólia lê o estoque do galpão e mostra, mas não envia.
- **Renovação do token (o ponto mais delicado):** como o token de renovação só vale uma vez, toda
  renovação passa por uma trava por conexão (`canal_sync_travas`, chave `ml_token:<conexão>`, 30 s). Quem pega a
  trava renova e grava o par novo (3 tentativas); quem não pega espera o token novo aparecer, sem gastar o de
  renovação. Ajuste da 3c.2: o Worker também precisa de token para listar anúncios, então renova pela mesma
  trava em vez de deixar só o `ml-sync`. Renova quando faltam menos de 10 minutos. Recusa do Mercado Livre
  (400/401) põe a conexão em `erro` e o card pede para conectar de novo; falha de rede não derruba.
- **Desconectar:** apaga a conexão, os tokens do Vault e os vínculos na hora. A Pólia também tenta tirar a
  autorização do lado do Mercado Livre pela API **(conferir a chamada na conta de teste)**. As vendas ficam.

## 6. Telas (wireframe em cinza)

**6.1 Configurações > Integrações, card do Mercado Livre (não conectado)**
```
┌──────────────────────────────────────────────────────────────┐
│ [ícone]  Mercado Livre                                        │
│ Pedidos pagos viram venda na Pólia, com a tarifa e o frete    │
│ que o Mercado Livre cobrou.                                   │
│                                                               │
│ O que a Pólia importa: anúncios, pedidos, tarifas, frete e    │
│ quantidades.                                                  │
│ O que a Pólia não faz: criar anúncio, responder compradora,   │
│ guardar dados de quem comprou.                                │
│ Antes de conectar: entrar com a conta dona da loja, não com   │
│ a de colaboradora.                                            │
│                                                               │
│ [ Conectar Mercado Livre ]                                    │
└──────────────────────────────────────────────────────────────┘
```

**6.2 O mesmo card, conectado**
```
┌──────────────────────────────────────────────────────────────┐
│ [ícone]  Mercado Livre · LOJADAANA                 Conectada  │
│ Última sincronização há 3 min                                 │
│                                                               │
│ 18 anúncios ligados · 2 sem produto  [ Ligar anúncios ]       │
│ 4 anúncios no Full: a Pólia mostra o estoque, mas quem cuida  │
│ é o Mercado Livre.                                            │
│                                                               │
│ [x] A Pólia cuida do estoque                                  │
│     Toda venda em qualquer canal atualiza a quantidade no     │
│     Mercado Livre. Quantidade zero pausa o anúncio.           │
│                                                               │
│ Desconectar                                                   │
└──────────────────────────────────────────────────────────────┘
```
Estado de erro: "A conexão com o Mercado Livre caiu. Os pedidos novos não estão entrando. [ Conectar de novo ]"

**6.3 Ligar anúncios:** a mesma tela do TikTok (sugestão por SKU, depois por nome), com uma etiqueta "Full" nas
linhas que não recebem estoque.

**6.4 Vendas:** sem tela nova. A venda chega com a etiqueta "Mercado Livre", e o detalhe mostra tarifa e frete
separados.

## 7. Ordem de entrega (cada uma sobe separada)

| Etapa | Entrega | Testa como |
|---|---|---|
| 3c.0 | **Sua parte:** criar o app no DevCenter (roteiro na §10) | Client ID e Secret em mãos |
| 3c.1 | migration, `_shared/canais.ts` (TikTok continua verde), regras puras com testes, conectar/desconectar, card 6.1/6.2 | conectar a vendedora de teste |
| 3c.2 | listar anúncios e prévia de vínculo | 2 anúncios de teste, um com variação |
| 3c.3 | webhook, fila, venda com tarifa e frete, varredura com `missed_feeds`, renovação com trava | compradora de teste compra da vendedora de teste |
| 3c.4 | estoque Pólia → Mercado Livre, Full de fora | ajustar estoque na Pólia e ver o anúncio mudar |
| 3c.5 | revisão de segurança, ADR "renovação de token de uso único", teste de 7 dias seguidos sem a conexão cair | antes de abrir para as usuárias |

## 8. Riscos

- **Token de renovação de uso único:** o maior risco. Mitigado com renovação só no `ml-sync`, trava no banco e
  teste de vários dias na 3c.5. Se mesmo assim cair, a usuária vê o estado de erro em vez de pedido sumido.
- **Webhook sem assinatura:** qualquer um pode mandar um aviso falso. Mitigado porque o aviso só põe um id na
  fila; a venda só nasce do pedido buscado na API com o token da própria vendedora.
- **Modelo novo de anúncios do Mercado Livre (User Products, preço por variação):** parte dos anúncios já usa
  `user_product_id` e estoque por local. Confiro na conta de teste qual caminho o PUT de estoque exige.
- **Full e Flex juntos:** o mesmo produto pode ter estoque no galpão e no endereço dela. A Pólia só mexe no do
  endereço dela, e só se a doc do Brasil liberar **(conferir: a página encontrada fala de MLA e MLC)**. Se não
  liberar, anúncio com Full fica todo em leitura.
- **Sem sandbox:** usuário de teste opera em produção. Nunca usar a conta da Sil nem a da Pólia para comprar.
- **Conta de colaboradora:** pelo que a busca mostrou, só a conta dona autoriza app **(conferir)**. O card avisa
  antes.
- **Limite de chamadas:** varredura e estoque respeitam o limite e repetem com espera, como no TikTok.
- **Inatividade:** autorização sem chamada por 4 meses é invalidada. Com o `ml-sync` rodando, não acontece.

## 9. Decisões

**Decididas pela Sil em 24/10:** Mercado Livre antes da Shopee; só no Pro; frete pago pela vendedora em coluna
própria (`custo_envio`); anúncio no Full só leitura. O texto abaixo fica como registro do que foi proposto.

1. **Ordem: Mercado Livre antes da Shopee?** Sugestão: **sim**. O Mercado Livre não pede aprovação de parceiro,
   então começa amanhã, e é o maior marketplace do Brasil. A Shopee continua dependendo de aprovação, e o
   pedido pode sair em paralelo, com dois canais no ar pesando a favor.
2. **Em que plano entra:** sugestão, **Pro**, igual ao TikTok Shop.
3. **Frete pago pela vendedora:** sugestão, **coluna própria** (`custo_envio`), para o lucro por canal mostrar
   "tarifa" e "frete" separados. Alternativa mais simples: somar na tarifa.
4. **Anúncio no Full:** sugestão, **só leitura**, com o aviso no card.

## 10. Roteiro da etapa 3c.0 (sua parte, uns 15 minutos)

1. Entrar em developers.mercadolivre.com.br com a conta do Mercado Livre **da Pólia**, não a pessoal.
2. "Criar uma aplicação": nome **Pólia One**, descrição curta, logo.
3. URI de redirecionamento: `https://one.usepolia.com.br/configuracoes/integracoes/mercado-livre`
   (mesmo domínio do TikTok, conferido no `.env.example` em 24/10).
4. Ligar **PKCE**.
5. Escopos: leitura, escrita e acesso offline.
6. Tópicos de notificação: **Orders (orders_v2)** e **Items**. URL de notificação: eu passo o endereço da
   edge function `ml-webhook` quando a 3c.3 subir.
7. Me mandar só o Client ID (não é segredo). O Secret você grava direto nas variáveis, comandos abaixo:

```powershell
npx wrangler secret put MERCADO_LIVRE_CLIENT_SECRET
npx supabase secrets set MERCADO_LIVRE_CLIENT_SECRET=COLE_AQUI
```

## Fontes consultadas

- Autenticação e autorização (token de 6 h, renovação de uso único, PKCE, invalidação por 4 meses):
  https://developers.mercadolibre.cl/en_us/authentication-and-authorization
- Criar aplicação: https://developers.mercadolivre.com.br/pt-br/crie-uma-aplicacao-no-mercado-livre
- Notificações (`orders_v2`, `resource`, `missed_feeds`): https://developers.mercadolivre.com.br/pt-br/produto-receba-notificacoes
  e https://developers.mercadolibre.com.ar/devsite/receive-notifications
- Pedidos e `fraud_risk_detected`: https://developers.mercadolivre.com.br/en_us/manage-sales
- Comissão por vender (`listing_prices`, `sale_fee`): https://developers.mercadolivre.com.br/pt-br/comissao-por-vender
- Sincronizar anúncios (`available_quantity`, pausa com zero): https://developers.mercadolivre.com.br/pt-br/produto-sincronizacao-de-publicacoes
- Preço por variação: https://developers.mercadolivre.com.br/pt-br/preco-variacao
- Estoque distribuído e Full: https://developers.mercadolibre.com.ar/en_us/distributed-stock e
  https://developers.mercadolivre.com.br/en_us/full-and-flex-coexistence
- Usuários de teste (sem sandbox, até 10, 60 dias): https://developers.mercadolivre.com.br/pt-br/realizacao-de-testes
  e https://developers.mercadolivre.com.br/en_us/start-testing
