// Fonte única do mapa de planos (Confere/Controle/Projete). Fase 1: gating de
// rota + cotas, sem IA e sem separar Controle de Projete tecnicamente ainda
// (ambos mapeiam pro tier "controle" até a Fase 2/3 definirem o exclusivo do
// Projete).

export type Plano = "beta" | "confere" | "controle" | "projete" | "cancelada";
export type Tier = "confere" | "controle";
export type TierPago = "controle" | "projete";

// beta = acesso total, tratado à parte (nunca passa pelo tier system).
// controle/projete = tier "controle" (Fase 1: idênticos em acesso).
// confere/cancelada/valor desconhecido = tier "confere" (nunca bloqueia tudo).
export function ehBeta(plano: string | null | undefined): boolean {
  return plano === "beta";
}

export function tierDoPlano(plano: string | null | undefined): Tier {
  if (plano === "controle" || plano === "projete") return "controle";
  return "confere";
}

/**
 * Direito às features exclusivas do Projete. Existe porque o tier system só tem
 * dois níveis (confere/controle) e o Projete mora dentro do "controle" — a
 * pergunta "tem Projete?" não é respondível por `tierDoPlano`.
 *
 * Inclui `beta`, que é acesso total: a checagem `plano === "projete"` estava
 * copiada em seis arquivos e reprovava conta beta em todos eles.
 */
export function temProjete(plano: string | null | undefined): boolean {
  return ehBeta(plano) || plano === "projete";
}

// Rotas que abrem só no Projete. Elas passam pelo guard de tier (são "controle")
// e são barradas por um portão dentro da própria página. Sem esta lista, a barra
// lateral não tem como saber que são pagas e mostra três itens SEM cadeado que a
// usuária do Controle não consegue usar.
const ROTAS_PROJETE = ["/raiox", "/plano-conteudo", "/projecao"];

export function ehRotaProjete(pathname: string): boolean {
  return ROTAS_PROJETE.some((p) => bateRota(p, pathname));
}

/** Qual plano pago a rota exige — pra nomear o certo na tela de upgrade. */
export function tierPagoDaRota(pathname: string): TierPago {
  return ehRotaProjete(pathname) ? "projete" : "controle";
}

/**
 * Direito de USO da tela, não só de entrar nela: soma a trava de rota (tier) com
 * o portão Projete de dentro da página. É o que a navegação deve consultar pra
 * decidir se mostra cadeado — `rotaLiberada` sozinha diz que /raiox está livre
 * pro Controle, o que é verdade pro roteador e mentira pra usuária.
 */
export function recursoLiberado(pathname: string, plano: string | null | undefined): boolean {
  if (!rotaLiberada(pathname, plano)) return false;
  if (ehRotaProjete(pathname)) return temProjete(plano);
  return true;
}

// Tier mínimo por prefixo de rota. Não listado = "controle" por padrão (nega
// por padrão). Onboarding e Assinar ficam de fora — são isentos por completo,
// tratados em _authenticated.tsx, não aqui.
const ROTAS_TIER: { prefixo: string; tier: Tier }[] = [
  { prefixo: "/painel", tier: "confere" },
  { prefixo: "/configuracoes", tier: "confere" },
  { prefixo: "/chamados", tier: "confere" },
  { prefixo: "/planejamento", tier: "confere" },
  { prefixo: "/aimer", tier: "confere" }, // todo plano abre o chat; teto diário e modo data-aware são no servidor
  { prefixo: "/produtos", tier: "confere" }, // cotada, ver COTAS_CONFERE
  { prefixo: "/planner", tier: "confere" }, // cotada
  { prefixo: "/caderno", tier: "confere" }, // cotada
  { prefixo: "/raiox", tier: "controle" }, // Projete-only por dentro, mesmo padrão do Resumo/Encomenda
  { prefixo: "/plano-conteudo", tier: "controle" }, // Projete-only por dentro, mesmo padrão do Raio-x
  { prefixo: "/projecao", tier: "controle" }, // Projete-only por dentro, mesmo padrão do Raio-x
  { prefixo: "/clientes", tier: "controle" },
  { prefixo: "/financeiro", tier: "controle" },
  { prefixo: "/metas", tier: "controle" },
  { prefixo: "/calendario", tier: "controle" },
  { prefixo: "/mercado", tier: "controle" },
];

function bateRota(prefixo: string, pathname: string): boolean {
  return pathname === prefixo || pathname.startsWith(prefixo + "/");
}

export function tierMinimoDaRota(pathname: string): Tier {
  const encontrada = ROTAS_TIER.find((r) => bateRota(r.prefixo, pathname));
  return encontrada?.tier ?? "controle";
}

export function rotaLiberada(pathname: string, plano: string | null | undefined): boolean {
  if (ehBeta(plano)) return true;
  const tierUsuaria = tierDoPlano(plano);
  const tierNecessario = tierMinimoDaRota(pathname);
  if (tierNecessario === "confere") return true;
  return tierUsuaria === "controle";
}

export const COTAS_CONFERE = {
  produtos: 5,
  planner: 1,
  caderno: 1,
} as const;

// A cota de geração por IA NÃO mora aqui. Fonte única: CONFIG_POR_PLANO em
// src/lib/planejamentoIa.functions.ts (Confere 1/mês, Controle 30, Projete 60),
// contada na tabela `ia_geracoes` no servidor. A constante de documentação que
// existia neste ponto dizia que a feature não estava implementada, o que deixou
// de ser verdade em 14/08/2026, e duplicava o teto do plano gratuito em dois
// lugares que podiam divergir em silêncio.

// Preço e o que cada plano pago abre — mesmo conteúdo usado no checkout
// (src/routes/_authenticated/assinar.tsx) e na tela de upgrade
// (src/routes/_authenticated/upgrade.tsx), pra não duplicar em dois lugares.
export const TIERS_PAGOS: Record<
  TierPago,
  {
    titulo: string;
    precoMensal: number;
    precoAnual: number;
    features: string[];
    destaque?: boolean;
  }
> = {
  controle: {
    titulo: "Controle",
    precoMensal: 29.9,
    precoAnual: 299,
    features: [
      "Tudo do Confere, mais:",
      "Calculadora de preço sem limite de produtos: quanto sobra em cada venda, antes de cobrar",
      "Financeiro com os três números que decidem o mês: o mínimo pra fechar as contas, o mês bom e o mês de celebrar",
      "Clientes com o status de cada pedido, do orçamento à entrega",
      "Quadros ilimitados no Planner",
    ],
    destaque: true,
  },
  projete: {
    titulo: "Projete",
    precoMensal: 47.9,
    precoAnual: 479,
    features: [
      "Tudo do Controle, mais:",
      "Raio-x do mês: a leitura do que aconteceu e o que muda no mês que vem",
      "Projeção: quantas vendas faltam pra empatar, pra se pagar e pra bater a meta",
      "Plano de conteúdo do ano: uma ideia de post por dia, ligada ao que a marca vende",
      "Resumo do mês pro contador, em PDF e CSV",
    ],
  },
};
