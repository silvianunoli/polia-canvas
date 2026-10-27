// Tour de boas-vindas + dicas de primeira visita (05/10/2026, aprovado pela Sil).
//
// O que a usuária já viu mora em `profiles.dicas_vistas` (text[]), não no
// localStorage: assim o tour não volta quando ela entra por outro aparelho.
// Os textos ficam todos aqui pra revisão de copy acontecer num lugar só.

export type ChaveDicaTela =
  | "produtos"
  | "calculadora"
  | "projecao"
  | "financeiro"
  | "raiox"
  | "clientes"
  | "metas"
  | "caderno"
  | "planner"
  | "plano-conteudo"
  | "calendario";

// "tutorial" = convite antigo do tutorial narrado (saiu do primeiro acesso em
// 11/10/2026, ONE-112); a chave segue aceita porque já está gravada em contas.
// "boas-vindas" = modal curto do primeiro acesso ao Painel, antes do balão.
// "dica-completar", "dica-salvou" e "dica-assistente" = dicas de uma vez só
// dentro do módulo do Planejamento, cada uma na hora em que a dúvida aparece.
export type ChaveDica =
  | "tour"
  | "tutorial"
  | "boas-vindas"
  | "dica-completar"
  | "dica-salvou"
  | "dica-assistente"
  | ChaveDicaTela;

export interface PassoTour {
  /** Valor do `data-tour` do elemento que o balão aponta. */
  alvo: string;
  /** Lado do alvo em que o balão abre (quando o alvo está visível). */
  lado: "right" | "bottom" | "top";
  titulo: string;
  texto: string;
  /** Texto quando o alvo não está na tela (no celular o menu fica fechado). */
  textoSemAlvo?: string;
}

// Onboarding guiado pelo Planejamento (11/10/2026, ONE-112, aprovado pela Sil):
// um balão só, sem "Próximo". Ele avança quando ela clica no item apontado,
// que leva direto pro Módulo 1. Os balões do Assistente e da ação principal
// saíram: o Assistente ganha dica própria dentro do módulo e a ação principal
// do Painel passou a apontar pro Planejamento até o Módulo 4.
export const PASSOS_TOUR: PassoTour[] = [
  {
    alvo: "planejamento",
    lado: "right",
    titulo: "Começa por aqui",
    texto: "O Módulo 1 tem 5 seções curtas. Clica em Planejamento pra abrir a primeira.",
    textoSemAlvo:
      "O Módulo 1 tem 5 seções curtas. O Planejamento fica no menu, e o botão abaixo já abre a primeira.",
  },
];

/** Modal do primeiro acesso ao Painel: o ciclo da Pólia One em três linhas. */
export const BOAS_VINDAS = {
  titulo: "Assim a Pólia One funciona",
  ciclo: [
    "No Planejamento, a marca conta quem ela é, pra quem vende e quanto custa.",
    "A Pólia One organiza cada módulo em documento e ferramenta prontos.",
    "O Painel acende com os números da marca conforme os módulos fecham.",
  ],
  acao: "Quero começar pelo Módulo 1",
  secundaria: "Ver o tutorial completo depois",
} as const;

/** Dicas de uma vez só dentro do módulo do Planejamento. */
export const TEXTO_DICA_PLANEJAMENTO = {
  completar:
    "Travou depois das primeiras palavras? Esse botão completa a partir do que já está no campo.",
  salvou: "Salvou sozinho. Fechou a aba, a resposta fica.",
  assistente: "Travou na pergunta? O Assistente, aqui no canto, ajuda a pensar a resposta.",
} as const;

// Cada texto foi conferido contra o que a tela faz de verdade (05/10/2026).
// Mexeu na tela, confere a dica: ela não pode prometer o que a tela não faz.
export const TEXTO_DICA: Record<ChaveDicaTela, string> = {
  produtos:
    "Cada produto guarda preço e custo. É daqui que a Pólia One tira quanto a marca lucra por venda.",
  calculadora:
    "Entram os custos reais da marca e sai o preço que se paga. Sem copiar o preço da concorrente.",
  projecao:
    "E se o preço subir? E se o custo cair? Os cenários mostram quantas vendas faltam pra empatar, se pagar e bater a meta do mês.",
  financeiro:
    "Entrou, saiu, anota aqui. Com isso o mês mostra quanto lucrou e quanto falta pra meta.",
  raiox:
    "Mês fechado, o Raio-x lê entradas, saídas, meta e produtos e mostra o que puxou o resultado.",
  clientes: "Cada cliente com contato, pedido e status da entrega, tudo num lugar só.",
  metas: "Uma meta com número e, se quiser, prazo. O progresso de cada uma fica à vista aqui.",
  caderno:
    "Ideia solta, anotação de reunião, aquele insight que chega no banho. Tem lugar pra isso aqui.",
  planner: "Um quadro pra cada projeto, pra lançamento e campanha não morarem só na cabeça.",
  "plano-conteudo":
    "Escolhe o tipo do seu negócio e a Pólia One espalha 60 ideias do seu nicho pelo ano, uma por dia, com a do dia em destaque.",
  calendario: "Prazos das tarefas e compromissos do Google Calendar, o mês inteiro numa tela só.",
};

/** Lista com a chave marcada como vista, sem duplicar. */
export function marcarVista(vistas: readonly string[], chave: ChaveDica): string[] {
  return vistas.includes(chave) ? [...vistas] : [...vistas, chave];
}

/** Lista sem a chave, pra "Rever o tour". */
export function esquecerVista(vistas: readonly string[], chave: ChaveDica): string[] {
  return vistas.filter((v) => v !== chave);
}

/**
 * Mostrar só quando a lista chegou do banco e não tem a chave. Enquanto
 * carrega, ou se a leitura falhou, NÃO mostra: melhor perder uma dica do que
 * piscar o tour toda vez pra quem já viu.
 */
export function deveMostrar(vistas: readonly string[] | undefined, chave: ChaveDica): boolean {
  return vistas !== undefined && !vistas.includes(chave);
}
