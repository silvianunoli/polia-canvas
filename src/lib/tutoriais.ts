// Tutoriais por ferramenta da Pólia One (28/10/2026, pedido da Sil: "não um
// vídeo só"). Cada ferramenta do menu tem uma página com o clipe narrado dela
// (recorte do tour de 5 minutos, ver lib/tutorial.ts) e o passo a passo escrito.
//
// O texto saiu do código de cada tela, não de memória: rótulo entre aspas é o
// que está escrito na tela. Mudou um botão ou uma regra numa tela, revise o
// tutorial dela aqui. O mesmo conteúdo serve o app (/como-usar/$slug) e o site
// público (/tutorial/$slug).
//
// `trecho` aponta as cenas do vídeo (id da cena, ou "primeira-última"). Cada
// trecho tem um mp3 curto em public/video-tutorial/trechos/, cortado por
// polia-one-tutorial/gerar_versao_app.py; o teste confere que o arquivo existe.
// Sem `trecho`, a página mostra só o passo a passo até a narração nova sair:
// Vendas e Anúncios entraram no menu depois do vídeo, o primeiro acesso e o
// Painel mudaram em 14/10, e as cenas de Produtos e Financeiro dizem "quanto
// sobra", que saiu da copy em 18/10.

import { ehRotaProjete, tierMinimoDaRota } from "@/lib/planos";

export const GRUPOS_TUTORIAL = [
  "Primeiros passos",
  "Produto, preço e venda",
  "Dinheiro e números",
  "Clientes e rotina",
] as const;

export type GrupoTutorial = (typeof GRUPOS_TUTORIAL)[number];

export type PlanoVisivel = "Grátis" | "Premium" | "Pro";

export type Tutorial = {
  slug: string;
  nome: string;
  grupo: GrupoTutorial;
  /** Tela no app que o botão "Abrir" leva. */
  rota: string;
  /** Rótulo do botão que abre a tela. */
  abrir: string;
  /** Uma frase: pra que a tela serve. */
  resumo: string;
  /** Outras telas que este tutorial explica (o atalho "Como usar esta tela" delas cai aqui). */
  outrasRotas?: string[];
  /** Quando o plano não sai só da rota (ex.: a tela abre, mas conectar é do Pro). */
  plano?: PlanoVisivel;
  trecho?: string;
  /**
   * Ferramenta só da conta interna (Planner, 28/10/2026, lib/ferramentasInternas):
   * fica fora da lista, da busca e do "anterior/próximo", mas o link "Como usar
   * esta tela" continua achando ela pra quem tem acesso.
   */
  interno?: boolean;
  passos: { titulo: string; itens: string[] }[];
  bomSaber: string[];
  duvidas: { pergunta: string; resposta: string }[];
};

const LISTA = [
  {
    slug: "primeiro-acesso",
    nome: "Primeiro acesso",
    grupo: "Primeiros passos",
    rota: "/painel",
    abrir: "Abrir o Painel",
    resumo:
      "Os três primeiros passos que aparecem no topo do Painel: o primeiro preço, o Módulo 1 e o nome da marca.",
    passos: [
      {
        titulo: "Antes dos passos: o nicho",
        itens: [
          'No topo do Painel, o bloco "Primeiros passos" pergunta qual é o nicho da marca.',
          'Clique no que mais combina, como "Papelaria e presentes" ou "Comida e doces". Um clique já salva. Nenhum serviu? Clique em "Outro ramo".',
        ],
      },
      {
        titulo: "Os três passos",
        itens: [
          '"Calcular o primeiro preço": escolha "Produto", "Serviço" ou "Os dois" e clique em "Quero calcular meu preço →". A Calculadora abre na aba certa e guarda o primeiro preço sozinha.',
          '"Fechar o Módulo 1 do Planejamento": clique em "Quero abrir o Módulo 1 →" e responda as 5 seções curtas.',
          '"Dar nome à marca": escreva o nome, mesmo que provisório, e clique em "Salvar".',
          'O contador "N de 3" acompanha. Com os três feitos, o bloco some e o Painel passa a mostrar o mês.',
        ],
      },
    ],
    bomSaber: [
      "Só o primeiro passo que falta fica aceso. Os outros esperam a vez.",
      "Conta nova começa com 7 dias do Pro. Fechando os três passos durante o teste, ele ganha mais 7 dias.",
      "O nome da marca dá pra trocar depois em Configurações.",
    ],
    duvidas: [
      {
        pergunta: "Dá pra pular a pergunta do nicho",
        resposta:
          "Não. Os passos só abrem depois dela, porque o nicho muda as sugestões das outras telas. É um clique.",
      },
      {
        pergunta: "O que acontece quando o teste do Pro acaba",
        resposta:
          "A conta volta pro Grátis, com tudo guardado. As telas pagas aparecem com cadeado no menu.",
      },
    ],
  },
  {
    slug: "painel",
    nome: "Painel",
    grupo: "Primeiros passos",
    rota: "/painel",
    abrir: "Abrir o Painel",
    resumo:
      "A tela de todo dia: quanto falta pro mês, o que entrou, as tarefas que vencem e o próximo módulo do Planejamento.",
    passos: [
      {
        titulo: "Ler o Painel",
        itens: [
          "A frase do topo muda com o mês. Antes do Módulo 4, ela aponta o Planejamento. Depois, mostra quanto falta pra fechar as contas ou a Meta do mês.",
          "O botão logo abaixo é o próximo passo: continuar um módulo ou registrar uma entrada.",
          'Os cartões "Receita · mês", "Pedidos · mês" e "Quanto lucrou · mês" resumem o mês.',
          'Com pedido aberto no quadro de Pedidos, o cartão "Entregas" mostra as de hoje, as de amanhã, as atrasadas e quanto entra na semana. "Abrir o quadro" leva pra ele.',
        ],
      },
      {
        titulo: "Registrar uma entrada pelo Painel",
        itens: [
          'Clique em "Registrar uma entrada" ou, no plano Grátis, em "+ Registrar" no bloco "Entrou e saiu este mês".',
          'Escolha "Entrada" ou "Saída", preencha o "Valor (R$)" e a "Data".',
          'Escolha a categoria. Venda entra como "Venda de produto" ou "Prestação de serviço".',
          'Clique em "Salvar lançamento".',
        ],
      },
      {
        titulo: "Deixar a intenção do dia",
        itens: [
          'Em "Qual é a sua intenção pra hoje?", escreva o que vale o dia, como "gravar a aula e não abrir o Instagram até o almoço".',
          "Aperte Enter pra guardar. O lápis edita.",
        ],
      },
    ],
    bomSaber: [
      'A lista "Pra o Painel acender" mostra o que falta pra cada número aparecer. Ela some quando os 6 itens estão feitos.',
      "No Grátis, o Painel lança entradas e saídas só do mês atual. O histórico dos outros meses fica no Financeiro, do Premium.",
      "A Meta do mês nasce no Módulo 4 do Planejamento, na pergunta do mês bom.",
    ],
    duvidas: [
      {
        pergunta: 'Registrei dinheiro e "Pedidos" continua em zero',
        resposta:
          'Pedidos conta só as entradas com a categoria "Venda de produto" ou "Prestação de serviço". Edite o lançamento e troque a categoria.',
      },
      {
        pergunta: "Dá pra lançar o mês passado no Grátis",
        resposta:
          "Não. No Grátis vale só o mês atual. Os outros meses ficam no Financeiro, do Premium.",
      },
    ],
  },
  {
    slug: "planejamento",
    nome: "Planejamento",
    grupo: "Primeiros passos",
    rota: "/planejamento",
    // Marca e Mapa de Mercado são documentos que nascem dos módulos 1 e 2.
    outrasRotas: ["/marca", "/mercado"],
    abrir: "Abrir o Planejamento",
    resumo:
      "O documento vivo da marca: seis módulos, do porquê ela existe até onde ela vai. Cada resposta vira preço, meta e conta do mês nas outras telas.",
    trecho: "planejamento-ia",
    passos: [
      {
        titulo: "Responder um módulo",
        itens: [
          'Abra o Planejamento e clique em "Começar o Módulo N" ou "Continuar o Módulo N".',
          'Escreva no campo "Escreva aqui…". A resposta se salva sozinha um segundo depois que você para de digitar.',
          'Clique em "Salvar e continuar" pra ir pra próxima seção. Na última, o botão vira "Concluir módulo".',
          "No fim do módulo, a ferramenta que nasce dele já abre: a Marca, o Mapa de Mercado, o Catálogo, o Financeiro, o Guia de presença ou as Metas.",
        ],
      },
      {
        titulo: "Pedir ajuda à Pólia One",
        itens: [
          "Escreva um começo, mesmo curto. O botão só aparece com o campo preenchido.",
          'Clique em "Completar com a Pólia One".',
          'O rascunho aparece no próprio campo e já fica salvo. Escolha "Usar este rascunho", "Descartar" ou "Gerar outro".',
        ],
      },
      {
        titulo: "Voltar e editar depois",
        itens: [
          'Na tela do Planejamento, cada módulo feito tem "Editar →".',
          "A mudança vai junto pras telas que usam aquela resposta.",
        ],
      },
    ],
    bomSaber: [
      "Os seis módulos abrem em todo plano, inclusive no Grátis. A Marca, o Mapa de Mercado e o Financeiro que nascem deles são do Premium.",
      "Os módulos abrem em ordem, porque cada resposta usa a anterior.",
      "Cada seção precisa de pelo menos uma resposta pra fechar.",
      "A ajuda da IA vale nos módulos 1, 2, 3 e 6. Por mês, são 1 uso no Grátis, 30 no Premium e 60 no Pro.",
      "O Módulo 4, Quanto vale, guarda a conta do mês e a Meta do mês: mínimo, mês bom e celebrar.",
    ],
    duvidas: [
      {
        pergunta: "Por que o botão da IA não aparece",
        resposta:
          "O campo está vazio, a seção é do Módulo 4 ou 5, ou os usos do mês acabaram. Os usos voltam no dia 1º.",
      },
      {
        pergunta: "Dá pra pular pro Módulo 3",
        resposta:
          "Não. Os módulos abrem em ordem. Os que já foram feitos dá pra reabrir quando quiser.",
      },
    ],
  },
  {
    slug: "assistente",
    nome: "Assistente",
    grupo: "Primeiros passos",
    rota: "/aimer",
    abrir: "Abrir o Assistente",
    resumo:
      "O balão no canto da tela: responde dúvidas sobre como usar a Pólia One e sobre o negócio.",
    trecho: "assistente",
    passos: [
      {
        titulo: "Fazer uma pergunta",
        itens: [
          "Clique no botão quadrado no canto de baixo, à direita, em qualquer tela.",
          'Escolha um exemplo, como "Meu preço cobre os custos?", ou escreva a sua pergunta.',
          'Aperte Enter ou clique em "Enviar". Shift e Enter pulam linha.',
          '"copiar" copia a resposta. O ícone de seta em círculo começa uma conversa nova.',
        ],
      },
    ],
    bomSaber: [
      "Perguntas por dia: 5 no Grátis, 30 no Premium e 100 no Pro.",
      "No Pro, o Assistente lê os números do mês antes de responder. Nos outros planos, ele responde sem olhar a conta.",
      "A conversa acompanha a troca de tela, mas não fica guardada. Recarregou a página, ela recomeça.",
      "Dúvida de imposto ou de contrato é com o contador ou o advogado.",
      "As respostas são escritas por IA e podem errar. Vale conferir antes de decidir.",
    ],
    duvidas: [
      {
        pergunta: "O Assistente sabe os meus números",
        resposta: "Só no Pro, inclusive no teste do Pro.",
      },
      {
        pergunta: "Por que não consigo mais escrever",
        resposta: "As perguntas do dia acabaram. Elas voltam no dia seguinte.",
      },
    ],
  },
  {
    slug: "planos",
    nome: "Planos e assinatura",
    grupo: "Primeiros passos",
    rota: "/configuracoes",
    outrasRotas: ["/assinar"],
    abrir: "Abrir Configurações",
    resumo: "O que abre em cada plano, onde ver o seu e como trocar, mudar o cartão ou cancelar.",
    // Sem clipe desde 28/10/2026: o vídeo lista Planner e Caderno nos planos.
    passos: [
      {
        titulo: "Ver o seu plano",
        itens: [
          'Abra Configurações e desça até "Assinatura". Ali aparecem o plano, o valor e a próxima cobrança.',
          "No menu, a tela com cadeado abre em outro plano. Passando o mouse, o menu diz qual.",
        ],
      },
      {
        titulo: "Trocar de plano",
        itens: [
          'Em "Assinatura", clique em "Ver os planos".',
          'Escolha "Mensal" ou "Anual" e clique em "Mudar pro" plano que quiser.',
        ],
      },
      {
        titulo: "Mudar o cartão ou ver as faturas",
        itens: [
          'Em "Assinatura", clique em "Gerenciar assinatura". A página de pagamento abre numa aba nova.',
        ],
      },
      {
        titulo: "Cancelar",
        itens: [
          'Em "Assinatura", clique em "Cancelar assinatura" e confirme.',
          "O plano continua até o fim do período já pago. Depois, a conta volta pro Grátis, com tudo guardado.",
        ],
      },
    ],
    bomSaber: [
      "Grátis, R$ 0: Painel, Planejamento, Calculadora, Produtos (até 5), Pedidos (até 15 abertos), Metas, guia de presença e Assistente.",
      "Premium, R$ 29,90 por mês: Produtos e Pedidos sem limite, mais Vendas, Financeiro, Clientes e Calendário.",
      "Pro, R$ 47,90 por mês: tudo do Premium, mais Projeção, Raio-x, Plano de conteúdo e a conexão com Mercado Livre e TikTok Shop.",
      "Nos 7 dias seguintes à contratação, dá pra desistir e receber o valor de volta.",
    ],
    duvidas: [
      {
        pergunta: "Se eu cancelar, perco os dados",
        resposta: "Não. As telas pagas deixam de abrir, mas tudo continua guardado.",
      },
      {
        pergunta: "Como troco o cartão",
        resposta: 'Em Configurações, na parte "Assinatura", clique em "Gerenciar assinatura".',
      },
    ],
  },
  {
    slug: "produtos",
    nome: "Produtos",
    grupo: "Produto, preço e venda",
    rota: "/produtos",
    abrir: "Abrir Produtos",
    resumo: "O catálogo da marca: o que ela vende, quanto custa e quanto lucra em cada venda.",
    passos: [
      {
        titulo: "Cadastrar um produto",
        itens: [
          'Na aba "Catálogo", clique em "+ Adicionar produto".',
          'Preencha o "Nome" e escolha o "Tipo": "Produto físico", "Produto digital" ou "Serviço".',
          'Coloque o "Preço de venda (R$)" e o "Custo de produção (R$)". Com o custo, o cartão já mostra quanto a marca lucra por venda.',
          'Se quiser, cole o link de uma foto, escreva uma "Descrição curta" e uma "Observação interna", que só aparece pra você.',
          'Produto físico tem o bloco "Estoque": "Quantidade agora", "Estoque mínimo" e "Código (SKU)". Abaixo do mínimo, o produto aparece como estoque baixo.',
          'Clique em "Salvar produto". O botão só libera com nome e preço de venda preenchidos.',
        ],
      },
      {
        titulo: "Trazer vários produtos de uma planilha",
        itens: [
          'Clique em "Importar planilha" e depois em "Escolher planilha". Se ajudar, baixe antes a planilha modelo.',
          "A planilha precisa de duas colunas: nome e preço de venda. Tipo, custo, onde vende e descrição são opcionais.",
          "Confira a lista. Produto com nome que já existe no catálogo vem desmarcado.",
          'Clique em "Importar N produtos". Se algo saiu errado, "Desfazer importação" volta tudo.',
        ],
      },
      {
        titulo: "Mexer num produto que já existe",
        itens: [
          'No menu do cartão, "Editar" abre o cadastro de novo.',
          '"Recalcular preço" abre a Calculadora já com esse produto e guarda o preço novo nele.',
          '"Arquivar" tira o produto do catálogo sem apagar. Ele continua guardado.',
        ],
      },
    ],
    bomSaber: [
      "No plano Grátis cabem 5 produtos ativos. No Premium e no Pro, sem limite.",
      "Produto não se apaga, só se arquiva, pra não perder o histórico de venda.",
      "A planilha aceita .csv ou .txt, até 5 MB e até 1000 produtos por vez.",
      'As abas "Estoque" e "Insumos e produção" ficam na mesma tela, ao lado do "Catálogo".',
    ],
    duvidas: [
      {
        pergunta: "Por que o cartão não mostra o lucro",
        resposta:
          'Falta o custo. Sem ele, o cartão avisa "cadastre o custo pra saber o lucro". Edite o produto e preencha o "Custo de produção (R$)".',
      },
      {
        pergunta: 'O que quer dizer "(sem taxa/imposto)"',
        resposta:
          'O lucro do cartão só desconta taxa e imposto quando o preço veio da Calculadora. Use "Recalcular preço" pra entrar com essas porcentagens.',
      },
    ],
  },
  {
    slug: "calculadora",
    nome: "Calculadora de preço",
    grupo: "Produto, preço e venda",
    rota: "/calculadora",
    abrir: "Abrir a Calculadora",
    resumo:
      "Entram os custos reais da marca, sai o preço sugerido e quanto ele deixa de lucro depois das taxas.",
    trecho: "calculadora",
    passos: [
      {
        titulo: "Calcular o preço de um produto",
        itens: [
          'Escolha a aba: "Produto (físico/digital)", "Serviço (por hora)" ou "Encomenda (sob medida)".',
          'Em "Custos diretos (por unidade)", coloque matéria-prima, embalagem, mão de obra e outros custos de cada peça.',
          'Em "Custos fixos e salário", entre com os custos fixos do mês, o "Pró-labore (seu salário)" e quantas peças a marca vende por mês, somando todos os produtos. O botão "Puxar do Financeiro deste mês" traz os custos fixos que já estão lançados.',
          'Em "Sobre o preço de venda (%)", coloque a taxa da maquininha ou do marketplace, os impostos e o lucro que a marca quer em cada venda.',
          'O resultado mostra o "Preço sugerido", o custo por unidade, o preço mínimo pra não ter prejuízo e quanto a marca lucra.',
        ],
      },
      {
        titulo: "Guardar o preço no catálogo",
        itens: [
          'No primeiro preço, a Pólia One guarda sozinha: com a conta parada por 2 segundos, o preço vai pro catálogo como "Primeiro produto" ou "Primeiro serviço".',
          'Dá pra trocar o nome ali mesmo, ou clicar em "Completar o cadastro" ou "Ver no catálogo".',
          'A partir do segundo preço, clique em "Guardar esse preço". O cadastro do produto abre com preço e custo preenchidos: escreva o nome e clique em "Salvar produto".',
        ],
      },
      {
        titulo: "Recalcular um produto que já existe",
        itens: [
          'Em Produtos, no menu do cartão, clique em "Recalcular preço".',
          'Ajuste os custos e clique em "Guardar o preço novo". O preço antigo fica no histórico do produto.',
        ],
      },
    ],
    bomSaber: [
      "Calcular é livre em todo plano. No Grátis com 5 produtos no catálogo, a conta funciona, mas guardar pede o Premium.",
      'A aba "Encomenda (sob medida)" mostra o preço só no Pro.',
      "Com a Meta do mês criada, a Calculadora mostra quantas vendas desse produto fecham a meta.",
      'No Premium, "Quanto esse preço deixa em cada canal" compara o lucro por canal, com as taxas salvas em Vendas.',
    ],
    duvidas: [
      {
        pergunta: 'Por que o preço aparece como "R$ --"',
        resposta:
          "As porcentagens de taxa, imposto e lucro somam 100% ou mais. Assim não existe preço que feche a conta. Baixe alguma delas.",
      },
      {
        pergunta: '"Quantas peças a marca vende por mês" é só deste produto',
        resposta:
          "Não, é de todos os produtos da marca. É esse número que divide os custos fixos e o salário entre as peças.",
      },
      {
        pergunta: "Pra onde foi o preço que eu calculei",
        resposta:
          'Pro catálogo, em Produtos, com o nome "Primeiro produto" (ou o nome que você escreveu). Dá pra renomear quando quiser.',
      },
    ],
  },
  {
    slug: "anuncios",
    nome: "Anúncios nos canais",
    grupo: "Produto, preço e venda",
    rota: "/produtos/anuncios",
    // Conectar o canal e ligar os anúncios também acontece em Configurações.
    outrasRotas: ["/configuracoes/integracoes"],
    abrir: "Abrir Anúncios nos canais",
    resumo:
      "Liga cada anúncio do Mercado Livre e do TikTok Shop a um produto da Pólia, pra a venda baixar o estoque certo.",
    plano: "Pro",
    passos: [
      {
        titulo: "Conectar o canal de venda",
        itens: [
          'Abra Configurações e desça até "Integrações".',
          'No cartão do Mercado Livre ou do TikTok Shop, clique em "Conectar".',
          "Entre na conta da loja e autorize. No Mercado Livre, use a conta dona da loja, não a de colaboradora. No TikTok, a loja precisa estar aprovada no TikTok Shop.",
          "Na volta, a Pólia One abre direto a tela de ligar os anúncios.",
        ],
      },
      {
        titulo: "Ligar os anúncios aos produtos",
        itens: [
          'Em Produtos, entre em "Anúncios nos canais" e clique em "Ligar anúncios" no canal.',
          "A Pólia One já sugere o par de cada anúncio, primeiro pelo código (SKU) e depois pelo nome. Confira linha por linha.",
          'Em cada anúncio, escolha o produto da Pólia, "Criar produto novo na Pólia" ou "Não ligar".',
          'Clique em "Salvar N ligações". Nada fica ligado antes disso.',
        ],
      },
      {
        titulo: "Deixar o estoque por conta da Pólia",
        itens: [
          'Com o canal conectado, ligue a chave "A Pólia cuida do estoque" no cartão da integração.',
          "Daí em diante, cada venda, entrada ou ajuste de estoque na Pólia atualiza a quantidade dos anúncios ligados.",
        ],
      },
    ],
    bomSaber: [
      "Conectar um canal é do Pro.",
      'Os pedidos só começam a chegar em Vendas depois que os anúncios estão ligados, e entram como "a receber".',
      "No Mercado Livre, quantidade zero pausa o anúncio. Anúncio no Full continua com o estoque do Mercado Livre.",
      "A Pólia não cria anúncio, não responde compradora e não guarda dados de quem comprou.",
      "A Shopee ainda não conecta. Por enquanto ela aparece só nas taxas da Calculadora e de Vendas.",
    ],
    duvidas: [
      {
        pergunta: "Chegou um pedido e o estoque não baixou",
        resposta:
          'O anúncio desse pedido não estava ligado a um produto. Abra "Ligar anúncios", ligue esse anúncio e salve. Os próximos pedidos já baixam o estoque.',
      },
      {
        pergunta: "Desconectar apaga as vendas que já entraram",
        resposta:
          "Não. Desconectar para a chegada de pedidos novos e desfaz as ligações. As vendas que já entraram continuam em Vendas.",
      },
    ],
  },
  {
    slug: "vendas",
    nome: "Vendas",
    grupo: "Produto, preço e venda",
    rota: "/vendas",
    abrir: "Abrir Vendas",
    resumo: "O que vendeu, por qual canal, pra quem e quanto a marca lucrou em cada venda.",
    passos: [
      {
        titulo: "Registrar uma venda",
        itens: [
          'Clique em "+ Registrar venda".',
          'Preencha a "Data" e "Por onde vendeu": Instagram, WhatsApp, Presencial ou feira, Encomenda, Site ou Outro. Escolha a cliente, se quiser.',
          'Em "Itens", escolha o produto, a variação (quando tiver), a quantidade e confira o preço, que vem do catálogo. "+ Adicionar item" põe mais um produto na mesma venda.',
          'Se teve desconto, frete cobrado ou taxa da maquininha, preencha. A "Forma de recebimento" já puxa a taxa salva.',
          'Deixe marcado "Dinheiro já recebido" se o dinheiro já entrou. Desmarcado, a venda fica "a receber".',
          'Confira o resumo, com o total, quanto a marca lucra e como fica o estoque, e clique em "Registrar venda".',
        ],
      },
      {
        titulo: "Acompanhar e corrigir",
        itens: [
          'No topo, "Vendas", "Entrou", "A marca lucrou" e "Estoque baixo" resumem o período escolhido.',
          'Use as abas "Todas as vendas", "Mais vendidos", "Quem compra" e "Orçamentos".',
          'Abra uma venda pra "Marcar como recebida" ou "Cancelar venda". Cancelada, os itens voltam pro estoque e o lançamento sai do Financeiro.',
          'Em "Taxas de recebimento", salve a porcentagem de cada forma de pagamento. A Pólia One usa esses números no lucro de cada venda.',
          '"Ver como quadro" abre o quadro de Pedidos, com os pedidos que têm dia de entrega.',
        ],
      },
    ],
    bomSaber: [
      "Vendas é do Premium e do Pro.",
      'Pedido anotado no quadro de Pedidos também é venda: aparece aqui pelo canal "Encomenda", no dia em que foi anotado.',
      "A venda daqui baixa o estoque e entra no Financeiro assim que o dinheiro é recebido.",
      'Pedidos do Mercado Livre e do TikTok Shop entram sozinhos, como "a receber", quando o canal está conectado e os anúncios ligados.',
      "A venda sai de um produto do catálogo. Sem produto cadastrado, a tela pede pra ir em Produtos antes.",
    ],
    duvidas: [
      {
        pergunta: 'Por que a venda aparece "sem custo"',
        resposta:
          "Algum produto dessa venda está sem custo no catálogo, então a Pólia One não tem como calcular quanto lucrou. Preencha o custo em Produtos.",
      },
      {
        pergunta: 'Qual a diferença pra "Registrar venda de um produto" do Financeiro',
        resposta:
          "A de Vendas registra a venda inteira, baixa o estoque e lança o dinheiro. A do Financeiro só lança o dinheiro de uma venda, pelo preço do catálogo, sem mexer no estoque.",
      },
      {
        pergunta: "Como desfazer uma venda",
        resposta:
          'Abra a venda e clique em "Cancelar venda". O estoque e o Financeiro voltam, e a venda fica na lista como cancelada.',
      },
    ],
  },
  {
    slug: "financeiro",
    nome: "Financeiro",
    grupo: "Dinheiro e números",
    rota: "/financeiro",
    abrir: "Abrir o Financeiro",
    resumo: "Tudo o que entrou e saiu no mês, e quanto a marca lucrou no fim.",
    passos: [
      {
        titulo: "Lançar uma entrada ou uma saída",
        itens: [
          'Clique em "+ Registrar entrada" ou "+ Registrar saída".',
          'Preencha o "Valor (R$)" e a "Data". A "Descrição" é opcional.',
          'Escolha a "Categoria". Se nenhuma servir, "+ nova categoria" cria a sua.',
          'Clique em "Salvar lançamento".',
        ],
      },
      {
        titulo: "Trazer o extrato do banco",
        itens: [
          'Clique em "Importar extrato" e depois em "Escolher arquivo". Vale .ofx, .csv e .xml de nota fiscal, até vários de uma vez.',
          "Confira cada linha, troque o tipo ou a categoria quando precisar. Linha que já foi importada vem desmarcada.",
          'Clique em "Importar N lançamentos". "Desfazer importação" volta tudo, se precisar.',
        ],
      },
      {
        titulo: "Não esquecer as contas do mês",
        itens: [
          'Clique em "+ Nova conta a pagar" e preencha a conta, o valor e o vencimento. Marque "Repete todo mês" pra conta fixa.',
          'Quando pagar, clique em "Paguei". Só aí ela vira uma saída do mês.',
        ],
      },
    ],
    bomSaber: [
      "O Financeiro é do Premium e do Pro. No Grátis, a entrada e a saída do mês são lançadas pelo Painel.",
      'A barra "Onde o mês está agora" compara o que entrou com a Meta do mês. As marcas de mínimo e de celebrar vêm do módulo Quanto vale, no Planejamento.',
      "Os cartões do topo mostram sempre o mês atual. Os filtros mudam só o histórico.",
      "Excluir um lançamento não tem volta.",
      'No Pro, "Resumo pro contador" baixa o mês em PDF ou CSV.',
    ],
    duvidas: [
      {
        pergunta: "Importar o mesmo extrato duas vezes duplica",
        resposta: "Não. A Pólia One reconhece as linhas que já entraram e deixa elas desmarcadas.",
      },
      {
        pergunta: "As vendas de Vendas aparecem aqui",
        resposta: "Aparecem, assim que o dinheiro é marcado como recebido.",
      },
      {
        pergunta: "Comprei insumo. Conta como custo fixo",
        resposta:
          'Lance na categoria "Insumos / estoque". A Projeção deixa essa categoria fora dos custos fixos, porque ela muda com a produção.',
      },
    ],
  },
  {
    slug: "metas",
    nome: "Metas",
    grupo: "Dinheiro e números",
    rota: "/metas",
    abrir: "Abrir Metas",
    resumo: "Até três metas acompanhadas por vez, em quantidade ou em reais, mais a Meta do mês.",
    trecho: "metas",
    passos: [
      {
        titulo: "Criar uma meta",
        itens: [
          'Clique em "Nova meta".',
          'Escreva a "Meta", por exemplo "chegar a 30 clientes fixas".',
          'Em "Formato da medida", escolha "Quantidade" ou "Dinheiro (R$)" e diga quanto quer alcançar.',
          'Preencha o "Valor atual, hoje" e, se quiser, a "Data alvo".',
          'Clique em "Criar meta".',
        ],
      },
      {
        titulo: "Criar a Meta do mês",
        itens: [
          'Clique em "Criar a Meta do mês" e diga quanto quer que entre no mês, em reais.',
          "Ela se atualiza sozinha: soma as entradas registradas no mês, as mesmas que o Painel e o Financeiro mostram.",
        ],
      },
      {
        titulo: "Atualizar e fechar",
        itens: [
          "Clique no valor atual do cartão, digite o novo e aperte Enter.",
          'Quando bater, clique em "Concluir". Abaixo de 100%, a Pólia One pede um segundo clique pra confirmar.',
          'No menu do cartão, "Arquivar" guarda a meta. As concluídas e arquivadas ficam em "Ver concluídas" e "Ver arquivadas", com "Reabrir".',
        ],
      },
    ],
    bomSaber: [
      "Metas abre em todo plano, inclusive no Grátis.",
      "São até 3 metas ativas por vez. A Meta do mês não entra nessa conta.",
      "A Meta do mês não muda de nome: Painel, Financeiro, Calculadora, Projeção e Raio-x encontram ela por esse nome.",
    ],
    duvidas: [
      {
        pergunta: "Dá pra ter mais de 3 metas",
        resposta: "Ativas ao mesmo tempo, não. Conclua ou arquive uma pra abrir outra.",
      },
      {
        pergunta: "Por que não consigo digitar o valor da Meta do mês",
        resposta:
          "Porque ele vem das entradas do mês. Lance a entrada no Painel ou no Financeiro e a meta acompanha.",
      },
    ],
  },
  {
    slug: "projecao",
    nome: "Projeção e cenários",
    grupo: "Dinheiro e números",
    rota: "/projecao",
    abrir: "Abrir a Projeção",
    resumo:
      "Quantas vendas faltam pra empatar, pra pagar o seu salário e pra bater a Meta do mês, e o que muda se o preço ou o custo mexer.",
    trecho: "projecao",
    passos: [
      {
        titulo: "Ler a projeção",
        itens: [
          "Abra a Projeção. Ela usa os produtos do catálogo, os custos fixos lançados no Financeiro e a Meta do mês.",
          '"Pra empatar" mostra quantas vendas pagam os custos fixos.',
          '"Pra pagar o seu salário" soma o salário aos custos fixos.',
          '"Pra bater a meta" mostra quantas vendas fecham a Meta do mês.',
        ],
      },
      {
        titulo: "Testar um cenário",
        itens: [
          "Mexa nos campos: custos fixos, quanto quer tirar por mês, ticket médio, custo médio e Meta do mês.",
          'Ou clique em "E se eu cobrasse 10% a mais?" e "E se meu custo caísse 10%?".',
          '"Voltar ao valor real" desfaz o teste.',
          'Gostou do salário e da meta? Clique em "Salvar salário e meta".',
        ],
      },
    ],
    bomSaber: [
      "A Projeção é do Pro.",
      "Precisa de pelo menos um produto com preço e dos custos fixos do mês lançados no Financeiro. Faltando algo, a tela diz o quê e leva pra lá.",
      '"Salvar salário e meta" guarda só esses dois. Os outros campos voltam ao valor real.',
    ],
    duvidas: [
      {
        pergunta: "Por que as vendas da meta são diferentes das de empatar",
        resposta:
          "A meta é o que precisa entrar, então divide pelo preço. Empatar é pagar os custos, então divide pelo lucro de cada venda.",
      },
      {
        pergunta: "Um produto ficou fora da média",
        resposta:
          'Ele está muito acima ou muito abaixo dos outros e puxaria a média. "Usar todos na média" põe ele de volta.',
      },
    ],
  },
  {
    slug: "raiox",
    nome: "Raio-x do mês",
    grupo: "Dinheiro e números",
    rota: "/raiox",
    abrir: "Abrir o Raio-x",
    resumo:
      "Com o mês fechado, a Pólia One lê entradas, saídas, meta e produtos e mostra o que puxou o resultado.",
    trecho: "raiox",
    passos: [
      {
        titulo: "Gerar o raio-x",
        itens: [
          'Escolha o mês em "Mês do raio-x". A tela já abre no mês passado, que está fechado.',
          'Clique em "Gerar raio-x" e espere a leitura.',
          'Leia o placar, as causas e as sugestões. Cada sugestão pode levar direto pra tela certa, como "Ver Produtos" ou "Ver Financeiro".',
          'As leituras anteriores ficam em "Gerações deste mês".',
        ],
      },
      {
        titulo: "Ler o mês que ainda está correndo",
        itens: [
          "Escolha o mês atual. A tela avisa que o mês ainda está correndo.",
          'Clique em "Ler o que tem até aqui".',
        ],
      },
    ],
    bomSaber: [
      "O Raio-x é do Pro.",
      "São 3 gerações por mês, somando todos os meses lidos. A conta zera no dia 1º.",
      "Mês sem nenhum lançamento no Financeiro não tem leitura. Com 2 lançamentos ou menos, a leitura sai limitada.",
      "A leitura é escrita por IA e pode errar. Vale conferir antes de decidir.",
    ],
    duvidas: [
      {
        pergunta: "Gerei 3 vezes em setembro. Ainda dá pra ler outubro",
        resposta:
          "Não neste mês. As 3 gerações valem pra todos os meses e voltam no dia 1º. As leituras já feitas continuam abertas pra reler.",
      },
      {
        pergunta: 'Por que aparece "pouco registrado"',
        resposta:
          "O mês tem poucas entradas e saídas no Financeiro. Lance o que falta e gere de novo.",
      },
    ],
  },
  {
    slug: "clientes",
    nome: "Clientes",
    grupo: "Clientes e rotina",
    rota: "/clientes",
    abrir: "Abrir Clientes",
    resumo:
      "Cada cliente com contato, pedido, valor e status, do primeiro contato ao pós-venda, e a venda lançada no Financeiro com um clique.",
    trecho: "clientes",
    passos: [
      {
        titulo: "Cadastrar uma cliente",
        itens: [
          'Clique em "+ Adicionar".',
          'Preencha o "Nome". WhatsApp, outro contato e "De onde veio" ajudam a saber de onde vem a clientela.',
          'Escolha o "Status" e, se já tiver pedido, o produto e o "Valor da venda (R$)". Escolhendo o produto, o valor vem do catálogo.',
          'Clique em "Salvar".',
        ],
      },
      {
        titulo: "Acompanhar o pedido",
        itens: [
          "Clique no status da cliente na lista pra trocar.",
          'Antes do pedido: "Primeiro contato", "Orçamento enviado" ou "Pensando". No pedido: "Em espera", "Em produção", "Atrasado" ou "Entregue". Depois: "Pós-venda".',
          'Os filtros "Todas", "Leads", "Com pedido" e "Depois da entrega" separam a lista.',
        ],
      },
      {
        titulo: "Mandar a venda pro Financeiro",
        itens: [
          'Marque o pedido como "Entregue" ou "Pós-venda".',
          'Clique em "Registrar venda →" na linha da cliente e confirme.',
          'A linha passa a mostrar "Registrada · ver no Financeiro".',
        ],
      },
    ],
    bomSaber: [
      "Clientes é do Premium e do Pro.",
      '"Exportar CSV" baixa a lista completa, sempre com todas as clientes, sem olhar o filtro.',
      '"Link de captura" cria uma página pra cliente deixar o contato sozinha. Ela entra na lista como lead.',
      "Excluir uma cliente não tem volta, mas a venda já registrada continua no Financeiro.",
    ],
    duvidas: [
      {
        pergunta: 'Por que não aparece "Registrar venda"',
        resposta:
          'O botão aparece com o status "Entregue" ou "Pós-venda" e com valor da venda ou produto escolhido.',
      },
      {
        pergunta: "Mudei o valor depois de registrar. O Financeiro muda",
        resposta: "Não. Edite o lançamento direto no Financeiro.",
      },
    ],
  },
  {
    slug: "planner",
    nome: "Planner",
    interno: true,
    grupo: "Clientes e rotina",
    rota: "/planner",
    abrir: "Abrir o Planner",
    resumo:
      "Um quadro por projeto, com colunas das ideias até o pronto. Cada cartão tem prazo e pode ficar ligado a uma meta.",
    trecho: "planner",
    passos: [
      {
        titulo: "Criar um quadro",
        itens: [
          'Clique em "Novo quadro" e dê um nome, como "Feira de artesanato".',
          'Clique em "Criar". O quadro abre na hora, com as colunas "Ideias & pendências", "Planejado", "Hoje", "Em progresso", "Pausado" e "Pronto".',
        ],
      },
      {
        titulo: "Trabalhar com os cartões",
        itens: [
          "Clique no + de uma coluna, escreva o nome do cartão e aperte Enter.",
          "Clique no cartão pra abrir os detalhes: tags, descrição, início, prazo, horário, horas por dia e a meta ligada.",
          'Arraste o cartão entre as colunas, ou use a seta "Avançar".',
          'Terminou? Marque a caixinha do cartão e confirme. Ele vai pro "Pronto".',
          'Os filtros "Hoje", "7 dias", "30 dias" e "Tudo" mostram só o que cai no período.',
        ],
      },
    ],
    bomSaber: [
      'O quadro "Pedidos" já vem pronto, é sempre o primeiro da lista e não conta no limite de quadros. Ele tem tutorial próprio.',
      "No plano Grátis cabe 1 quadro e até 100 cartões. No Premium e no Pro, sem limite.",
      "As colunas podem ser renomeadas no lápis, mas são sempre seis.",
      "Todo cartão com prazo aparece no Calendário.",
      "Apagar um cartão ou um quadro não tem volta.",
    ],
    duvidas: [
      {
        pergunta: 'O cartão sumiu com o filtro "Hoje"',
        resposta:
          'O período dele, do início ao prazo, não passa por hoje. Troque pra "Tudo" ou ajuste as datas.',
      },
      {
        pergunta: "Ligar o cartão a uma meta muda o progresso dela",
        resposta: "Não. A ligação serve pra lembrar a que meta o cartão responde.",
      },
    ],
  },
  {
    slug: "pedidos",
    nome: "Pedidos",
    grupo: "Clientes e rotina",
    rota: "/pedidos",
    abrir: "Abrir os Pedidos",
    resumo:
      "Um quadro pronto com cada pedido: a cliente, o que ela pediu, o dia da entrega e se já pagou. Na entrega, o dinheiro entra no Financeiro.",
    passos: [
      {
        titulo: "Anotar um pedido",
        itens: [
          'No menu, abra "Pedidos" e clique em "Novo pedido".',
          'Em "Cliente", escolha da lista ou digite um nome novo.',
          'Escolha o produto do catálogo, a variação (quando tiver) e a quantidade. O preço vem do catálogo. "+ mais um produto" põe outro item no mesmo pedido.',
          'Escolha o dia em "Entrega" e responda "Já pagou?".',
          'Clique em "Anotar pedido". Ele entra em "A fazer".',
        ],
      },
      {
        titulo: "Mover o pedido até a entrega",
        itens: [
          'As colunas são "A fazer", "Em produção", "Pronto" e "Entregue". Arraste o cartão ou use a seta dele.',
          'Clique no cartão pra abrir o pedido. Em "Andamento" dá pra trocar a coluna; ali também se muda o dia da entrega ou se cancela.',
          'Quando um pedido não pago chega em "Entregue", o cartão pergunta "O dinheiro já entrou?". "Sim, lançar no Financeiro" lança o valor.',
          "No topo, a Pólia One mostra as entregas de hoje, as de amanhã, as atrasadas e quanto entra na semana.",
        ],
      },
    ],
    bomSaber: [
      "O pedido é uma venda: baixa o estoque quando é anotado e aparece em Vendas, no canal Encomenda.",
      'Pedido pago na hora entra no Financeiro na hora. "Ainda não" deixa o valor a receber até a entrega.',
      "Atrasado é o pedido aberto com o dia da entrega já passado. O cartão avisa em vermelho.",
      '"Entregue" mostra os últimos 7 dias. Os mais antigos continuam em Vendas.',
      "No plano Grátis cabem 15 pedidos abertos ao mesmo tempo. No Premium e no Pro, sem limite.",
    ],
    duvidas: [
      {
        pergunta: "Cancelei um pedido. O que acontece",
        resposta:
          "Os itens voltam pro estoque, o valor sai do Financeiro e o pedido sai do quadro. Em Vendas, ele fica como cancelado.",
      },
      {
        pergunta: 'Por que o botão "Novo pedido" está apagado',
        resposta:
          'No Grátis, o quadro já tem 15 pedidos abertos. Mova pra "Entregue" os que já saíram e o botão volta.',
      },
      {
        pergunta: "Combinei outro dia com a cliente",
        resposta: 'Abra o pedido, troque a data em "Entrega" e clique em "Salvar a nova data".',
      },
    ],
  },
  {
    slug: "calendario",
    nome: "Calendário",
    grupo: "Clientes e rotina",
    rota: "/calendario",
    abrir: "Abrir o Calendário",
    resumo:
      "O mês com o dia de entrega de cada pedido e, com o Google Calendar conectado, os compromissos de lá.",
    // Sem clipe desde 28/10/2026: o vídeo mostra a grade com os cartões do
    // Planner, que saiu das usuárias. Volta quando a narração nova sair.
    passos: [
      {
        titulo: "Ver o mês",
        itens: [
          'Use "Mês anterior" e "Próximo mês" pra navegar. "Hoje" volta pro mês atual.',
          'Clique num dia pra ver tudo o que cai nele. Cada item mostra se é "Entrega" ou se vem do Google.',
          'Os filtros "Entregas" e "Google Calendar" ligam e desligam cada origem.',
        ],
      },
      {
        titulo: "Anotar um pedido",
        itens: [
          'Clique no dia e depois em "Anotar um pedido". O quadro de Pedidos abre, e o pedido aparece aqui no dia da entrega.',
        ],
      },
      {
        titulo: "Conectar o Google Calendar",
        itens: [
          'Clique em "Conectar Google Calendar" e entre na sua conta Google.',
          "Na tela do Google, marque a permissão de ver a agenda. Sem ela, os compromissos não aparecem.",
          'De volta à Pólia One, aparece "Google Calendar conectado." e os compromissos entram no mês.',
        ],
      },
    ],
    bomSaber: [
      "O Calendário é do Premium e do Pro.",
      "O Google entra só pra leitura: a Pólia mostra a agenda principal, mas não cria nem muda compromisso lá.",
      "Pra desconectar, clique no seu e-mail ao lado do botão do Google. As entregas dos pedidos ficam.",
    ],
    duvidas: [
      {
        pergunta: "Meu pedido não aparece",
        resposta:
          'O Calendário mostra o pedido no dia da entrega, e o filtro "Entregas" precisa estar ligado. Pedido cancelado não aparece.',
      },
      {
        pergunta: "Qual agenda do Google aparece",
        resposta: "Só a agenda principal da conta conectada.",
      },
    ],
  },
  {
    // Slug e rota continuam "caderno": desde 28/10/2026 as notas ficaram só pra
    // conta interna e, pra todas, a tela é o guia de presença do Módulo 5. Sem
    // clipe: o vídeo mostra as notas.
    slug: "caderno",
    nome: "Guia de presença",
    grupo: "Primeiros passos",
    rota: "/caderno",
    abrir: "Abrir o guia de presença",
    resumo: "Os canais da marca, a voz e a bio, do jeito que o Módulo 5 do Planejamento respondeu.",
    passos: [
      {
        titulo: "Montar o guia",
        itens: [
          "Responda o Módulo 5 do Planejamento: por onde a cliente chega, como a marca fala e a bio.",
          'No fim do módulo, clique em "Abrir meu guia de presença". O guia mostra as respostas, prontas pra consultar.',
        ],
      },
      {
        titulo: "Mudar uma resposta",
        itens: ['No guia, clique em "Editar no Planejamento →". O guia muda junto.'],
      },
    ],
    bomSaber: [
      "O guia de presença abre em todo plano.",
      "Enquanto o Módulo 5 não tem resposta, o guia aparece em branco, com o atalho pro módulo.",
    ],
    duvidas: [
      {
        pergunta: "Cadê as minhas notas",
        resposta:
          "As notas saíram da Pólia One em outubro de 2026, mas continuam guardadas. Se precisar de alguma, fale com a Pólia pela Ajuda.",
      },
    ],
  },
  {
    slug: "plano-de-conteudo",
    nome: "Plano de conteúdo",
    grupo: "Clientes e rotina",
    rota: "/plano-conteudo",
    abrir: "Abrir o Plano de conteúdo",
    resumo:
      "Uma ideia de post pra cada dia do ano, pelo tipo do negócio, e cada uma dá pra editar.",
    trecho: "conteudo",
    passos: [
      {
        titulo: "Montar o plano",
        itens: [
          "Na primeira visita, escolha o tipo do negócio, como Papelaria e presentes ou Comida e doces.",
          'Clique em "Montar meu plano".',
          'Use o seletor "Mês" pra ver o ano. Cada dia tem o tipo de post, o título e a ideia.',
        ],
      },
      {
        titulo: "Usar no dia a dia",
        itens: [
          "Clique no título ou na ideia pra editar. Salva quando você clica fora.",
          'Depois de postar, clique em "Marcar como postado". Se o tema de hoje ainda não foi marcado, a tela lembra, com o botão "Já postei".',
        ],
      },
      {
        titulo: "Trocar o tipo do negócio",
        itens: [
          'Clique em "Trocar o tipo de negócio", escolha o novo e clique em "Refazer o plano".',
          "Confirme. O plano muda de hoje até 31 de dezembro. Os dias que já passaram ficam como estão.",
        ],
      },
    ],
    bomSaber: [
      "O Plano de conteúdo é do Pro.",
      "As ideias vêm de um banco fixo de 60 temas por tipo de negócio, espalhados pelo ano. Não é IA e não tem limite de uso.",
      "Dá pra escolher um tipo de negócio por plano.",
    ],
    duvidas: [
      {
        pergunta: "Refazer o plano apaga o que eu editei",
        resposta: "Só de hoje em diante. Os dias que já passaram ficam intocados.",
      },
    ],
  },
] as const satisfies readonly Tutorial[];

export type SlugTutorial = (typeof LISTA)[number]["slug"];

export const TUTORIAIS: readonly Tutorial[] = LISTA;

/** Ordem de leitura: a dos grupos, e dentro do grupo a ordem da lista. */
const TODOS_ORDENADOS: readonly Tutorial[] = GRUPOS_TUTORIAL.flatMap((g) =>
  TUTORIAIS.filter((t) => t.grupo === g),
);

/** O que as usuárias veem na lista, na busca e no anterior/próximo. */
const ORDENADOS: readonly Tutorial[] = TODOS_ORDENADOS.filter((t) => !t.interno);

export function tutorialPorSlug(slug: string): Tutorial | undefined {
  return TUTORIAIS.find((t) => t.slug === slug);
}

/**
 * Tutorial da tela aberta, pro link "Como usar esta tela" do cabeçalho
 * (PaginaLogada). Vale a rota mais comprida que bate, contando `outrasRotas`:
 * /produtos/anuncios é Anúncios, não Produtos; /configuracoes/integracoes/tiktok
 * é Anúncios, não Planos; /planejamento/modulo/2 é Planejamento.
 */
export function tutorialDaRota(pathname: string): Tutorial | undefined {
  let achado: Tutorial | undefined;
  let tamanho = 0;
  for (const t of TODOS_ORDENADOS) {
    for (const rota of [t.rota, ...(t.outrasRotas ?? [])]) {
      const bate = pathname === rota || pathname.startsWith(rota + "/");
      if (bate && rota.length > tamanho) {
        achado = t;
        tamanho = rota.length;
      }
    }
  }
  return achado;
}

export function vizinhosDoTutorial(slug: string): {
  anterior: Tutorial | undefined;
  proximo: Tutorial | undefined;
} {
  const i = ORDENADOS.findIndex((t) => t.slug === slug);
  if (i < 0) return { anterior: undefined, proximo: undefined };
  return { anterior: ORDENADOS[i - 1], proximo: ORDENADOS[i + 1] };
}

/** Plano que a tela pede, com o nome visível (Grátis/Premium/Pro). */
export function planoDoTutorial(t: Tutorial): PlanoVisivel {
  if (t.plano) return t.plano;
  if (ehRotaProjete(t.rota)) return "Pro";
  return tierMinimoDaRota(t.rota) === "confere" ? "Grátis" : "Premium";
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Busca no nome, no resumo, nos passos e nas dúvidas. Menos de 2 letras: tudo. */
export function buscarTutoriais(termo: string): readonly Tutorial[] {
  const q = normalizar(termo.trim());
  if (q.length < 2) return ORDENADOS;
  return ORDENADOS.filter((t) =>
    normalizar(
      [
        t.nome,
        t.resumo,
        ...t.passos.flatMap((p) => [p.titulo, ...p.itens]),
        ...t.bomSaber,
        ...t.duvidas.flatMap((d) => [d.pergunta, d.resposta]),
      ].join(" "),
    ).includes(q),
  );
}

// Duração de cada trecho, em segundos, medida no corte de gerar_versao_app.py
// (tempos.json do vídeo). Mudou o vídeo, rode o gerador e atualize aqui; o
// teste confere que cada trecho daqui tem o mp3 dele.
const DURACAO_TRECHO: Record<string, number> = {
  plano: 24,
  "planejamento-ia": 35,
  calculadora: 8,
  projecao: 13,
  raiox: 14,
  clientes: 12,
  metas: 9,
  caderno: 9,
  planner: 11,
  conteudo: 11,
  calendario: 10,
  assistente: 14,
};

export const TRECHOS_USADOS = Object.keys(DURACAO_TRECHO);

/** "16 s" ou "1min27"; sem trecho, null. */
export function duracaoDoTrecho(trecho: string | undefined): string | null {
  if (!trecho) return null;
  const s = DURACAO_TRECHO[trecho];
  if (!s) return null;
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)}min${String(s % 60).padStart(2, "0")}`;
}
