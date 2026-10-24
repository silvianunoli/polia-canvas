# ADR-002: Marketplaces por conexão direta, não por hub

- **Data:** 2026-10-24
- **Status:** ☑ Aceito

## Contexto

O módulo Vendas (VND-05) precisa trazer pedidos, anúncios e estoque do TikTok Shop e da Shopee para a Pólia One,
e devolver o estoque da Pólia para os canais. As usuárias são marcas pequenas (Pro a R$ 47,90), muitas MEI ou
pessoa física.

Em 23/10/2026 o caminho escolhido era o hub Plug4Market (TecnoSpeed): uma API só para mais de 80 canais. A
proposta veio perto de **R$ 1.000 por mês**, o equivalente a umas 21 assinaturas do Pro só para pagar o hub, e o
hub travava o pedido sem nota fiscal (ruim para MEI e pessoa física).

## Decisão

Conexão direta com as APIs oficiais de cada canal, um adaptador por canal com a mesma forma (conectar, listar
anúncios, receber pedidos, atualizar estoque). **TikTok Shop primeiro**, Shopee depois: a Shopee só libera o acesso
de parceira para plataforma que já tem integração de e-commerce ativa, e o TikTok no ar cumpre esse requisito.

Desenho do TikTok (Fase 3a, no ar desde 24/10/2026):
- App "Pólia One" no Partner Center, categoria ERP, público, mercado Brasil.
- OAuth com `state` conferido; autorização que começa no TikTok (sem `state`) pede confirmação na Pólia.
- Tokens no Supabase Vault, lidos e gravados só por RPC de service role.
- Pedido: webhook (`tiktok-webhook`, assinatura HMAC) → fila `canal_eventos` → `tiktok-sync` pelo pg_cron →
  `registrar_venda_canal` (idempotente pelo pedido). Varredura de 15 minutos cobre aviso perdido.
- Estoque: gatilho em `estoque_movimentos` → fila `canal_fila_estoque` → `tiktok-sync` manda o saldo absoluto.
  A Pólia é a fonte da verdade quando "A Pólia cuida do estoque" está ligado.

## Alternativas consideradas

- **Plug4Market (hub da TecnoSpeed):** R$ 1.000/mês + tarifa por pedido, pedido preso à nota fiscal, sem chat.
  Rejeitado pelo custo. Fica como plano B só para a Shopee, se o acesso direto for negado.
- **Outros hubs com API (Hub2b, Gubee, Magis5):** preço sob consulta, mesmo modelo de mensalidade + pedido.
  Não avaliados a fundo depois da decisão.
- **APIs unificadas de fora (API2Cart, Unified.to):** US$ 300 a US$ 750+ por mês. Mais caras que o hub.
- **Ponte pelo Bling (API v3):** custo zero para a Pólia, mas só atende quem já paga o Bling. Fica como
  complemento opcional.

## Consequências

- **Positivas:** mensalidade zero; webhook em tempo real; sem trava de nota fiscal; autorização na tela oficial
  do canal; a regra de vendas e estoque é da Pólia, igual para todos os canais.
- **Negativas / trade-offs:** dois adaptadores para manter; mudança de API de cada canal cai na Pólia; aprovação
  de cada canal é um processo próprio (cadastro, questionário de segurança, revisão do app).
- **Riscos:** Shopee negar ou demorar o acesso de parceira (sinal: pedido de acesso parado; resposta: hub só para
  a Shopee). TikTok mudar versão da API (sinal: erro na fila `canal_eventos`/`canal_fila_estoque` ou conexão em
  "erro"; resposta: o adaptador fica isolado em `_shared/tiktokShop*.ts`).

## Referências

- `docs/plano-modulo-vendas-canais.md` §5 e `docs/plano-fase3a-tiktok-shop.md`
- `docs/tiktok-shop-partner-center-cadastro.md` (cadastro, escopos, App Key)
- Kanban: VND-16 (comparação de alternativas), VND-05, VND-22, VND-26
