// Mensagens da cota de IA do Planejamento por plano (05/10/2026). Antes a tela
// mandava "assine o Premium" pra todo mundo, inclusive pra quem já é Pro.
// Os tetos vêm de configDoPlano (planejamentoIa.functions.ts): Grátis 1,
// Premium 30, Pro 60 por mês.

export interface AvisoCotaIa {
  texto: string;
  upgrade?: { tier: "controle" | "projete"; rotulo: string };
}

export function avisoCotaEsgotada(plano: string): AvisoCotaIa {
  if (plano === "confere") {
    return {
      texto: "O plano Grátis tem 1 uso de IA por mês, e ele já foi. No Premium são 30, no Pro, 60.",
      upgrade: { tier: "controle", rotulo: "Conhecer o Premium" },
    };
  }
  if (plano === "controle") {
    return {
      texto: "Os 30 usos de IA do Premium deste mês já foram. No Pro são 60 por mês.",
      upgrade: { tier: "projete", rotulo: "Conhecer o Pro" },
    };
  }
  return { texto: "Os usos de IA deste mês já foram. O limite renova no dia 1º do próximo mês." };
}

/** Perto do limite: sobra 20% ou menos (e pelo menos 1 uso já foi). */
export function pertoDoLimite(usado: number, limite: number): boolean {
  if (limite <= 0) return false;
  const restam = limite - usado;
  return usado > 0 && restam > 0 && restam <= Math.max(1, Math.floor(limite * 0.2));
}
