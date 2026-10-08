// Mensagens da cota de IA por plano (05/10/2026). Antes a tela mandava
// "assine o Premium" pra todo mundo, inclusive pra quem já é Pro.
// Planejamento: os tetos vêm de configDoPlano (planejamentoIa.functions.ts),
// Grátis 1, Premium 30, Pro 60 por mês.
// Assistente: teto DIÁRIO, fonte única em LIMITE_DIARIO_ASSISTENTE abaixo
// (aimer.functions.ts lê daqui).

export interface AvisoCotaIa {
  texto: string;
  upgrade?: { tier: "controle" | "projete"; rotulo: string };
}

/**
 * Em que degrau o plano está pra fins de oferta. `cancelada` e valor
 * desconhecido contam como Grátis (é o acesso que sobra pra elas); `beta` é
 * acesso total, igual ao Pro.
 */
function degrauDoPlano(plano: string | null | undefined): "gratis" | "premium" | "pro" {
  if (plano === "projete" || plano === "beta") return "pro";
  if (plano === "controle") return "premium";
  return "gratis";
}

export function avisoCotaEsgotada(plano: string | null | undefined): AvisoCotaIa {
  const degrau = degrauDoPlano(plano);
  if (degrau === "gratis") {
    return {
      texto: "O plano Grátis tem 1 uso de IA por mês, e ele já foi. No Premium são 30, no Pro, 60.",
      upgrade: { tier: "controle", rotulo: "Conhecer o Premium" },
    };
  }
  if (degrau === "premium") {
    return {
      texto: "Os 30 usos de IA do Premium deste mês já foram. No Pro são 60 por mês.",
      upgrade: { tier: "projete", rotulo: "Conhecer o Pro" },
    };
  }
  return { texto: "Os usos de IA deste mês já foram. O limite renova no dia 1º do próximo mês." };
}

/** Perguntas por dia no Assistente, por chave de plano. */
export const LIMITE_DIARIO_ASSISTENTE = {
  confere: 5,
  controle: 30,
  projete: 100,
  beta: 100,
} as const;

/**
 * Teto diário do Assistente. Antes a mensagem era uma só ("ou o Premium libera
 * bem mais") e oferecia o Premium até pra quem já era Premium, Pro ou beta.
 */
export function avisoTetoAssistente(plano: string | null | undefined): AvisoCotaIa {
  const degrau = degrauDoPlano(plano);
  if (degrau === "gratis") {
    return {
      texto: `As ${LIMITE_DIARIO_ASSISTENTE.confere} perguntas de hoje já foram. O limite do dia volta amanhã. No Premium são ${LIMITE_DIARIO_ASSISTENTE.controle} por dia.`,
      upgrade: { tier: "controle", rotulo: "Conhecer o Premium" },
    };
  }
  if (degrau === "premium") {
    return {
      texto: `As ${LIMITE_DIARIO_ASSISTENTE.controle} perguntas de hoje já foram. O limite do dia volta amanhã. No Pro são ${LIMITE_DIARIO_ASSISTENTE.projete} por dia.`,
      upgrade: { tier: "projete", rotulo: "Conhecer o Pro" },
    };
  }
  return { texto: "As perguntas de hoje já foram. O limite do dia volta amanhã." };
}

/** Perto do limite: sobra 20% ou menos (e pelo menos 1 uso já foi). */
export function pertoDoLimite(usado: number, limite: number): boolean {
  if (limite <= 0) return false;
  const restam = limite - usado;
  return usado > 0 && restam > 0 && restam <= Math.max(1, Math.floor(limite * 0.2));
}
