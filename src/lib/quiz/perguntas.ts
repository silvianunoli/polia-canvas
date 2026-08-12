// Quiz "Você está pagando pra trabalhar?" — questionário fixo (PRD-quiz.md §5).
//
// As 8 perguntas são hardcoded de propósito: o v1 não tem CMS de quiz (rabbit
// hole listado no PRD). Dado puro, sem React e sem Supabase — a régua de
// pontuação vive em pontuacao.ts e consome isto.

/** Os 6 territórios são os 6 módulos do Planejamento (src/lib/planejamento.ts).
 *  A ORDEM deste array é a ordem oficial dos módulos e também a regra de
 *  desempate do território fraco: empatou, vale o primeiro daqui. */
// `explicacao` e `conta` são os textos fechados no PRD-ajuste-copy-quiz.md §2.4
// (antes eram "[A DEFINIR]" no PRD original, e o que estava no ar era rascunho
// meu). A `conta` começa em minúscula de propósito: na tela ela vem logo depois
// do rótulo "A conta pra fazer hoje:", na mesma frase.
export const TERRITORIOS = [
  {
    id: "razao",
    nome: "Razão de existir",
    explicacao:
      'Alguém te pergunta o que você faz, e a resposta sai enrolada, cheia de "depende" e de exemplo. A pessoa some antes de você terminar de explicar.',
    conta:
      "conte quantas vezes isso aconteceu esse mês, alguém perguntando o que você faz e sumindo depois. Esse número é o quanto a frase que falta já te custou.",
  },
  {
    id: "quem",
    nome: "Quem você serve",
    explicacao:
      "Você corre atrás de cliente novo todo mês, com o mesmo esforço, o mesmo desconto, a mesma pressa, e não sabe se as antigas ainda compram de você.",
    conta:
      "pegue suas últimas 10 vendas e conte quantas dessas clientes voltaram a comprar. Esse número, não o que você imagina, mostra quantas ficam de verdade.",
  },
  {
    id: "vende",
    nome: "O que você vende",
    explicacao:
      "Você fecha vendas o mês inteiro, mas na hora de pagar as contas não sabe dizer qual produto pagou o quê.",
    conta:
      "escolha os 3 produtos ou serviços que mais saem e calcule quanto cada um deixa depois do custo. O que mais sai nem sempre é o que mais paga.",
  },
  {
    id: "vale",
    nome: "Quanto vale",
    explicacao:
      "Uma cliente pede desconto, você concede na hora pra não perder a venda, e só percebe o tamanho do prejuízo quando fecha a conta do mês.",
    conta:
      "pegue seu produto mais vendido e calcule quanto ele deixa depois de todos os custos. Esse número é o teto real do seu desconto, não o que parece justo na hora.",
  },
  {
    id: "acharem",
    nome: "Como te acharem",
    explicacao:
      "Você posta em toda rede que existe, sem saber de verdade por onde as clientes novas estão chegando até você.",
    conta:
      "puxe suas últimas 5 vendas novas e escreva por onde cada cliente te achou. O canal que mais se repete é onde vale insistir essa semana.",
  },
  {
    id: "onde",
    nome: "Onde você vai",
    explicacao:
      "Toda venda parece uma vitória, mas você não sabe dizer se o mês está fechando no azul ou só parecendo fechar.",
    conta:
      "some suas contas fixas do mês (aluguel, ferramentas, o que for) e divida pelo que você cobra em média. Esse é o tanto que precisa vender só pra empatar.",
  },
] as const;

export type TerritorioId = (typeof TERRITORIOS)[number]["id"];
export type Territorio = (typeof TERRITORIOS)[number];

export type AlternativaId = "a" | "b" | "c";

export interface Alternativa {
  id: AlternativaId;
  rotulo: string;
  /** A = 2, B = 1, C = 0. */
  pontos: number;
}

export interface PerguntaQuiz {
  id: string;
  /** Território que a pergunta mede. `null` nas de comportamento (7 e 8):
   *  elas pontuam a faixa, nunca o território fraco. */
  territorio: TerritorioId | null;
  enunciado: string;
  alternativas: [Alternativa, Alternativa, Alternativa];
}

function alternativas(a: string, b: string, c: string): [Alternativa, Alternativa, Alternativa] {
  return [
    { id: "a", rotulo: a, pontos: 2 },
    { id: "b", rotulo: b, pontos: 1 },
    { id: "c", rotulo: c, pontos: 0 },
  ];
}

/** Textos exatos do PRD-quiz.md §5. Não reescrever sem atualizar o PRD.
 *
 *  A ORDEM deste array é a ordem em que as perguntas aparecem na tela, e ela
 *  segue a hierarquia dos módulos (PRD-ajuste-copy-quiz.md §2.2): abre por
 *  Razão de existir, não por desconto. Abrir por desconto fazia o quiz inteiro
 *  parecer ferramenta de precificação, que é o recolapso já corrigido na home.
 *
 *  O `id` NÃO acompanha a posição: q1 continua sendo a pergunta do desconto,
 *  mesmo exibida em 4º. Território e pontos são propriedade da pergunta, então
 *  reordenar a exibição não mexe em nada do cálculo, e o jsonb gravado em
 *  quiz_leads.respostas continua querendo dizer a mesma coisa que ontem. */
export const PERGUNTAS: PerguntaQuiz[] = [
  {
    id: "q3",
    territorio: "razao",
    enunciado: "Te pedem pra explicar seu negócio em uma frase. Sai na hora?",
    alternativas: alternativas("Sai.", "Sai na terceira tentativa.", "Eu travo."),
  },
  {
    id: "q4",
    territorio: "quem",
    enunciado: "De 10 clientes, quantas voltam pra comprar de novo?",
    alternativas: alternativas("Sei o número.", "Tenho uma impressão.", "Não faço ideia."),
  },
  {
    id: "q2",
    territorio: "vende",
    enunciado: "Qual produto seu deixa mais dinheiro no fim do mês? (não o que mais vende)",
    alternativas: alternativas("Sei qual é.", "Acho que sei.", "Nunca fiz essa conta."),
  },
  {
    id: "q1",
    territorio: "vale",
    enunciado: "Uma cliente pede desconto agora. Você sabe até onde pode ir sem sair no prejuízo?",
    alternativas: alternativas(
      "Sei na hora.",
      "Tenho uma noção.",
      "Decido no chute e depois fico remoendo.",
    ),
  },
  {
    id: "q5",
    territorio: "acharem",
    enunciado: "Sua última cliente nova chegou até você por onde?",
    alternativas: alternativas("Sei exatamente.", "Acho que sei.", "Não sei dizer."),
  },
  {
    id: "q6",
    territorio: "onde",
    enunciado: "Quanto precisa entrar esse mês pra você fechar no azul?",
    alternativas: alternativas(
      "Sei o número.",
      "Sei mais ou menos.",
      "Descubro quando o mês acaba.",
    ),
  },
  {
    id: "q7",
    territorio: null,
    enunciado: "Suas decisões de dinheiro (preço, compra, desconto) saem como?",
    alternativas: alternativas(
      "Com conta feita.",
      "Metade conta, metade sentimento.",
      "No chute, na pressão.",
    ),
  },
  {
    id: "q8",
    territorio: null,
    enunciado: "Depois de uma decisão difícil, você fica remoendo se acertou?",
    alternativas: alternativas("Quase nunca.", "Às vezes.", "Sempre."),
  },
];

export const TOTAL_PERGUNTAS = PERGUNTAS.length;

export interface Faixa {
  id: string;
  /** Pontuação mínima (inclusive) pra cair nesta faixa. */
  min: number;
  nome: string;
  /** Uma linha que constata, sem humilhar (PRD §5). */
  resumo: string;
}

/** Da maior pra menor: `faixaPorPontos` pega a primeira cujo `min` couber. */
export const FAIXAS: Faixa[] = [
  {
    id: "quase-la",
    min: 13,
    nome: "Quase lá, falta amarrar",
    resumo:
      "A maior parte das decisões já sai com conta feita. O que falta é fechar os pontos soltos.",
  },
  {
    id: "meio-caminho",
    min: 9,
    nome: "Meio caminho",
    resumo: "Metade das decisões tem conta atrás. A outra metade ainda sai no sentimento.",
  },
  {
    id: "no-escuro",
    min: 5,
    nome: "No escuro nos pontos que doem",
    resumo: "Os números que mais pesam no bolso são justamente os que ainda não estão à mão.",
  },
  {
    id: "no-chute",
    min: 0,
    nome: "No chute total",
    resumo:
      "Hoje quase toda decisão de dinheiro sai sem conta. Isso tem conserto, e começa por um número só.",
  },
];

/** Texto de consentimento exibido no gate. Vai gravado junto com o lead
 *  (coluna consent_texto) pra auditoria LGPD: precisa ser exatamente o que a
 *  pessoa leu na tela. Alterou a frase aqui, os leads novos guardam a nova.
 *
 *  Promete o diagnóstico por e-mail, e isso só é verdade porque
 *  src/lib/quiz/email.ts existe e o envio acontece em quiz.functions.ts logo
 *  depois de gravar. Tirando o envio, esta frase tem que sair junto: pedir
 *  aceite pra uma entrega que não acontece é coletar dado sob pretexto falso. */
export const CONSENT_TEXTO =
  "Aceito receber meu diagnóstico e conteúdos da Pólia por e-mail. Sem spam, e você sai quando quiser.";
