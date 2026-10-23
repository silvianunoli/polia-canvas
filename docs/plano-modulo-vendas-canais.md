# Plano: Vendas, Estoque, Shopee, TikTok Shop, Leads e Pós-venda no WhatsApp

> Rascunho de 23/10/2026 para a Sil decidir. Nada foi codado. Regra da casa: plano aprovado antes de implementar,
> uma fase por vez.

## 1. O que muda em uma frase

A Pólia One passa a saber **o que foi vendido, por onde, quanto sobrou na prateleira e quem comprou**,
juntando venda manual, Instagram/WhatsApp, Shopee e TikTok Shop num lugar só. Cada venda baixa o estoque,
vira lançamento no Financeiro já com a taxa do canal descontada e alimenta o Painel com o quanto a marca
lucra de verdade em cada canal.

Encaixa no eixo marca-primeiro: o número entra como ferramenta. A pergunta que o módulo responde para a
Ana é "o produto que mais vende é o que mais dá lucro?" (muitas vezes não é, por causa da comissão do
marketplace).

## 2. Todos os módulos atuais ficam. O que cada um ganha

| Módulo atual | Continua igual | Ganha |
|---|---|---|
| Painel | sim | cards de vendas da semana, mais vendidos, alerta de estoque baixo, lucro por canal |
| Planejamento | sim | nada nesta leva (as respostas sobre canais de venda podem pré-preencher as conexões depois) |
| Produtos | sim | aba **Estoque**, SKU, variações (cor/tamanho), "onde vende" com vínculo ao anúncio em cada canal |
| Calculadora | sim | **preço por canal**: mesmo produto, taxa da Shopee e do TikTok Shop aplicadas, mostra quanto lucra em cada um |
| Projeção e cenários | sim | passa a usar histórico real de vendas em vez de só estimativa |
| Financeiro | sim | lançamentos automáticos de venda e de taxa do marketplace (sem duplicar: `lancamentos.id_externo` já existe) |
| Raio-x do mês | sim | lê vendas por canal e produto |
| Clientes | sim, o funil "Antes do pedido / Pedido / Depois da entrega" fica | vira **Clientes e leads**: origem do contato, consentimento de WhatsApp, aba **Pós-venda** |
| Metas | sim | meta pode ser em unidades vendidas ou por canal |
| Caderno, Planner, Plano de conteúdo, Calendário, Assistente | sim | Assistente passa a responder perguntas sobre vendas e estoque |
| Configurações | sim | seção **Integrações** (conectar Shopee, TikTok Shop, WhatsApp) |

**Menu lateral:** entra só **um item novo, "Vendas"**, entre Produtos e Financeiro. Estoque mora dentro de
Produtos; Pós-venda e Leads moram dentro de Clientes; Integrações dentro de Configurações. Assim o menu
não incha (hoje já são 13 itens).

## 3. Módulo novo: Vendas

Uma lista única de pedidos de todos os canais, com filtro por canal, período e status.

- **Registrar venda manual** (Instagram, WhatsApp, feira, encomenda). Hoje o "registrar venda" do Clientes
  vira um atalho para cá, ligado ao produto e ao estoque.
- **Pedidos da Shopee e do TikTok Shop** chegam sozinhos depois da conexão.
- **Mais vendidos**: ranking por unidades, por faturamento e por **quanto lucra** (com taxa e custo). As três
  colunas lado a lado mostram quando o campeão de vendas é o que menos deixa dinheiro.
- **Por canal**: quanto entrou, quanto o canal ficou de taxa, quanto a marca lucrou.
- Exportar CSV (padrão que já existe em `src/lib/csv.ts`).

## 4. Estoque (dentro de Produtos)

- Cada produto tem um ou mais **SKUs** (variação). Produto sem variação ganha um SKU padrão sem a usuária ver.
- Saldo calculado a partir de um **livro de movimentos** (entrada, venda, devolução, ajuste), nunca de um
  número solto que alguém sobrescreve. Dá histórico e auditoria ("por que o estoque caiu 3?").
- **Estoque mínimo** por SKU com alerta no Painel.
- Liga/desliga por produto: serviço e produto digital não controlam estoque.
- Quando há canal conectado e a usuária ativa "a Pólia cuida do estoque", **toda venda em qualquer canal
  baixa o saldo e a Pólia atualiza a quantidade nos outros canais**. É isso que evita vender o mesmo item
  duas vezes, a dor número 1 de quem vende em mais de um lugar.

## 5. Integração Shopee e TikTok Shop

### Como a usuária conecta
Configurações → Integrações → "Conectar Shopee". Ela é levada para a tela de autorização oficial do canal,
aceita, e volta para a Pólia. Pode desconectar a qualquer momento (a Pólia apaga os tokens). Mesmo padrão
que o Google Agenda já usa hoje (`calendarGoogle.functions.ts`).

### Os dois sentidos, sempre com autorização dela
1. **Do canal para a Pólia (importar):** a Pólia lista os anúncios do canal, sugere o vínculo com produtos já
   cadastrados (por SKU, depois por nome) e a usuária confirma um por um ou em lote. O que não existe vira
   produto novo. Nada é criado sem ela aprovar a prévia.
2. **Da Pólia para o canal (exportar):**
   - **Estoque e preço** de anúncio já vinculado: simples, entra cedo.
   - **Criar anúncio novo** a partir de um produto da Pólia: pesado, porque cada canal exige categoria,
     atributos obrigatórios, fotos no padrão e logística. Fica para a última fase.

### O que sincroniza
| Dado | Direção | Quando |
|---|---|---|
| Anúncios e variações | canal → Pólia | ao conectar e uma vez por dia |
| Pedidos e status | canal → Pólia | webhook em tempo real + varredura de segurança a cada 15 min (pelo hub, se não houver webhook, consulta a cada poucos minutos) |
| Estoque | Pólia → canal | a cada venda ou ajuste |
| Preço | Pólia → canal | só quando ela mandar (botão), nunca automático |
| Taxas e repasse | canal → Pólia | junto com o pedido, vira lançamento no Financeiro |

### Limite importante: compradora de marketplace não vai para o WhatsApp
Shopee e TikTok Shop mascaram o contato da compradora e **proíbem levar a cliente para fora da plataforma**.
Usar esse telefone para pós-venda no WhatsApp pode suspender a loja da usuária. Então:
- pedidos de marketplace entram em Vendas e Estoque, mas **não** viram contato de WhatsApp;
- pós-venda no WhatsApp vale para venda direta (Instagram, WhatsApp, indicação, encomenda, loja própria).

### Acesso às APIs (o gargalo real)
- **TikTok Shop:** o Partner Center tem categoria oficial de app de ERP, com lojas de teste para desenvolver.
  Caminho mais aberto.
- **Shopee:** para ser "plataforma parceira" (atender lojas de terceiros) pede CNPJ ativo, inscrição e,
  segundo a página de requisitos, **já ter integrações de e-commerce ativas**. Pode demorar ou ser negado
  na primeira tentativa.

### Caminho escolhido (23/10): Plug4Market para produtos, estoque e pedidos
Decisão da Sil: se o hub for mais fácil, segue por ele. É mais fácil para a Shopee, então:

**Como o Plug4Market funciona.** É um hub da TecnoSpeed feito só para software house. A Pólia integra uma
vez com a API REST dele e o hub conversa com mais de 80 canais, Shopee e TikTok Shop inclusos. Tem
ambiente de teste (sandbox) para começar na hora. Cobre cadastro e atualização de produto, preço,
estoque sincronizado, pedidos (novo, aprovado, cancelado) e etiqueta dos marketplaces.

**Quanto custa.** A TecnoSpeed **não publica valores**. O modelo, segundo a FAQ deles: uma mensalidade fixa
paga pela Pólia (não por loja) mais alguns centavos por pedido que o hub traz dos canais. Não cobra por
canal nem por SKU. O valor sai só por proposta comercial (card VND-12). Como a tarifa é por pedido, o custo
cresce junto com as vendas das usuárias, o que encaixa no preço do Pro.

**O que o hub não resolve (perguntar na proposta antes de assinar):**
- **Chat com compradoras:** nenhuma página do Plug4Market fala de mensagens. Provavelmente não tem.
- **Webhook:** não aparece na documentação pública; sem ele, a Pólia consulta pedidos de tempos em tempos.
- **Nota fiscal obrigatória:** a FAQ diz que o pedido só segue depois do envio da NF-e. Muita usuária da
  Pólia é MEI ou vende como pessoa física e não emite nota em toda venda. Se o hub travar o pedido sem nota,
  ele não serve para essa parte da base. **Esse é o ponto que mais pesa na decisão.**
- **Como a vendedora autoriza a loja:** não está descrito. Precisa ser um fluxo em que ela autoriza dentro
  da Pólia, sem ter que criar conta no Plug4Market.

**Desenho resultante (híbrido):**
- Shopee: via Plug4Market (produtos, estoque, pedidos).
- TikTok Shop: via Plug4Market também, para ter um adaptador só. Conexão direta com o TikTok só para o
  chat (seção 5.1), que o hub não cobre.
- Com integrações ativas pelo hub, a Pólia passa a cumprir o requisito da Shopee e pode pedir acesso direto
  mais tarde, se o custo por pedido ficar alto.
- O adaptador por canal da seção 8 continua: trocar hub por conexão direta não mexe na regra.

### 5.1 Mensagens das compradoras dentro da Pólia
Pedido da Sil (23/10): ver as mensagens que as compradoras mandam, mesmo sem ver o contato delas. Dá, com
diferenças por canal:

- **TikTok Shop: dá.** Existe API oficial de atendimento: listar conversas, ler mensagens, responder e aviso
  em tempo real quando chega mensagem nova. Mas é permissão **restrita**: o TikTok aprova a Pólia em
  separado e cada vendedora autoriza. A régua publicada pelo TikTok fala em 1.000 lojas autorizadas ou
  1 milhão de chamadas por dia, com aprovação especial possível; a Pólia ainda não tem esse volume, então
  a aprovação não é garantida. A vendedora tem 7 dias para responder antes de a conversa fechar sozinha.
- **Shopee: incerto.** A busca encontrou um guia da Shopee Brasil dizendo que as APIs de Chat não estão
  mais sendo liberadas localmente, mas a página não abriu para conferir o texto inteiro. Plano: perguntar
  oficialmente à Shopee (card VND-02). Se não liberar, a Pólia mostra o pedido com um botão "Responder na
  Shopee" que abre a conversa no painel da própria Shopee.
- **WhatsApp (API oficial): dá**, para as clientes de venda direta.

**Tela:** uma **Caixa de mensagens** dentro de Vendas, com as conversas de TikTok Shop, Shopee (se liberar) e
WhatsApp juntas, uma etiqueta por canal, ligadas ao pedido e ao produto. Nas de marketplace aparece só o
apelido que a plataforma mostra, nunca telefone ou e-mail. A resposta sai pelo próprio canal, dentro das
regras dele.

## 6. Clientes e leads

O funil atual já é um CRM leve. O plano aproveita:
- **Origem** de cada contato: Instagram, WhatsApp, indicação, feira, site, outro.
- **Status de lead** antes do primeiro pedido (já existe o grupo "Antes do pedido").
- **Consentimento de WhatsApp** com data, registrado. Sem consentimento, a Pólia não oferece mensagem de
  oferta (LGPD e regra da Meta).
- **Captura simples**: link público da marca (formulário curto, nome + WhatsApp + interesse) que cai direto
  em Clientes e leads. Reaproveita o que o `/quiz` e o `/manual` já fazem para a própria Pólia.
- Histórico do contato: pedidos, valor total comprado, última compra, próxima ação.

## 7. Pós-venda pelo WhatsApp

Decisão da Sil (23/10): **API oficial (Cloud API da Meta), sem fase por link.**

- A Pólia se cadastra como Tech Provider na Meta e a usuária conecta o próprio número pelo cadastro
  incorporado (Embedded Signup), sem sair da Pólia. Conferir na doc da Meta se o número pode continuar no app
  WhatsApp Business ao mesmo tempo (coexistência); se não puder, a usuária precisa saber antes de conectar.
- Régua de pós-venda configurável: "pedido entregue → 2 dias depois, perguntar se chegou bem → 7 dias,
  pedir avaliação → 30 dias, lembrar de recompra". Sai sozinha, sem ela apertar nada.
- Mensagem que abre conversa precisa de modelo aprovado pela Meta. A Pólia já entrega modelos prontos
  (chegou bem, avaliação, recompra) que a usuária ajusta para a voz da marca dela.
- Respostas da cliente caem na Caixa de mensagens (seção 5.1); dentro de 24h da última mensagem dela,
  a usuária responde livre.
- Só contato com consentimento registrado recebe mensagem de oferta.
- **Custo por mensagem** (tabela de out/2026, a confirmar na doc oficial): cerca de R$ 0,035 para utilidade
  (confirmação, entrega, pós-venda) e R$ 0,32 para marketing (oferta, recompra). Quem paga continua aberto
  (seção 10).
- Enquanto a Meta não aprova a Pólia como Tech Provider, a régua e os modelos podem ser construídos e
  testados com o número de teste que a própria Meta fornece.

## 8. Arquitetura técnica (resumo para o dev)

- **Banco (Supabase, RLS em tudo, dono = `user_id`):**
  - `produto_skus` (produto_id, sku, variacao, controla_estoque, estoque_minimo)
  - `estoque_movimentos` (sku_id, tipo, quantidade, origem, venda_id) + view de saldo
  - `vendas` (canal, id_externo único por canal, status, data, bruto, taxa_canal, frete, liquido, cliente_id)
  - `venda_itens` (venda_id, sku_id, quantidade, preco_unitario, custo_unitario na data)
  - `canal_conexoes` (canal, shop_id, status, escopos, expira_em, ultimo_sync); **tokens no Supabase Vault**,
    nunca em coluna aberta, nunca no client
  - `anuncio_vinculos` (sku_id, canal, item_id, model_id, sincroniza_estoque)
  - `clientes` ganha `origem`, `telefone_e164`, `whatsapp_consentimento_em`
  - `posvenda_reguas`, `posvenda_tarefas`, `whatsapp_mensagens`
- **Sincronização:** webhooks dos canais entram numa edge function que só valida assinatura e enfileira
  (Cloudflare Queues); um worker processa com idempotência por `id_externo`, respeita limite de chamadas e
  renova token (Shopee expira a cada 4h). Cron de varredura cobre webhook perdido.
- **Regra de conflito de estoque:** com "a Pólia cuida do estoque" ligado, a Pólia é a fonte da verdade;
  desligado, só lê.
- **Domínio em `src/lib/*.functions.ts`**, um adaptador por canal com a mesma interface
  (`listarAnuncios`, `buscarPedidos`, `atualizarEstoque`), para entrar Mercado Livre ou Nuvemshop depois
  sem mexer na regra.
- ADR para: fonte da verdade do estoque, direto vs hub, quem paga o WhatsApp.

## 9. Fases e ordem

| Fase | Entrega | Depende de fora? | Tamanho |
|---|---|---|---|
| 0 | Proposta do Plug4Market (com as perguntas da seção 5), cadastro de Tech Provider na Meta, pedido da permissão de atendimento no TikTok Shop, pergunta à Shopee sobre o chat. Atualizar Política de Privacidade e Termos | sim, começa já | dias de você, semanas de espera |
| 1 | Estoque (SKU, movimentos, mínimo) + Vendas manual + Mais vendidos + cards no Painel + lançamento automático no Financeiro | não | 2 a 3 semanas |
| 2 | Clientes e leads (origem, consentimento, captura) | não | 1 semana |
| 3 | Shopee e TikTok Shop via Plug4Market: conectar, importar anúncios com vínculo, pedidos entrando, estoque sincronizado (começa no sandbox antes do contrato) | proposta TecnoSpeed | 3 a 4 semanas |
| 4 | WhatsApp pela API oficial: conexão do número, régua de pós-venda, modelos, Caixa de mensagens | aprovação Meta | 3 semanas |
| 5 | Calculadora com preço por canal + lucro por canal no Raio-x | não | 1 semana |
| 6 | Chat do TikTok Shop (e da Shopee, se liberar) na Caixa de mensagens | aprovação TikTok / resposta Shopee | 2 semanas |
| 7 | Criar anúncio novo na Shopee/TikTok a partir da Pólia | fase 3 | 3 a 4 semanas |

Fases 1, 2 e 5 entregam valor sem esperar nenhuma plataforma. As de integração entram quando cada acesso
sair.

## 10. Decisões que são suas

1. **Em que plano entra cada parte.** Sugestão:
   - Grátis: estoque manual dentro da cota de 5 produtos, vendas manuais.
   - Premium: estoque completo, Vendas, Mais vendidos, Clientes e leads, Pós-venda por link.
   - Pro: Shopee + TikTok Shop, WhatsApp automático, preço e lucro por canal.
2. ~~Shopee direto ou via hub~~ **Decidido 23/10: via Plug4Market**, se a proposta responder bem às
   perguntas da seção 5 (principalmente a nota fiscal obrigatória).
3. ~~WhatsApp por link ou API~~ **Decidido 23/10: API oficial.** Continua aberto **quem paga a mensagem**:
   a usuária cadastra o cartão dela na Meta (Pólia fora do custo) ou a Pólia inclui uma franquia no Pro.
4. **Nome visível do módulo.** "Vendas" é o mais claro; alternativa "Pedidos".

## 11. Riscos

- Aprovação da Shopee pode atrasar meses (requisito de já ter integrações).
- Venda dupla se a sincronização atrasar: mitigado com webhook + fila + varredura, e com estoque de
  segurança opcional por SKU.
- LGPD: a Pólia vira operadora de dados de compradoras. Política, termos e minimização (guardar só o
  necessário do pedido de marketplace, sem endereço completo).
- Mudança de API das plataformas: adaptador isolado por canal + alerta no Telegram (`alertas-criticos`)
  quando a sincronização falhar.
- Suporte: integração gera chamado. Tela de status da conexão ("última sincronização há 3 min") reduz dúvida.

## Fontes consultadas

- Shopee, requisitos de acesso à Open API: https://seller.shopee.com.br/edu/article/3445/API--Access-Request-Process
- Shopee, guia de integração Open Platform: https://seller.shopee.com.br/edu/article/27314/Guia-Pratico-de-Integracao-Open-Plataform
- TikTok Shop Partner Center, apps de ERP: https://partner.tiktokshop.com/docv2/page/enterprise-resource-planning-erp
- Tecnospeed, integração TikTok Shop / Plug4Market: https://blog.tecnospeed.com.br/integracao-tiktok-shop/
- Plug4Market, FAQ (modelo de cobrança, NF-e): https://pages.tecnospeed.com.br/faq-plug4market
- Plug4Market, página do produto (canais, sandbox, só software house): https://tecnospeed.com.br/en/plug4market/
- TikTok Shop, API de atendimento: https://partner.tiktokshop.com/docv2/page/customer-service-api-overview
- TikTok Shop, aprovação da permissão de atendimento (terceiro): https://www.unifyport.ai/blog/tiktok-shop-customer-service-api-approval-checklist/
- Preço da API do WhatsApp em out/2026: https://www.connectweek.com.br/artigo/custo-whatsapp-business-api-2026 e https://www.dragapp.com/pt-br/blog/api-oficial-do-whatsapp/
