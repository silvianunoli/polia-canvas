// Teste de 7 dias do Pro (GRW-66, 20/10/2026). A conta nova nasce com
// profiles.plano = 'projete' e uma linha em `testes_pro`; o cron
// encerrar_testes_pro() devolve pro Grátis quem não assinou até `fim`.
// Aqui mora só a regra de tela (está em teste? quantos dias faltam? que texto?).

export interface TestePro {
  inicio: string;
  fim: string;
  encerradoEm: string | null;
  resultado: "voltou_gratis" | "assinou" | null;
  /** Quando ganhou os 7 dias por completar os primeiros passos (ONE-136). */
  bonusPassosEm: string | null;
  /** "cadastro" (conta nova) ou "reativacao" (conta antiga liberada em 21/10). */
  origem?: string | null;
}

/** Dias que completar os primeiros passos soma no teste (resgatar_bonus_primeiros_passos). */
export const DIAS_BONUS_PASSOS = 7;

/**
 * Ainda dá pra ganhar o bônus: conta nova (decisão da Sil, 24/10/2026: a de
 * reativação não vê o convite), teste aberto e bônus não usado.
 */
export function podeGanharBonus(t: TestePro | null, agora: number = Date.now()): boolean {
  return testeAberto(t, agora) && t!.origem === "cadastro" && !t!.bonusPassosEm;
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** Teste aberto: ainda não venceu e o cron não fechou. */
export function testeAberto(t: TestePro | null, agora: number = Date.now()): boolean {
  if (!t || t.encerradoEm) return false;
  const fim = Date.parse(t.fim);
  return Number.isFinite(fim) && fim > agora;
}

/**
 * Dias que faltam, arredondando pra cima: com 5 dias e 1 hora faltam 6.
 * No último dia (menos de 24h) devolve 1. Teste fechado ou vencido devolve 0.
 */
export function diasRestantes(t: TestePro | null, agora: number = Date.now()): number {
  if (!testeAberto(t, agora)) return 0;
  return Math.max(1, Math.ceil((Date.parse(t!.fim) - agora) / DIA_MS));
}

/** Voltou pro Grátis há menos de `dias` dias: a faixa ainda lembra o que fechou. */
export function testeAcabouHaPouco(
  t: TestePro | null,
  agora: number = Date.now(),
  dias = 3,
): boolean {
  if (!t || t.resultado !== "voltou_gratis" || !t.encerradoEm) return false;
  const quando = Date.parse(t.encerradoEm);
  return Number.isFinite(quando) && agora - quando < dias * DIA_MS;
}

export interface TextoFaixaTeste {
  texto: string;
  cta: string;
  /** Últimos 2 dias: a faixa ganha mais peso visual. */
  urgente: boolean;
}

export function textoFaixaTeste(
  t: TestePro | null,
  agora: number = Date.now(),
): TextoFaixaTeste | null {
  if (testeAberto(t, agora)) {
    const dias = diasRestantes(t, agora);
    const quando = dias === 1 ? "Último dia" : `Faltam ${dias} dias`;
    // Sem dizer por quê, "Faltam 9" depois de "Faltam 2" parecia erro.
    const bonus = t!.bonusPassosEm
      ? `, já com os ${DIAS_BONUS_PASSOS} dias dos primeiros passos`
      : "";
    return {
      texto: `${quando} do teste do Pro${bonus}. Depois a conta volta pro Grátis, e o que a marca guardou aqui continua guardado.`,
      cta: "Quero assinar",
      urgente: dias <= 2,
    };
  }
  if (testeAcabouHaPouco(t, agora)) {
    return {
      texto:
        "O teste do Pro terminou e a conta voltou pro Grátis. Raio-x, Projeção e Plano de conteúdo continuam guardados, só fechados.",
      cta: "Quero o Pro de volta",
      urgente: false,
    };
  }
  return null;
}

/** Linha crua de `testes_pro` vira TestePro (null se não há linha). */
export function testeDoBanco(row: unknown): TestePro | null {
  const r = row as {
    inicio?: string;
    fim?: string;
    encerrado_em?: string | null;
    resultado?: string | null;
    bonus_passos_em?: string | null;
    origem?: string | null;
  } | null;
  if (!r?.fim || !r.inicio) return null;
  return {
    inicio: r.inicio,
    fim: r.fim,
    encerradoEm: r.encerrado_em ?? null,
    resultado: r.resultado === "voltou_gratis" || r.resultado === "assinou" ? r.resultado : null,
    bonusPassosEm: r.bonus_passos_em ?? null,
    origem: r.origem ?? null,
  };
}
