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

// "tutorial" = convite do tutorial narrado no primeiro acesso (ver lib/tutorial.ts).
export type ChaveDica = "tour" | "tutorial" | ChaveDicaTela;

export interface PassoTour {
  /** Valor do `data-tour` do elemento que o balão aponta. */
  alvo: string;
  /** Lado do alvo em que o balão abre (quando o alvo está visível). */
  lado: "right" | "bottom" | "top";
  titulo: string;
  texto: string;
}

export const PASSOS_TOUR: PassoTour[] = [
  {
    alvo: "planejamento",
    lado: "right",
    titulo: "Começa por aqui",
    texto:
      "O Planejamento é o documento vivo da sua marca. Cada resposta vira preço, meta e conta do mês nas outras telas.",
  },
  {
    alvo: "aimer",
    lado: "top",
    titulo: "Deu branco? Chama o Assistente",
    texto:
      "Esse balão abre o Assistente, em qualquer tela. Ele tira dúvida sobre o negócio e sobre como usar a Pólia One.",
  },
  {
    alvo: "acao-principal",
    lado: "bottom",
    titulo: "O próximo passo fica sempre aqui",
    texto:
      "O Painel mostra o que faz sentido fazer agora. Conforme o Planejamento anda, os números da marca aparecem nesta tela.",
  },
];

// Cada texto foi conferido contra o que a tela faz de verdade (05/10/2026).
// Mexeu na tela, confere a dica: ela não pode prometer o que a tela não faz.
export const TEXTO_DICA: Record<ChaveDicaTela, string> = {
  produtos:
    "Cada produto guarda preço e custo. É daqui que a Pólia One tira quanto sobra por venda.",
  calculadora:
    "Entram os custos reais da marca e sai o preço que se paga. Sem copiar o preço da concorrente.",
  projecao:
    "E se o preço subir? E se o custo cair? Os cenários mostram quantas vendas faltam pra empatar, se pagar e bater a meta do mês.",
  financeiro:
    "Entrou, saiu, anota aqui. Com isso o mês mostra quanto sobrou e quanto falta pra meta.",
  raiox:
    "Mês fechado, o Raio-x lê entradas, saídas, meta e produtos e mostra o que puxou o resultado.",
  clientes: "Cada cliente com contato, pedido e status da entrega, tudo num lugar só.",
  metas: "Uma meta com número e, se quiser, prazo. O progresso de cada uma fica à vista aqui.",
  caderno:
    "Ideia solta, anotação de reunião, aquele insight que chega no banho. Tem lugar pra isso aqui.",
  planner: "Um quadro pra cada projeto, pra lançamento e campanha não morarem só na cabeça.",
  "plano-conteudo":
    "Escolhe o tipo do seu negócio e a Pólia One sugere um post por dia, com o post do dia em destaque.",
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
