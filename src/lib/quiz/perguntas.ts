// Quiz "Você está pagando pra trabalhar?" — questionário fixo (PRD-quiz.md §5).
//
// As 8 perguntas são hardcoded de propósito: o v1 não tem CMS de quiz (rabbit
// hole listado no PRD). Dado puro, sem React e sem Supabase — a régua de
// pontuação vive em pontuacao.ts e consome isto.

/** Os 6 territórios são os 6 módulos do Planejamento (src/lib/planejamento.ts).
 *  A ORDEM deste array é a ordem oficial dos módulos e também a regra de
 *  desempate do território fraco: empatou, vale o primeiro daqui. */
export const TERRITORIOS = [
  {
    id: "razao",
    nome: "Razão de existir",
    explicacao:
      "Quando a explicação do negócio não sai redonda, quem ouve não entende o que está comprando. O orçamento vira um vou pensar que não volta.",
    conta:
      "Conta quantos orçamentos saíram esse mês e quantos viraram venda. A diferença é o tamanho do que não ficou claro.",
  },
  {
    id: "quem",
    nome: "Quem você serve",
    explicacao:
      "Cliente que volta custa bem menos que cliente nova. Sem esse número, não dá pra saber se o negócio está crescendo ou só repondo quem foi embora.",
    conta:
      "Pega as últimas 10 clientes e marca quantas já compraram mais de uma vez. Esse número é a sua taxa de retorno.",
  },
  {
    id: "vende",
    nome: "O que você vende",
    explicacao:
      "Vender muito não é a mesma coisa que sobrar dinheiro. O produto que mais sai costuma ser o que menos deixa.",
    conta:
      "Escolhe um produto: preço de venda menos tudo que entrou nele (material, embalagem, taxa, entrega, seu tempo). O que sobra é o que ele deixa por unidade.",
  },
  {
    id: "vale",
    nome: "Quanto vale",
    explicacao:
      "Desconto dado na hora sai do que sobra, não do preço. Sem saber quanto sobra, todo desconto é aposta.",
    conta:
      "Pega o produto em que mais pedem desconto: preço menos custo total. O que sobra é o teto. Desconto acima disso é trabalhar de graça.",
  },
  {
    id: "acharem",
    nome: "Como te acharem",
    explicacao:
      "Sem saber por onde as clientes chegam, o esforço se espalha em canal que não traz pedido.",
    conta:
      "Conta quantos posts saíram na última semana e quantos pedidos vieram deles. Se não der pra ligar um ao outro, é aí que o esforço está sumindo.",
  },
  {
    id: "onde",
    nome: "Onde você vai",
    explicacao:
      "Sem o número do azul, o mês inteiro vira aposta e fechar no vermelho vira surpresa.",
    conta:
      "Soma tudo que sai por mês (custo fixo, material, taxas, o quanto você precisa tirar pra viver). Esse é o número que precisa entrar pra fechar no azul.",
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

/** Textos exatos do PRD-quiz.md §5. Não reescrever sem atualizar o PRD. */
export const PERGUNTAS: PerguntaQuiz[] = [
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
    id: "q2",
    territorio: "vende",
    enunciado: "Qual produto seu deixa mais dinheiro no fim do mês? (não o que mais vende)",
    alternativas: alternativas("Sei qual é.", "Acho que sei.", "Nunca fiz essa conta."),
  },
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
 *  pessoa leu na tela. Alterou a frase aqui, os leads novos guardam a nova. */
export const CONSENT_TEXTO =
  "Aceito receber meu diagnóstico e conteúdos da Pólia por e-mail. Sem spam, e você sai quando quiser.";
