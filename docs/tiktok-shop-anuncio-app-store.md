# Anúncio da Pólia One na loja de apps do TikTok Shop (rascunho para a Sil aprovar)

> 24/10/2026, card VND-26. Campos lidos no Partner Center (app Pólia One > Lista de verificação de lançamento >
> Avaliação de anúncios). Nada foi preenchido lá ainda. Regras: a Pólia One é "o seu escritório virtual", nunca
> "app" no texto; Pólia como sujeito da promessa; sem travessão, exclamação, emoji ou hype.

## Lista de lançamento (estado em 24/10)

| Etapa | Situação |
|---|---|
| Avaliação de registro de parceiro | aprovada (a loja de teste foi liberada) |
| Avaliação de segurança e privacidade de dados | **em análise** no TikTok |
| Avaliação de anúncios | a preencher (este documento) |
| Avaliação de aplicativo | o TikTok testa as funções; antes, a revisão de segurança (VND-26) e o pedido da Sil |

Resposta do Partner Assistant (24/10): para publicar no Brasil, criar anúncio pela Pólia **não** é obrigatório, desde
que o anúncio da loja de apps não prometa isso. Este texto não promete.

## Campos

**Nome:** Pólia One

**Logotipo:** quadrado, mínimo 150 × 150, PNG ou JPG, até 10 MB. Base: `Posts Instagram/logo/polia-app-icon-light.svg`
(exportar em PNG 512 × 512).

**Breve descrição** (aparece em destaque):
> Pólia One, o seu escritório virtual: pedidos do TikTok Shop viram venda, o estoque fica igual nos dois lugares e
> a Pólia mostra quanto cada venda deixou depois da taxa.

**Mídia apresentada** (banner): imagem ou vídeo de até 3 min. Sugestão: o motion "Pólia One por dentro" já pronto,
ou uma imagem da tela de Vendas com a etiqueta TikTok Shop.

**Principais benefícios** (título até 50, texto até 150):
1. **Pedido do TikTok vira venda sozinho**
   Pedido pago entra em Vendas em até 1 minuto, com o produto, a quantidade e a taxa estimada. Pedido cancelado
   devolve o estoque.
2. **Um estoque só para todos os canais**
   Venda no TikTok, no Instagram ou na feira baixa o mesmo estoque, e a Pólia atualiza a quantidade do anúncio.
3. **Quanto a marca lucra em cada canal**
   A Pólia junta preço, custo e taxa do canal e mostra o lucro de cada venda, sem planilha perdida.

**Imagens** (3 a 6): capturas de tela da Pólia One. Sugestão:
1. Configurações > Integrações com o card do TikTok Shop conectado.
2. Ligar anúncios (prévia com as sugestões pelo código).
3. Vendas com pedidos do TikTok Shop "a receber".
4. Produtos > Estoque com a quantidade de cada variação.
5. Painel com o lucro por canal.

**Descrição detalhada** (mínimo 200 caracteres):
> A Pólia One é o escritório virtual de marcas pequenas que vendem produto físico. Ela reúne produtos, estoque,
> vendas, financeiro, preço e metas num lugar só.
>
> Com o TikTok Shop conectado, a Pólia lista os anúncios da loja e sugere qual produto da Pólia corresponde a
> cada um, pelo código e pelo nome. A vendedora confere e salva. A partir daí, todo pedido pago entra em Vendas
> como "a receber", com a taxa do canal estimada, e baixa o estoque. Pedido cancelado volta para o estoque.
>
> Com "A Pólia cuida do estoque" ligado, qualquer movimento na Pólia (venda em outro canal, entrada, perda ou
> contagem) atualiza a quantidade do anúncio no TikTok, para a marca não vender o que não tem.
>
> A Pólia não guarda nome, telefone nem endereço de quem comprou, e não cria nem edita anúncios no TikTok.

**Integrações** (opcional): TikTok Shop. (Shopee entra quando o acesso sair.)

**Contato:** e-mail `oi@usepolia.com.br` (confirmar com a Sil qual e-mail de suporte usar); telefone opcional.

**Site oficial:** https://usepolia.com.br · **Perguntas frequentes:** https://usepolia.com.br/ajuda ·
**Privacidade:** https://usepolia.com.br/privacidade

## Avaliação de aplicativo (formulário lido em 24/10, nada enviado)

O TikTok testa a Pólia One por dentro. O formulário pede:

| Campo | O que vai | Quem |
|---|---|---|
| Pacotes de API | já vem preenchido (Finance, Global Shop, Order, Product Basic, Product Modify, Shop Authorized) | automático |
| URL do site do produto | https://one.usepolia.com.br | Claude |
| Conta de teste do produto | login e senha de uma conta da Pólia One no plano Pro, só para a equipe do TikTok | **Sil cria** (o Claude não cria conta nem digita senha) |
| Instruções passo a passo (até 500 caracteres) | rascunho abaixo | Claude |
| Lista resumida de recursos | rascunho abaixo | Claude |
| Vídeo de demonstração (MP4/MOV, até 200 MB) | gravação de tela: conectar, ligar anúncios, pedido virando venda, estoque indo para o TikTok | a decidir |
| PRD em PDF (até 10 MB) | fluxo de dados, recursos e casos de uso; dá para montar do `plano-fase3a-tiktok-shop.md` | Claude |

Instruções (rascunho, em inglês para a equipe de revisão):
> 1. Log in at https://one.usepolia.com.br with the test account. 2. Go to Configurações > Integrações > TikTok Shop and click Conectar; authorize your test shop. 3. Click "Ligar anúncios", review the suggested links and save. 4. Place a test order in the shop: it shows in Vendas as "a receber" within 1 minute and stock goes down. 5. Turn on "A Pólia cuida do estoque" and change a stock in Produtos: the TikTok listing updates.

Recursos (rascunho): conexão OAuth com a loja; ligação de anúncios a produtos da Pólia; pedido pago vira venda com taxa estimada; pedido cancelado devolve estoque; estoque da Pólia atualiza o TikTok.

Teste de cancelamento feito em 24/10 na loja de teste: pedido 586770632157267104 cancelado pela compradora e aprovado pela vendedora → venda "cancelada" e estoque +1 na Pólia em 1 minuto, saldo enviado ao TikTok.

## Estado em 24/10 (noite)

- E-mail de suporte: **oi@usepolia.com.br** (Sil, 24/10).
- No Partner Center, o formulário do anúncio só tem a URL de instalação (preenchida no cadastro, 23/10). Nome,
  descrições, benefícios, logo, imagens e contato estão vazios. O Chrome travou ao digitar a breve descrição;
  nada foi salvo.
- PRD em PDF pronto: `docs/politicas/Polia-One-TikTok-Shop-PRD-v1.pdf` (fonte `tiktok-shop-prd.html`).
- Conta de teste para a revisão: `oi.silvianunoli+teste2@gmail.com`, já no Pro (teste de reativação estendido
  até 30/06/2027 em `testes_pro.fim`, para não voltar ao Grátis no meio da revisão). A senha a Sil digita no formulário.
- Taxa do TikTok Shop cadastrada na conta da Sil: 10% + R$ 4 (faixa abaixo de R$ 50).

Logo pronto para subir: `docs/politicas/polia-one-logo-512.png` (512 × 512, ícone claro da Pólia). Em 24/10
o Partner Center travou o Chrome de novo ao abrir a página do app (antes de preencher). Na próxima tentativa:
Chrome reiniciado, uma aba só, e preencher os campos por JS (valor + evento de input), sem simular digitação.

## Decisões da Sil antes de preencher
1. Aprovar ou ajustar os textos acima.
2. E-mail de suporte que aparece para as vendedoras.
3. Preço que aparece na loja de apps: a integração é do plano Pro (R$ 47,90). Mostrar "a partir de R$ 47,90 por mês"
   ou "plano Pro da Pólia One"?
4. Quem produz as 3 a 6 capturas de tela (na loja de teste, com os produtos de teste, para não expor dado real).
