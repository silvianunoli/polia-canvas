# Plano técnico: Fase 3a, TikTok Shop direto

> 24/10/2026 · cards VND-05 (esta fase), VND-02 (cadastro). Nada codado ainda: regra da casa, plano aprovado
> antes de implementar. Base: `docs/plano-modulo-vendas-canais.md` §5 e §8, o que a Fase 1 deixou no banco
> (`20261023120000_vendas_estoque_fase1.sql` e seguintes) e a documentação do Partner Center lida em 23 e 24/10.

## 1. O que a usuária ganha, em uma frase

Ela conecta a loja do TikTok Shop em Configurações, liga cada anúncio ao produto da Pólia numa prévia que ela
aprova, e a partir daí **todo pedido pago no TikTok vira venda na Pólia sozinho**: baixa o estoque, entra no
Financeiro e aparece em Vendas com a etiqueta do canal. Se "a Pólia cuida do estoque" estiver ligado, a Pólia
manda a quantidade certa de volta para o TikTok a cada venda ou ajuste, em qualquer canal.

Fica fora desta fase: criar anúncio (Fase 7), chat com compradoras (Fase 6, precisa de outro app),
conferência de taxas e repasse (a conta de teste "Função principal" não tem as APIs financeiras; card ONE-135).

## 2. Como os dados andam

```
Autorizar loja        Pólia (Worker) ──link──▶ TikTok ──code+state──▶ /configuracoes/integracoes/tiktok
                      troca code por token ──▶ tokens no Supabase Vault (nunca em coluna aberta)

Pedido novo           TikTok ──webhook──▶ edge function tiktok-webhook
                      (confere assinatura, grava na fila, responde 200 em < 3 s)
                      pg_cron a cada 1 min ──▶ edge function tiktok-sync
                      (busca o pedido completo, registra a venda pela RPC nova)
                      pg_cron a cada 15 min ──▶ varredura de segurança (pedidos alterados desde o último sync)

Estoque               movimento na Pólia ──trigger──▶ fila de estoque ──tiktok-sync──▶ Update Inventory
                      (só SKUs vinculados, só se "a Pólia cuida do estoque" estiver ligado)

Token                 tiktok-sync renova quando falta menos de 1 dia (token vale 7 dias)
```

Por que edge function e não o Worker: o Worker não tem cron hoje, e o projeto já usa o padrão
pg_cron → segredo no Vault → edge function (lembretes, raio-x, publisher social).

## 3. Banco (uma migration)

| Tabela / objeto | Para quê | Acesso |
|---|---|---|
| `canal_conexoes` | uma linha por loja conectada: canal, shop_id, shop_cipher, nome da loja, status, ids dos segredos no Vault, expira_em, ultimo_sync, cuida_estoque | dona lê o próprio status; tokens nunca saem |
| `anuncio_vinculos` | SKU do TikTok ↔ `produto_skus`: canal, produto_externo_id, sku_externo_id, sku_id, sincroniza_estoque | dona lê e grava |
| `canal_eventos` | fila de webhooks e varreduras: canal, shop_id, tipo, id_externo, recebido_em, processado_em, tentativas, erro | só service role; payload mínimo, apagado em 7 dias |
| `canal_fila_estoque` | SKUs com estoque a enviar | só service role |
| RPCs de token | `canal_token_salvar`, `canal_token_ler`, `canal_token_apagar` (Vault) | só service role |
| RPC `registrar_venda_canal` | mesma regra da `registrar_venda` (baixa estoque, lança no Financeiro líquido da taxa), mas recebe user_id, canal e id_externo, e é idempotente pelo índice único que a Fase 1 já criou | só service role |
| RPC `cancelar_venda_canal` | pedido cancelado no TikTok: devolve estoque e apaga o lançamento | só service role |
| trigger em `estoque_movimentos` | põe na `canal_fila_estoque` os SKUs vinculados que mudaram | automático |

A `registrar_venda` atual usa `auth.uid()` e barra `tiktok_shop` de propósito; ela continua igual.

## 4. Código

| Arquivo | O que faz |
|---|---|
| `supabase/functions/_shared/tiktokShop.ts` | regras puras, usadas pelo Worker e pelas edge functions: assinatura das chamadas (HMAC-SHA256), conferência da assinatura do webhook, status do pedido → status da venda, pedido → itens da venda, sugestão de vínculo (SKU, depois nome) |
| `src/lib/tiktokShopApi.ts` | cliente HTTP: token, lojas autorizadas, buscar produtos, buscar pedidos, detalhe do pedido, atualizar estoque |
| `src/lib/tiktokShop.functions.ts` | server functions: status, iniciar conexão, finalizar conexão, desconectar, listar anúncios para a prévia, salvar vínculos, ligar/desligar "cuida do estoque" |
| `supabase/functions/tiktok-webhook` | recebe o aviso, confere a assinatura, grava na fila, responde |
| `supabase/functions/tiktok-sync` | processa a fila de pedidos e de estoque, faz a varredura de 15 min e renova tokens |
| `src/routes/_authenticated/configuracoes.integracoes.tiktok.tsx` | volta da autorização (code + state) e prévia de vínculo |
| `configuracoes.tsx` (seção Integrações) | card do TikTok Shop ao lado do Google Agenda |
| `vendas.tsx` | nada novo além do que já existe: a venda chega com canal `tiktok_shop` |

Segue o padrão do Google Agenda (`state` aleatório guardado e conferido, credenciais em variável de ambiente,
integração escondida quando faltar variável), com uma diferença: token no Vault, como a política de segurança
e o questionário do TikTok prometem.

## 5. Regras de negócio

- **Quando o pedido vira venda:** quando o TikTok marca como pago (`AWAITING_SHIPMENT`). Pedido não pago
  (`UNPAID`) não entra. Entra como **a receber**; o TikTok só repassa o dinheiro depois da entrega.
- **Cancelado no TikTok** (`CANCELLED`) depois de virar venda: cancela a venda, devolve o estoque, tira do Financeiro.
- **Taxa do canal:** a conta de teste não tem as APIs financeiras, então a taxa entra **estimada** pela regra do
  TikTok Shop que já existe (`src/lib/taxas.ts`, percentual + fixo, a mesma do lucro por canal da Fase 5). Sem
  regra cadastrada, a venda entra sem taxa e o card avisa. A conferência com o repasse real fica no ONE-135.
- **Item sem vínculo:** a venda entra mesmo assim, sem baixar estoque, e o card do TikTok mostra "3 anúncios sem
  produto ligado".
- **Compradora:** a Pólia não guarda nome, telefone nem endereço de quem comprou no TikTok. A venda fica sem cliente
  (promessa do questionário e regra do marketplace).
- **Estoque Pólia → TikTok:** manda o saldo absoluto do SKU (não a diferença), então reenviar não duplica nada.
  Saldo negativo vai como zero.
- **Desconectar:** apaga a conexão, os tokens do Vault (gatilho no banco) e os vínculos na hora, e para de
  sincronizar. As vendas já registradas ficam, porque são registro financeiro da própria usuária.
  O TikTok não tem chamada de revogar; a vendedora também pode tirar a autorização no Seller Center.

**Decisões da Sil (24/10):** só no Pro; item sem vínculo entra sem baixar estoque e avisa.

## 6. Telas (wireframe em cinza)

**6.1 Configurações > Integrações, card do TikTok Shop (não conectado)**
```
┌──────────────────────────────────────────────────────────────┐
│ [ícone]  TikTok Shop                                          │
│ Pedidos pagos viram venda na Pólia e o estoque fica igual     │
│ nos dois lugares.                                             │
│                                                               │
│ O que a Pólia importa: anúncios, pedidos e quantidades.       │
│ O que a Pólia não faz: criar anúncio, responder compradora,   │
│ guardar dados de quem comprou.                                │
│ Antes de conectar: ter a loja aprovada no TikTok Shop.        │
│                                                               │
│ [ Conectar TikTok Shop ]                                      │
└──────────────────────────────────────────────────────────────┘
```

**6.2 O mesmo card, conectado**
```
┌──────────────────────────────────────────────────────────────┐
│ [ícone]  TikTok Shop · Loja da Ana                 Conectada  │
│ Última sincronização há 3 min                                 │
│                                                               │
│ 12 anúncios ligados · 3 sem produto  [ Ligar anúncios ]       │
│                                                               │
│ [x] A Pólia cuida do estoque                                  │
│     Toda venda em qualquer canal atualiza a quantidade no     │
│     TikTok.                                                   │
│ Taxa usada nas vendas: 12% + R$ 4,00   Alterar                │
│                                                               │
│ Desconectar                                                   │
└──────────────────────────────────────────────────────────────┘
```

**6.3 Ligar anúncios (prévia que ela aprova)**
```
Ligar anúncios do TikTok aos produtos da Pólia
A Pólia sugeriu pelo código (SKU) e depois pelo nome. Confira antes de salvar.

┌──────────────────────────┬──────────────────────────┬─────────┐
│ Anúncio no TikTok        │ Produto na Pólia         │         │
├──────────────────────────┼──────────────────────────┼─────────┤
│ Caneca Gato · Azul       │ Caneca Gato / Azul  ▾    │ pelo SKU│
│ Caneca Gato · Rosa       │ Caneca Gato / Rosa  ▾    │ pelo SKU│
│ Kit 2 canecas            │ (escolher)          ▾    │ sem par │
│ Bolsa Lona               │ Criar produto novo  ▾    │ novo    │
└──────────────────────────┴──────────────────────────┴─────────┘
                       [ Salvar 3 ligações ]   Cancelar
```
Estados: carregando anúncios, nenhum anúncio na loja, erro do TikTok (tentar de novo), salvando.

**6.4 Vendas:** sem tela nova. A venda chega com a etiqueta "TikTok Shop" que a lista já sabe mostrar.

## 7. Ordem de entrega (cada uma sobe separada)

| Etapa | Entrega | Testa como |
|---|---|---|
| 3a.1 | migration, regras puras com testes, conectar/desconectar, card 6.1/6.2 | conectar a loja de teste |
| 3a.2 | listar anúncios e prévia de vínculo (6.3) | criar 2 produtos de teste na loja de teste |
| 3a.3 | webhook, fila, RPC de venda, varredura, renovação de token | fazer pedido de teste na loja de teste |
| 3a.4 | estoque Pólia → TikTok | ajustar estoque na Pólia e ver no Seller Center |
| 3a.5 | revisão de segurança, ADR "conexão direta", lista de lançamento do Partner Center | antes de pedir a publicação |

Depois da 3a.3, o webhook precisa ser cadastrado no app (Partner Center > Basic Information > Webhook URL).
Isso eu faço pelo Chrome, ou passo o endereço para você colar.

## 8. Riscos

- **Depósito no Update Inventory:** a chamada pode exigir o id do depósito (warehouse). Se exigir, entra o
  escopo Logistics Basic, e escopo novo antes da primeira loja real não custa nada. Confiro na loja de teste.
- **Conta de teste sem finanças:** a taxa fica estimada até existir conta completa ou loja real.
- **Vault em edge function:** o padrão do projeto lê o Vault por SQL; os tokens vão pelo mesmo caminho (RPC só
  service role), sem expor `vault.decrypted_secrets`.
- **Limite de chamadas do TikTok:** a varredura e o estoque respeitam o limite e repetem com espera.

## 9. Decisões suas antes de eu começar

1. **Em que plano entra:** sugestão, só no **Pro**, como a seção 10 do plano do módulo já sugeria.
2. **Item sem vínculo:** registrar a venda sem baixar estoque e avisar (sugestão), ou segurar o pedido até ela ligar?
