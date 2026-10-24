# Cadastro da Pólia no TikTok Shop Partner Center

> Roteiro de 23/10/2026 (cards VND-02 e VND-05). Lido na documentação oficial do Partner Center nesta data.
> Os passos com a sua mão (criar conta, CNPJ, documentos, aceitar termos, enviar) são seus. O resto o Claude prepara.

## Antes de começar: 3 cuidados

1. **E-mail.** Use um e-mail da Pólia que **não** esteja ligado a nenhuma loja do TikTok Shop (sugestão:
   `contato@usepolia.com.br` ou outro do domínio). Se o e-mail for de uma conta de vendedora, o TikTok trata a
   Pólia como "vendedora que desenvolve para a própria loja" e não deixa cadastrar como desenvolvedora de app.
2. **Endereço certo.** Brasil usa o portal global: `partner.tiktokshop.com` (o `partner.us...` é só para os EUA).
3. **A categoria do app não muda depois.** O TikTok diz que a escolha é irreversível: categoria errada significa
   criar outro app do zero. A recomendação está no passo 4.

## Passo 1: criar a conta (seu)

`https://partner.tiktokshop.com/account/sign-up` → Sign Up → e-mail (e telefone, opcional) → código de verificação.

## Passo 2: cadastro de desenvolvedora (seu)

No guia que aparece depois do login: **For app developers (ISV)** → **Start Business**.

| Campo | O que preencher |
|---|---|
| Registration region | Brasil (tem que bater com o CNPJ) |
| Target market | Brasil (parceira local escolhe só o mercado dela) |
| Business category | Desenvolvedor de aplicativos > Gerenciamento de eCommerce > **Planejamento de recursos empresarial**, e também Desenvolvedor de aplicativos > Atendimento ao cliente > a opção de suporte (deixa aberto o app do chat). Aqui é caixa de marcar, aceita mais de uma |
| Company name | Nunoli Soluções Digitais Ltda |
| CNPJ e dados da empresa | você digita |
| Contato | seu nome e o e-mail da Pólia |
| Documentos | cartão CNPJ e contrato social (PDF) |

Se faltar algum documento, dá para clicar **Save for later** e criar o app mesmo assim. Ele só não pode ser
publicado antes de a certificação da empresa sair. O andamento fica em **My Account > My category & market**.

A revisão jurídica e de compliance é obrigatória para EUA e Reino Unido e "caso a caso" para os outros mercados.
Se o TikTok pedir, o contato é `partner@tiktokshop.com` (leva 3 semanas ou mais).

### Formulário "Detalhes da certificação" (lido em 23/10)

| Campo | O que vai |
|---|---|
| Comprovante do CNPJ | cartão CNPJ em PDF (1 KB a 4 MB). A empresa precisa ter mais de 1 ano de atividade |
| Razão social | Nunoli Soluções Digitais Ltda (igual ao cartão CNPJ) |
| Número de registro da empresa | **NIRE** (11 dígitos, dado pela Junta Comercial; está na chancela do contrato social ou na Certidão Simplificada). Sem NIRE à mão: o CNPJ |
| Data de registro | data de abertura do cartão CNPJ (ou do registro na Junta, se usar o NIRE) |
| Endereço de registro | endereço da sede, igual ao cartão CNPJ |
| Objeto social (opcional) | a atividade principal (CNAE) do cartão CNPJ |
| Proprietário | CPF, nome e data de nascimento da sócia administradora |
| Site | https://usepolia.com.br |
| Clientes e plataformas (opcional) | pode deixar em branco |

**Descrição do negócio (colar):**

> A Pólia One é um sistema de gestão online (SaaS) para pequenas marcas brasileiras que vendem produtos
> físicos, como canecas, roupas, cosméticos e papelaria. Reúne num lugar só o cadastro de produtos e variações,
> o controle de estoque, o registro de vendas, o financeiro, a precificação com cálculo de custo e lucro, os
> clientes e as metas. O produto está no ar em one.usepolia.com.br, com planos Grátis, Premium e Pro.
>
> A integração com o TikTok Shop vai permitir que a vendedora autorize a loja dela dentro da Pólia One, importe
> os anúncios, receba os pedidos automaticamente, mantenha o estoque igual em todos os canais de venda e veja
> quanto cada pedido rendeu depois das taxas. Os dados de compradoras ficam restritos ao necessário para o pedido,
> com acesso controlado por conta e tokens guardados de forma criptografada.

## Passo 3: criar o app (Claude preenche, você confere e envia)

| Campo | Valor sugerido |
|---|---|
| Tipo de aplicativo e serviço | **Serviço público** (SaaS para muitas lojas; o personalizado é para poucas lojas escolhidas e tem teto de 3 por categoria) |
| Nome do app | Pólia One |
| Categoria | **eCommerce Management > Enterprise Resource Planning** (ver passo 4) |
| Descrição curta | Gestão para marcas pequenas: produtos, estoque, pedidos e lucro por canal num lugar só. |
| Descrição (EN, se pedir) | Back-office for small brands: products, inventory, orders and profit per sales channel in one place. |
| Site | https://usepolia.com.br |
| Política de privacidade | https://usepolia.com.br/privacidade |
| Redirect URL | https://one.usepolia.com.br/configuracoes/integracoes/tiktok (rota que a Fase 3a vai criar; dá para editar depois) |
| Webhook URL | deixar em branco agora; entra quando a função de webhook existir |

**Escopos ligados em 23/10 (o mínimo que a Fase 3a usa; ativaram na hora, sem análise):**
- Global Shop Information, `seller.shop.info` (conectar e desconectar a loja)
- Product Basic, `seller.product.basic` (ler anúncios, atualizar estoque e preço)
- Order Information, `seller.order.info` (pedidos e status; o TikTok marca como dados sensíveis)
- Finance Information, `seller.finance.info` (taxas e repasse, para o lançamento no Financeiro)
- Product Modify, `seller.product.write` (ligado em 24/10: a doc de Update Inventory e Update Price exige
  esse escopo, não basta o Product Basic)
- Informações de autorização da loja, `seller.authorization.info` (ligado em 24/10: sem ele a lista de lojas
  autorizadas volta 401 "105005 Access denied". Na lista em português o nome não tem "Shop Authorized", por
  isso escapou na primeira leitura)

**App Key:** `6lmnnt8u19s1u`, com L minúsculo e o número 8. Na tela do Partner Center parece "6imnntBu19s1u";
copiar pelo botão de copiar, nunca digitar olhando.

**Respostas do Partner Assistant (24/10):**
1. Criar anúncio **não** é obrigatório para publicar o app ERP no Brasil, desde que o app não ofereça isso. A
   revisão confere o que o app diz que faz. Não anunciar "criar produto" antes de existir.
2. O escopo de mensagens com compradoras (Customer Service) **não** aparece para a categoria ERP no Brasil.
   Ele pertence à categoria Customer Support. O chat da Fase 6 provavelmente vai precisar de um segundo app
   nessa categoria (a Pólia já tem essa qualificação em análise).

**Conta de teste:** dois tipos. "Função principal" não pede nada além de escolher e avançar, mas **não tem as
APIs financeiras**. "Função completa" pede dados KYC reais e libera tudo. Começar pela principal; a conferência
de taxas e repasse fica para uma conta completa ou para a primeira loja real.

Os "Global Product" ficaram desligados: são do catálogo global de venda internacional, que a usuária da
Pólia não usa. Ligar escopo novo depois obriga cada loja já conectada a autorizar a Pólia de novo.

Ficam para depois: Product Modify (criar e editar anúncio, Fase 7), Fulfillment Basic (envio pela Pólia),
Customer Service (chat, ver abaixo).

## Passo 4: por que ERP, e o que isso cobra da Pólia

Das categorias lidas, a de **ERP** é a que descreve a Pólia: centraliza produto, estoque, pedido e conferência
financeira. A de **OMS** é para logística e terceirização de envio. A de **Customer Support** é só para atendimento.

O que pesa: a documentação de ERP lista **33 casos de uso obrigatórios** para publicar o app, incluindo criar
anúncio (categoria, marcas, medidas, fotos) e operações de envio. Isso puxa parte da Fase 7 (criar anúncio) para
antes da publicação. Desenvolver e testar nas lojas de teste não depende disso.

**Para perguntar no chamado ao TikTok (Partner Assistant), antes de criar o app:**
1. Um app ERP pode ser publicado no Brasil sem criar anúncio no primeiro momento?
2. A permissão de atendimento (Customer Service) pode ser pedida no mesmo app ERP, ou o chat precisa de um
   segundo app na categoria Customer Support? Ela vem por padrão só nessa categoria.

## Passo 5: loja de teste (sua)

**Kits de desenvolvimento > Lojas de Desenvolvimento**, mercado-alvo **Brazil**, botão **Criar conta de teste**.
Cada conta de teste vem com uma loja que fica num ambiente separado e não afeta loja real. É onde a Fase 3a é
construída antes da aprovação. A conta pede e-mail e senha: guarde no seu gerenciador de senhas, nunca no chat.

## Passo 6: chamado no Partner Assistant (seu)

Ajuda > Partner Assistant > enviar ticket. Texto pronto:

> Hello. We are Pólia One, a Brazilian SaaS for small brands (ERP category, public app, Brazil market). Two
> questions before we start development:
> 1. To publish an ERP app in Brazil, is product creation/listing (CAT-PROD-LIST and related CAT-PRE use cases)
>    mandatory at launch, or can the first version cover shop connection, inventory and price sync, order sync and
>    finance reconciliation, adding product creation later?
> 2. Can the Customer Service scope (buyer messages) be requested on this same ERP app, or does it require a
>    separate app in the Customer Support category?
> Thank you.

## Fontes (Partner Center, lidas em 23/10/2026)
- Developer onboarding: https://partner.tiktokshop.com/docv2/page/developer-onboarding
- Tipos de desenvolvedora: https://partner.tiktokshop.com/docv2/page/tts-developer-types
- Guia de categoria do app: https://partner.tiktokshop.com/docv2/page/hulvi36o
- ERP (casos de uso e escopos): https://partner.tiktokshop.com/docv2/page/enterprise-resource-planning-erp
- OMS: https://partner.tiktokshop.com/docv2/page/order-management-system-oms
- Regiões (Brasil, pt-BR): https://partner.tiktokshop.com/docv2/page/regions-and-languages
