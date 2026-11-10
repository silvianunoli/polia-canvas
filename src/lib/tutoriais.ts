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
// Sem `trecho`, a página mostra só o passo a passo: Anúncios nos canais fica sem
// clipe porque só o Mercado Livre conecta. O vídeo foi refeito em 06/11/2026 (ONE-143).

import { VIRADA_PRECOS, ehRotaProjete, tierMinimoDaRota, tiersPagos } from "@/lib/planos";

// Preço fixado na data da virada, sem ler o relógio: esta lista monta quando o
// módulo carrega, e no Worker o relógio ainda não anda nessa hora. Com `tiersPagos()`
// a página saiu do servidor com o preço de antes da virada (06/11/2026).
const PRECOS = tiersPagos(Date.parse(VIRADA_PRECOS));
function reaisDoPlano(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
      "Os três primeiros passos que aparecem no topo do Painel: lançar a próxima encomenda, marcar como entregue e ver o lucro, e calcular o preço de um produto.",
    trecho: "primeiros",
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
          '"Lançar a próxima encomenda": clique em "Quero lançar a encomenda →". No quadro de Pedidos, "Anotar o primeiro pedido" guarda a cliente, o que ela pediu e o dia da entrega. Com o catálogo vazio, "Cadastrar o produto" abre o cadastro ali mesmo e o pedido continua. Quem vende serviço lê "Lançar o próximo pedido".',
          '"Marcar como entregue e ver o lucro": clique em "Quero abrir o quadro de Pedidos →" e passe o pedido até "Entregue". O cartão do pedido mostra quanto ele lucra. Sem o custo do produto, o cartão avisa "falta o custo pra mostrar o lucro".',
          '"Calcular o preço de um produto": clique em "Quero calcular meu preço →". Sem anúncio de nicho, escolha antes "Produto", "Serviço" ou "Os dois". A Calculadora abre na aba certa e, se ainda não houver preço calculado, guarda esse primeiro sozinha.',
          'O contador "N de 3" acompanha. Com os três feitos, o bloco some e o Painel passa a mostrar o mês.',
        ],
      },
    ],
    bomSaber: [
      "Só o primeiro passo que falta fica aceso. Os outros esperam a vez.",
      "Conta nova começa com 7 dias do Pro. Com um pedido lançado e entregue durante o teste, ele ganha mais 7 dias. O preço não precisa estar calculado.",
      'O nome da marca fica em Configurações, em "Seu negócio", junto com o logo e a cor.',
      'No alto da tela ficam o "Suporte" e o sino. O sino junta pedido novo da loja, resposta do suporte e novidade da Pólia One. O "Suporte" leva pra "Abrir um chamado", "Seus chamados" e "Central de ajuda". No app, os dois ficam na aba Mais.',
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
      "A tela de todo dia: quanto falta pro mês, o que entrou, quanto a marca lucrou e as entregas da semana.",
    trecho: "painel",
    passos: [
      {
        titulo: "Ler o Painel",
        itens: [
          "A frase do topo muda com o mês. Sem venda no mês, ela aponta os Pedidos. Com venda, mostra quanto falta pra fechar as contas ou a Meta do mês.",
          'O botão logo abaixo é o próximo passo: "Quero lançar um pedido →" sem venda no mês, ou o registro e o Financeiro depois dela.',
          'Os cartões "Receita · mês", "Pedidos · mês" e "Quanto lucrou · mês" resumem o mês.',
          '"Pedidos · mês" conta as vendas do mês, pagas e a receber, o mesmo número do cartão "Vendas · mês", mais as entradas de venda ou serviço lançadas à mão. "Receita · mês" soma só o que já entrou, então pedido a receber aparece nos pedidos antes de aparecer na receita.',
          '"Quanto lucrou · mês" desconta o custo de cada produto vendido, o mesmo lucro do cartão "Vendas · mês", soma as entradas que não vieram de venda e tira as saídas do mês. A frase embaixo do número diz de onde ele veio.',
          'Com pedido aberto no quadro de Pedidos, o cartão "Entregas" mostra as de hoje, as de amanhã, as atrasadas e quanto entra na semana. "Abrir o quadro" leva pra ele.',
        ],
      },
      {
        titulo: "Registrar uma entrada pelo Painel",
        itens: [
          'No bloco "Entrou e saiu este mês", clique em "Registrar". No plano Grátis, com venda no mês, o botão "Registrar entrada ou saída" do topo abre o mesmo registro.',
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
      "No Grátis, o Painel lança entradas e saídas só do mês atual. O histórico dos outros meses fica no Financeiro, do Premium.",
      'A Meta do mês nasce em Metas, em "Criar a Meta do mês".',
      'Saída lançada em "Insumos / estoque" não sai de novo do "Quanto lucrou": o material já está no custo de cada produto vendido.',
      'Saída em "Compra de equipamento" também fica fora do "Quanto lucrou": a máquina se paga aos poucos, pela reserva.',
      'Sem venda registrada no mês, o "Quanto lucrou" é entradas menos saídas, sem a compra de equipamento. Venda de produto sem custo entra inteira, e a frase embaixo do número diz quantas são.',
      'Venda "a receber" já conta no "Quanto lucrou" do mês em que foi feita, como no cartão de Vendas. A frase embaixo do número diz quanto ainda vai entrar.',
    ],
    duvidas: [
      {
        pergunta: 'Por que "Quanto lucrou" é menor do que entrou',
        resposta:
          "Porque desconta o custo de cada produto vendido, além das saídas do mês. Vendeu 2 cadernos de R$ 23,08 com custo de R$ 15 cada: entraram R$ 46,16 e a marca lucrou R$ 16,16.",
      },
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
    // Saiu das usuárias em 31/10/2026 (vira ferramenta do Pólia Lab): fora da
    // lista e da busca. Sem a flag `planejamento`, as rotas levam pro Painel.
    interno: true,
    abrir: "Abrir o Planejamento",
    resumo:
      "O documento vivo da marca: seis módulos, do porquê ela existe até onde ela vai. Cada resposta vira preço, meta e conta do mês nas outras telas.",
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
    trecho: "plano",
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
      "Grátis, R$ 0: Painel, Calculadora, Produtos (até 5), Pedidos (até 15 abertos), Metas e Assistente.",
      `Premium, ${reaisDoPlano(PRECOS.controle.precoMensal)} por mês: Produtos e Pedidos sem limite, mais Vendas, Financeiro, Clientes, Calendário, Projeção, Raio-x, Encomenda, Equipamentos e Resumo pro contador.`,
      `Pro, ${reaisDoPlano(PRECOS.projete.precoMensal)} por mês: tudo do Premium, mais a conexão com o Mercado Livre e a vitrine online ligada aos Pedidos.`,
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
    trecho: "produtos",
    passos: [
      {
        titulo: "Cadastrar um produto",
        itens: [
          'Na aba "Catálogo", clique em "+ Adicionar produto".',
          'Preencha o "Nome" e escolha o "Tipo": "Produto físico", "Produto digital" ou "Serviço".',
          'Coloque o "Preço de venda (R$)" e o "Custo de produção (R$)". Com o custo, o cartão já mostra quanto a marca lucra por venda.',
          'Em "Fotos", clique em "Enviar foto" pra subir até 4 fotos do aparelho (JPG, PNG ou WEBP, até 3 MB). A primeira é a da vitrine; o "X" tira uma foto. Sem foto enviada, dá pra colar o link de uma imagem.',
          'Escreva também uma "Descrição curta" e uma "Observação interna", que só aparece pra você.',
          'Produto físico tem o bloco "Estoque": "Quantidade agora", "Estoque mínimo" e "Código (SKU)". Abaixo do mínimo, o produto aparece como estoque baixo.',
          'Clique em "Salvar produto". O botão só libera com nome e preço de venda preenchidos.',
          'Com muitos produtos, o campo "Buscar pelo nome" acima dos cartões acha o produto sem diferença de maiúscula ou acento.',
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
      {
        titulo: "Guardar os equipamentos da marca",
        itens: [
          'Na aba "Equipamentos", clique em "Adicionar equipamento".',
          'Preencha o "Nome", o "Preço (R$)" e os "Meses de uso". A tela mostra quanto reservar por mês.',
          'Quando comprar, clique em "Marcar como comprado", confira a "Data da compra" e o "Quanto pagou (R$)" e clique em "Registrar compra". A saída entra no Financeiro em "Compra de equipamento".',
          'Comprou errado? "Desfazer compra" exclui a saída e o equipamento volta pra planejado.',
          'O topo da aba mostra "Investido até agora", "Falta comprar" e "Reserva do mês".',
        ],
      },
    ],
    bomSaber: [
      "No plano Grátis cabem 5 produtos ativos. No Premium e no Pro, sem limite.",
      "Produto não se apaga, só se arquiva, pra não perder o histórico de venda.",
      "A planilha aceita .csv ou .txt, até 5 MB e até 1000 produtos por vez.",
      'As abas "Estoque", "Insumos e produção" e "Equipamentos" ficam na mesma tela, ao lado do "Catálogo".',
      'A aba "Equipamentos" é do Premium e do Pro.',
      'Equipamento planejado entra na "Reserva do mês", mas não vira saída. Só a compra marcada aparece no Financeiro.',
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
          'Em "Qual produto?", escreva o nome, como "Caderno A5". No Serviço o campo é "Qual serviço?" e na Encomenda, "Qual encomenda?".',
          'Em "Custos diretos (por unidade)", coloque matéria-prima, embalagem, mão de obra e outros custos de cada peça.',
          'Em "Custos fixos e salário", entre com os custos fixos do mês, o "Pró-labore (seu salário)" e quantas peças a marca vende por mês, somando todos os produtos. O botão "Puxar do Financeiro deste mês" traz os custos fixos que já estão lançados, e "Usar a reserva dos equipamentos" preenche a "Reserva de equipamento" com o total da aba "Equipamentos".',
          'Em "Sobre o preço de venda (%)", coloque a taxa da maquininha ou do marketplace, os impostos e, em "Quanto quer lucrar (%)", o lucro que a marca quer em cada venda.',
          'O resultado mostra o "Preço sugerido", o custo por unidade, o preço mínimo pra não ter prejuízo e quanto a marca lucra.',
        ],
      },
      {
        titulo: "Guardar o preço no catálogo",
        itens: [
          'No primeiro preço, a Pólia One guarda sozinha: com a conta parada por 2 segundos, o preço vai pro catálogo com o nome de "Qual produto?". Com o campo vazio, entra como "Primeiro produto" ou "Primeiro serviço".',
          'Pra trocar o nome depois de guardado, mude o "Qual produto?" e saia do campo. "Completar o cadastro" e "Ver no catálogo" ficam logo abaixo do preço.',
          'A partir do segundo preço, clique em "Guardar esse preço". O cadastro do produto abre com o nome de "Qual produto?", o preço e o custo preenchidos: confira e clique em "Salvar produto".',
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
      'A aba "Encomenda (sob medida)" mostra o preço no Premium e no Pro.',
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
          'Pro catálogo, em Produtos, com o nome escrito em "Qual produto?". Se o campo ficou vazio, com o nome "Primeiro produto". Dá pra renomear quando quiser, e é esse nome que aparece no pedido.',
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
      "Liga cada anúncio do Mercado Livre a um produto da Pólia, pra a venda baixar o estoque certo.",
    plano: "Pro",
    passos: [
      {
        titulo: "Conectar o canal de venda",
        itens: [
          'Abra Configurações e desça até "Integrações".',
          'No cartão do Mercado Livre, clique em "Conectar".',
          "Entre na conta da loja e autorize. Use a conta dona da loja, não a de colaboradora.",
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
      "TikTok Shop e Shopee ainda não conectam. Por enquanto, eles aparecem só nas taxas da Calculadora e de Vendas.",
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
    trecho: "vendas",
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
      'Pedidos do Mercado Livre entram sozinhos, como "a receber", quando o canal está conectado e os anúncios ligados.',
      "A venda sai de um produto do catálogo. Sem produto cadastrado, a tela pede pra ir em Produtos antes.",
    ],
    duvidas: [
      {
        pergunta: 'Por que a venda aparece "sem custo"',
        resposta:
          "Algum produto dessa venda estava sem custo no catálogo, então a Pólia One não tinha como calcular quanto lucrou. Preencha o custo em Produtos: as vendas que ficaram sem custo passam a usar esse custo, e o lucro se corrige.",
      },
      {
        pergunta: 'Qual a diferença pra "Registrar venda" do Financeiro',
        resposta:
          "Nenhuma. O botão do Financeiro abre o mesmo formulário de Vendas: registra a venda, guarda o custo de cada produto, baixa o estoque e lança o dinheiro.",
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
    trecho: "financeiro",
    passos: [
      {
        titulo: "Lançar uma entrada ou uma saída",
        itens: [
          'Clique em "+ Registrar entrada" ou "+ Registrar saída".',
          'Preencha o "Valor (R$)" e a "Data". A "Descrição" é opcional.',
          'Escolha a "Categoria". Se nenhuma servir, "+ nova categoria" cria a sua.',
          'Clique em "Salvar lançamento".',
          'Venda de produto vai por "+ Registrar venda": ela abre o formulário de Vendas e guarda o custo de cada produto, que o "Lucro do mês" desconta.',
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
      'A barra "Onde o mês está agora" compara o que entrou com a Meta do mês, que nasce em Metas.',
      "Os cartões do topo mostram sempre o mês atual. Os filtros mudam só o histórico.",
      '"Lucro do mês" é a mesma conta do "Quanto lucrou" do Painel: desconta o custo de cada produto vendido em Vendas, por isso pode ser menor que entradas menos saídas. Saída em "Insumos / estoque" não sai de novo, e "Compra de equipamento" fica fora.',
      "Excluir um lançamento não tem volta.",
      'No Premium e no Pro, "Resumo pro contador" baixa o mês em PDF ou CSV.',
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
          'Lance na categoria "Insumos / estoque". A Projeção deixa essa categoria fora dos custos fixos, porque ela muda com a produção, e o "Lucro do mês" não tira essa saída de novo quando as vendas do mês têm o custo de cada produto.',
      },
      {
        pergunta: "Comprei uma máquina. Como lanço",
        resposta:
          'Cadastre na aba "Equipamentos", em Produtos, e clique em "Marcar como comprado". A saída aparece aqui em "Compra de equipamento" e fica fora do "Lucro do mês" e dos custos fixos. A parcela de cada mês entra no preço pela "Reserva de equipamento" da Calculadora.',
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
      "A Projeção é do Premium e do Pro.",
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
      "O Raio-x é do Premium e do Pro.",
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
    resumo: "Cada cliente com contato, pedido, valor e status, do primeiro contato ao pós-venda.",
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
          "O status da cliente organiza a lista e não lança dinheiro no Financeiro.",
          'Pedido do quadro: em Pedidos, leve o cartão até "Entregue" e clique em "Sim, lançar no Financeiro".',
          'Venda fora do quadro: clique no nome da cliente pra abrir a ficha e use "Registrar venda". O formulário pede o produto, baixa o estoque e lança no Financeiro.',
          'Venda sem produto cadastrado: no Financeiro, use "+ Registrar entrada".',
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
        pergunta: 'Cadê o botão "Registrar venda" da lista',
        resposta:
          'Saiu, porque podia lançar em dobro uma venda que já tinha entrado por Pedidos. Agora a venda entra por Pedidos ou pela ficha da cliente. Quem já tinha registrado continua com "Registrada · ver no Financeiro".',
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
    trecho: "pedido-entrega",
    passos: [
      {
        titulo: "Anotar um pedido",
        itens: [
          'No menu, abra "Pedidos" e clique em "Novo pedido". Com o catálogo vazio, clique em "Cadastrar o produto": o cadastro abre ali mesmo e, salvo, o pedido continua.',
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
      {
        titulo: "Receber os pedidos da loja do catálogo (Pro)",
        itens: [
          'Monte a loja em "Catálogo", no menu. Cada pedido que a cliente confirma na loja entra em "A fazer", com o nome e o WhatsApp dela, os produtos, a variação de cada um e o endereço na observação.',
          "A cliente continua indo pro WhatsApp da loja depois de confirmar. Se ela não mandar a mensagem, o pedido já está guardado aqui.",
          'Se a marca tem um site próprio feito pela Pólia Lab, ele liga em "Configurações", na parte "Integrações", no cartão "Vitrine online": escreva o domínio (por exemplo, suamarca.com.br) e clique em "Ligar aos Pedidos".',
        ],
      },
    ],
    bomSaber: [
      "O pedido é uma venda: baixa o estoque quando é anotado e aparece em Vendas, no canal Encomenda.",
      'Pedido da vitrine online entra como "a receber", com a entrega marcada pelo prazo de produção da loja, e aparece em Vendas no canal "Catálogo online". A cliente vira ficha em Clientes, pelo WhatsApp.',
      'Pedido pago na hora entra no Financeiro na hora. "Ainda não" deixa o valor a receber até a entrega.',
      "Atrasado é o pedido aberto com o dia da entrega já passado. O cartão avisa em vermelho.",
      '"Entregue" mostra os últimos 7 dias. Os mais antigos continuam em Vendas.',
      "No plano Grátis cabem 15 pedidos abertos ao mesmo tempo. No Premium e no Pro, sem limite.",
      'Lançar a próxima encomenda e levar um pedido até "Entregue" são os dois primeiros dos Primeiros passos do Painel.',
      'O cartão mostra quanto o pedido lucra quando o produto tem custo. Sem custo, ele avisa "falta o custo pra mostrar o lucro": coloque em Produtos e a Pólia One corrige a venda.',
      "Pedido novo que chega pela loja do Catálogo também aparece no sino, no alto da tela, com o nome da cliente e o valor.",
      'Às 18h da véspera, a Pólia One manda um e-mail com os pedidos que têm entrega no dia seguinte e ainda não foram entregues, e um aviso no celular se o app estiver instalado. Sem entrega amanhã, não sai nada. Pra desligar, abra "Configurações" e, em "Notificações", desligue "Entregas de amanhã".',
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
      {
        pergunta: "O pedido do catálogo veio com outro preço",
        resposta:
          "O preço é o que estava no catálogo na hora do pedido. Confirme com a cliente pelo WhatsApp antes de começar a produção.",
      },
    ],
  },
  {
    slug: "catalogo",
    nome: "Catálogo",
    grupo: "Clientes e rotina",
    rota: "/catalogo",
    abrir: "Abrir o Catálogo",
    resumo:
      "A loja da marca num endereço da Pólia, com os produtos, as fotos e as variações de Produtos. A cliente monta o carrinho e confirma, e o pedido cai em Pedidos.",
    trecho: "catalogo",
    passos: [
      {
        titulo: "Abrir a loja",
        itens: [
          'No menu, abra "Catálogo". Em "Endereço", confira o endereço da loja: ele fica em one.usepolia.com.br/loja/ seguido do nome que você escolher.',
          'Ligue "Loja aberta" e clique em "Salvar a loja". Com a loja salva, o botão "Ver a loja" abre a vitrine como a cliente vê.',
        ],
      },
      {
        titulo: "Dar a cara da marca",
        itens: [
          'O logo e a cor vêm de Configurações, em "Logo e cor" ("Trocar o logo em Configurações" leva até lá). Em "Cara da loja", dá pra subir uma capa, trocar a cor de destaque e escrever a chamada e o texto de apoio.',
          "Sem capa, a loja monta a abertura com as fotos dos produtos.",
        ],
      },
      {
        titulo: "Dizer como a loja vende",
        itens: [
          'Em "Como a loja vende", preencha o WhatsApp da loja, o Instagram, o prazo de produção em dias úteis, o sinal pra começar e como é a entrega.',
          "O prazo marca o dia da entrega de cada pedido no quadro. Com sinal acima de 0, a loja mostra quanto a cliente paga pra começar.",
          'Desligue "Pedir o endereço da cliente" quando a entrega é sempre combinada na conversa.',
        ],
      },
      {
        titulo: "Escolher os produtos e as fotos",
        itens: [
          'Em "Produtos na loja", ligue cada produto que deve aparecer. Nome, preço e variações vêm de Produtos.',
          'Clique em "Foto" pra subir até 4 fotos por produto (JPG, PNG ou WEBP, até 3 MB). A primeira é a da vitrine.',
        ],
      },
    ],
    bomSaber: [
      "O preço do pedido é sempre o de Produtos na hora da compra: a loja não deixa mudar o valor pelo navegador.",
      'Pedido da loja entra em Pedidos como "a receber", em "A fazer", e a cliente vira ficha em Clientes pelo WhatsApp.',
      "O endereço da loja fica com a marca: depois de usado, não passa pra outra conta.",
      "Fora do Pro, a loja fecha e mostra que não está aberta agora. Os produtos e as fotos continuam guardados.",
      "Cada pedido novo da loja aparece no sino, no alto da tela, com o nome da cliente e o valor.",
    ],
    duvidas: [
      {
        pergunta: "Posso usar um domínio meu",
        resposta:
          "O domínio próprio (suamarca.com.br) é um serviço da Pólia Lab. A loja do Catálogo mora no endereço da Pólia.",
      },
      {
        pergunta: "A cliente precisa ter conta",
        resposta: "Não. Ela escolhe, preenche nome e WhatsApp e confirma.",
      },
    ],
  },
  {
    // Agenda das redes (ONE-155): fica fora da lista até abrir pras clientes
    // (depois das revisões do TikTok e da Meta). Hoje só admin vê a tela.
    slug: "agenda-redes",
    nome: "Agenda das redes",
    grupo: "Clientes e rotina",
    rota: "/agenda-redes",
    abrir: "Abrir a Agenda das redes",
    resumo:
      "O post da marca preparado uma vez, com o horário marcado, pra sair no Instagram e no TikTok conectados em Configurações.",
    plano: "Pro",
    interno: true,
    passos: [
      {
        titulo: "Conectar as redes",
        itens: [
          'Em Configurações, na parte de Integrações, clique em "Conectar" no card do Instagram ou do TikTok e entre com a conta da marca.',
          "O Instagram precisa ser conta profissional (comercial ou de criador de conteúdo).",
        ],
      },
      {
        titulo: "Montar o post",
        itens: [
          'Em "Agenda das redes", clique em "Novo post". Em "1. Arquivos", clique em "Adicionar" e escolha as fotos ou um vídeo. As setas mudam a ordem.',
          'Em "2. Onde sai", marque o Instagram, o TikTok ou os dois. Em "3. Legenda", escreva a legenda com as hashtags. Post de fotos no TikTok tem também um título opcional.',
        ],
      },
      {
        titulo: "Fazer as escolhas do TikTok",
        itens: [
          'Com o TikTok marcado, aparece "4. Regras do TikTok", com a conta onde o post vai sair. Em "Quem pode ver", escolha uma opção: nenhuma vem marcada, e o botão só libera depois da escolha.',
          "Marque se quem segue pode comentar e, em vídeo, fazer dueto e stitch. O que a conta desligou no TikTok aparece em cinza.",
          'Se o post divulga uma marca, produto ou serviço, ligue a opção e marque "Sua marca", "Conteúdo de marca" ou os dois. Conteúdo de marca não pode ficar "Só eu".',
        ],
      },
      {
        titulo: "Escolher o horário",
        itens: [
          'Em "Quando", escolha "Escolher dia e hora" (horário de Brasília, de 5 minutos até 60 dias à frente) ou "Publicar agora", e clique no botão.',
          'Na lista, cada post mostra como está em cada rede: agendado, publicando, publicado (com "ver post") ou não publicou, com o motivo.',
        ],
      },
    ],
    bomSaber: [
      "Foto vira JPEG antes de subir. O Instagram aceita até 10 fotos por post, de 4:5 (em pé) a 1,91:1 (deitada); o TikTok, até 35.",
      "Vídeo em MP4 ou MOV, de 3 segundos até 50 MB. O TikTok ainda limita a duração de acordo com a conta.",
      'Enquanto nenhuma rede começou a publicar, "Cancelar" tira o post da agenda e apaga os arquivos dele.',
      '"Publicar agora" começa a sair em até 1 minuto. Depois que sai, o post pode levar alguns minutos pra aparecer no perfil.',
      'Se a rede não confirmar se o post saiu, a Pólia não manda de novo: o post aparece como "não publicou", pedindo pra conferir no app da rede antes de agendar outra vez.',
    ],
    duvidas: [
      {
        pergunta: "Dá pra mandar story",
        resposta: "Ainda não. A Agenda das redes publica foto, carrossel e vídeo.",
      },
      {
        pergunta: "O que a Pólia faz na minha conta",
        resposta:
          "Só publica os posts agendados e confirmados na Pólia. Ela não lê mensagens, não comenta, não curte e não segue ninguém.",
      },
    ],
  },
  {
    slug: "calendario",
    nome: "Calendário",
    grupo: "Clientes e rotina",
    rota: "/calendario",
    abrir: "Abrir o Calendário",
    resumo: "O mês com o dia de entrega de cada pedido.",
    // A conexão com o Google Calendar saiu da Pólia One em 02/11/2026.
    trecho: "calendario",
    passos: [
      {
        titulo: "Ver o mês",
        itens: [
          'Use "Mês anterior" e "Próximo mês" pra navegar. "Hoje" volta pro mês atual.',
          "Clique num dia pra ver as entregas dele. Cada uma mostra a cliente e o que vai no pedido.",
          'O filtro "Entregas" liga e desliga as entregas na grade.',
        ],
      },
      {
        titulo: "Anotar um pedido",
        itens: [
          'Clique no dia e depois em "Anotar um pedido". O quadro de Pedidos abre, e o pedido aparece aqui no dia da entrega.',
        ],
      },
    ],
    bomSaber: [
      "O Calendário é do Premium e do Pro.",
      "Pedido entregue continua no dia dele, riscado na grade.",
    ],
    duvidas: [
      {
        pergunta: "Meu pedido não aparece",
        resposta:
          'O Calendário mostra o pedido no dia da entrega, e o filtro "Entregas" precisa estar ligado. Pedido cancelado não aparece.',
      },
      {
        pergunta: "Cadê os compromissos do Google",
        resposta:
          "A conexão com o Google Calendar saiu da Pólia One em novembro de 2026. O Calendário mostra as entregas dos pedidos.",
      },
    ],
  },
  {
    // Slug e rota continuam "caderno": desde 28/10/2026 as notas ficaram só pra
    // conta interna e, pra todas, a tela é o guia de presença do Módulo 5. Interno
    // desde 31/10/2026: o guia nasce do Módulo 5 do Planejamento, que saiu das usuárias.
    slug: "caderno",
    interno: true,
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
  primeiros: 12,
  "pedido-entrega": 47,
  painel: 19,
  plano: 32,
  produtos: 17,
  vendas: 19,
  catalogo: 12,
  calculadora: 12,
  financeiro: 19,
  metas: 11,
  projecao: 13,
  raiox: 14,
  clientes: 15,
  calendario: 14,
  assistente: 16,
};

export const TRECHOS_USADOS = Object.keys(DURACAO_TRECHO);

/** "16 s" ou "1min27"; sem trecho, null. */
export function duracaoDoTrecho(trecho: string | undefined): string | null {
  if (!trecho) return null;
  const s = DURACAO_TRECHO[trecho];
  if (!s) return null;
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)}min${String(s % 60).padStart(2, "0")}`;
}
