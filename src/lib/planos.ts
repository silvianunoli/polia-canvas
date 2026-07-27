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

// Fase 3 (não implementado ainda): 1 geração de IA por mês no Confere.
// Registrado aqui só como constante de documentação — o contador real
// (tabela + trigger server-side) entra junto com a feature de IA, que
// precisa de PRD próprio. Construir o contador agora seria código morto.
export const IA_GERACAO_CONFERE_POR_MES = 1;

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
      "Produtos, com a margem de cada venda na sua frente",
      "Clientes, com a entrega que vira caixa sozinha",
      "Financeiro do mês fechado num lugar",
      "Painel completo, com quanto falta pra meta",
      "Planner, Calendário, Caderno e Metas",
    ],
    destaque: true,
  },
  projete: {
    titulo: "Projete",
    precoMensal: 47.9,
    precoAnual: 479,
    features: [
      "Tudo do Controle, mais:",
      "Resumo do mês pro contador, em PDF e CSV",
      "Um plano de conteúdo do ano pras suas redes",
    ],
  },
};
