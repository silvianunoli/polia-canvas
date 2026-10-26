# Lista de lançamento: Mercado Livre direto (Fase 3c)

> 25/10/2026 · VND-30. O código das etapas 3c.1 a 3c.4 está no ar (commits 89b63e3, d1734ee, a6674c0, 54fb676),
> mas nada liga para as usuárias enquanto as variáveis `MERCADO_LIVRE_*` não estiverem no Worker. Esta lista é o
> caminho até abrir para todo mundo do Pro. Decisões e desenho: `docs/plano-fase3c-mercado-livre.md` e ADR-003.

## 1. Ligar (sua parte, VND-31)

- [ ] Criar o app **Pólia One** no DevCenter com a conta do Mercado Livre **da Pólia** (roteiro na §10 do plano).
  - URI de redirecionamento: `https://one.usepolia.com.br/configuracoes/integracoes/mercado-livre`
  - PKCE ligado; escopos leitura, escrita e acesso offline
  - Notificações: tópico **Orders (orders_v2)**, URL `https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/ml-webhook`
- [ ] Me mandar o Client ID (não é segredo).
- [ ] Gravar no Worker os três valores (um comando por variável; o terminal pede o valor):

```powershell
npx wrangler secret put MERCADO_LIVRE_CLIENT_ID
```
```powershell
npx wrangler secret put MERCADO_LIVRE_CLIENT_SECRET
```
```powershell
npx wrangler secret put MERCADO_LIVRE_REDIRECT_URI
```

- [ ] Gravar no Supabase os dois que as edge functions usam (troca os valores antes de rodar):

```powershell
npx supabase secrets set MERCADO_LIVRE_CLIENT_ID=COLE_AQUI MERCADO_LIVRE_CLIENT_SECRET=COLE_AQUI
```

Depois disso o card do Mercado Livre aparece em Configurações > Integrações para contas Pro.

## 2. Usuários de teste (eu faço, com você conectando)

O Mercado Livre não tem ambiente de teste: usuários de teste operam em produção, só compram e vendem entre si,
até 10 por conta, e somem depois de 60 dias parados. Para criar, a API pede o token de alguma conta.

- [ ] Você conecta a conta do Mercado Livre da Pólia na conta de testes da Pólia One (oi.prismia).
- [ ] Eu crio pela API uma **vendedora de teste** e uma **compradora de teste** e te passo login e senha delas.
- [ ] Você desconecta a conta da Pólia e conecta a vendedora de teste.
- Nunca comprar com conta real, sua ou de família: o Mercado Livre proíbe.

## 3. Roteiro de teste (com a vendedora de teste)

| # | Passo | Esperado |
|---|---|---|
| 1 | Conectar no card | card mostra o apelido da vendedora de teste, "conectada" |
| 2 | Criar 2 anúncios no Mercado Livre (um com 2 variações e código SKU) | aparecem em "Ligar anúncios", o de variação com 2 linhas |
| 3 | Ligar: um pelo código sugerido, outro como "Criar produto novo" | toast com 3 ligados, 1 produto criado; card conta 3 |
| 4 | Compradora de teste compra 2 unidades da variação ligada | em até 1 minuto, venda "a receber" em Vendas com etiqueta Mercado Livre, tarifa e "Frete do envio" no detalhe; estoque da variação baixa 2 |
| 5 | Cancelar a compra no Mercado Livre | venda vira cancelada, estoque volta |
| 6 | Ligar "A Pólia cuida do estoque" | em até 1 minuto, a quantidade dos anúncios ligados fica igual à da Pólia |
| 7 | Entrada de 5 unidades na Pólia | anúncio sobe 5 no Mercado Livre |
| 8 | Zerar o estoque na Pólia | anúncio pausa no Mercado Livre; com quantidade de novo, reativa |
| 9 | Nova compra de teste, marcada como recebida em Vendas | lançamento no Financeiro = total - tarifa - frete do envio |
| 10 | Desconectar | card volta a "Conectar"; ligações somem; vendas continuam |

Eu acompanho cada passo pelo banco (`canal_eventos`, `canal_fila_estoque`, `vendas`) e pelos registros das edge
functions, e corrijo o que não bater antes de seguir.

## 4. Pontos que só a conta de teste confirma

Marcados "(conferir)" no plano e no código:

- [ ] `sale_fee` do item no pedido é por unidade (a tarifa soma `sale_fee × quantidade`).
- [ ] Parte da vendedora em `/shipments/{id}/costs` (`senders[].cost`) é o frete que ela paga.
- [ ] O multiget de anúncios com `include_attributes=all` traz o `SELLER_SKU` das variações.
- [ ] `PUT /items/{id}/variations/{var}` com `available_quantity` funciona em anúncio do modelo novo (User Products).
- [ ] O aviso `orders_v2` chega com `application_id` igual ao Client ID.
- [ ] Busca de pedidos por `order.date_last_updated.from` devolve os pedidos alterados.
- [ ] Revogar a autorização ao desconectar (ver §6).
- [ ] O pedido traz `seller.id` igual ao da vendedora conectada (a venda só entra nesse caso).
- [ ] Pedidos do mesmo carrinho dividem o `shipping.id` (o frete entra só na primeira venda do envio).

## 5. Teste de 7 dias com a conexão de pé

O risco que mais pesa é a renovação do token de uso único (ADR-003). Depois do roteiro, a vendedora de teste fica
conectada 7 dias seguidos, com pelo menos um pedido ou ajuste de estoque por dia.

- [ ] 7 dias sem a conexão cair em "erro" (`canal_conexoes.status`).
- [ ] Nenhum `integration_failure` com `servico = mercado_livre` no período.
- [ ] Pelo menos 28 renovações no período (uma a cada 6 horas), conferidas pelo `access_expira_em` andando.
- [ ] Fila sem evento morto por erro (`canal_eventos.tentativas = 5`).

## 6. Antes de abrir para todo o Pro

- [ ] Política de Privacidade e Termos citam o Mercado Livre entre os canais conectáveis, e o que a Pólia guarda:
  pedido, itens, tarifa e frete, sem nome, apelido, telefone ou endereço da compradora (VND-10).
- [ ] Questionário e textos do app no DevCenter, se o Mercado Livre pedir revisão.
- [ ] Desconectar também tira a autorização do lado do Mercado Livre (`DELETE /users/{id}/applications/{app}`,
  melhor esforço desde a 3c.5): conferir na conta de teste que o app some da lista de apps autorizados dela.
- [ ] Card do Kanban fechado (VND-30) e memória atualizada.
