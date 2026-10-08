// Partes puras do raio-x que a tela e o servidor dividem (QA-30, 07/10/2026).
// Fica fora de raiox.functions.ts pra a tela não importar nada de servidor.
import { temProjete } from "@/lib/planos";

/** Teto único de gerações de raio-x por mês do calendário (ia_uso). */
export const LIMITE_RAIOX_MENSAL = 3;

/** Pro e beta (acesso total) geram raio-x; o resto não. */
export function planoGeraRaioX(plano: string | null | undefined): boolean {
  return temProjete(plano);
}

// ── Limite visível (07/10/2026, pedido da Sil) ─────────────────────────────
// A contagem é por mês do calendário em Brasília (ia_uso.periodo "AAAA-MM"),
// o mesmo período que gerarRaioX usa pra cobrar. O texto usa o período que o
// servidor devolve, não o relógio do navegador.

const NOMES_DOS_MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function anoMesDoPeriodo(periodo: string): { ano: number; mes: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return { ano, mes };
}

/** Quantas gerações ainda cabem no mês. Nunca negativo, nunca acima do limite. */
export function restantesRaioX(usado: number, limite: number = LIMITE_RAIOX_MENSAL): number {
  const u = Number.isFinite(usado) ? Math.max(0, Math.floor(usado)) : 0;
  return Math.max(0, Math.min(limite, limite - u));
}

/** Nome do mês do período ("2026-10" vira "outubro"). */
export function nomeDoMesDoPeriodo(periodo: string): string | null {
  const am = anoMesDoPeriodo(periodo);
  return am ? NOMES_DOS_MESES[am.mes - 1] : null;
}

/** Dia em que a contagem zera: "1º de novembro" (dezembro vira "1º de janeiro"). */
export function quandoLiberaRaioX(periodo: string): string | null {
  const am = anoMesDoPeriodo(periodo);
  if (!am) return null;
  const proximo = am.mes === 12 ? 1 : am.mes + 1;
  return `1º de ${NOMES_DOS_MESES[proximo - 1]}`;
}

/** "Restam 2 de 3 gerações do raio-x em outubro." */
export function textoRestantesRaioX(
  restantes: number,
  periodo: string,
  limite: number = LIMITE_RAIOX_MENSAL,
): string {
  const nome = nomeDoMesDoPeriodo(periodo);
  const quando = nome ? ` em ${nome}` : " neste mês";
  if (restantes <= 0) return textoLimiteAtingidoRaioX(periodo, limite);
  const verbo = restantes === 1 ? "Resta" : "Restam";
  return `${verbo} ${restantes} de ${limite} gerações do raio-x${quando}.`;
}

/** Aviso antes de gastar a última geração do mês. */
export function textoUltimaGeracaoRaioX(periodo: string): string {
  const quando = quandoLiberaRaioX(periodo);
  return quando
    ? `Essa é a última geração do raio-x deste mês. A próxima libera em ${quando}.`
    : "Essa é a última geração do raio-x deste mês. A próxima libera no dia 1º do mês que vem.";
}

/** Frase do botão desabilitado quando o limite do mês acabou. */
export function textoLimiteAtingidoRaioX(
  periodo: string,
  limite: number = LIMITE_RAIOX_MENSAL,
): string {
  const nome = nomeDoMesDoPeriodo(periodo);
  const quando = quandoLiberaRaioX(periodo);
  const deQuando = nome ? ` de ${nome}` : " deste mês";
  const libera = quando ? `em ${quando}` : "no dia 1º do mês que vem";
  return `As ${limite} gerações do raio-x${deQuando} já foram usadas. A próxima libera ${libera}.`;
}

export type MotivoRaioX =
  | "manutencao"
  | "teto_atingido"
  | "falha_ia"
  | "dado_insuficiente"
  | "mes_nao_fechado"
  | "plano_insuficiente";

/**
 * Texto curto pra quando o pedido de raio-x volta recusado e já existe um
 * raio-x na tela. Antes o motivo era guardado e nunca mostrado nesse caso, e
 * "Gerar outro" parecia não fazer nada.
 */
export function avisoDoMotivoRaioX(motivo: MotivoRaioX): string {
  switch (motivo) {
    case "teto_atingido":
      return `As ${LIMITE_RAIOX_MENSAL} gerações de raio-x deste mês já foram usadas. Renovam no dia 1º, e os raio-x já gerados continuam aqui pra reler.`;
    case "dado_insuficiente":
      return "Esse mês tem pouco registrado pra uma leitura nova. O raio-x anterior continua aqui.";
    case "mes_nao_fechado":
      return "O mês ainda está correndo. Tenta de novo pra ler o que tem até aqui.";
    case "manutencao":
      return "O raio-x está em manutenção agora. Tenta de novo mais tarde, este continua aqui.";
    case "plano_insuficiente":
      return "A Pólia One não encontrou o plano Pro ativo nesta conta, então não gerou outro raio-x.";
    case "falha_ia":
      return "A Pólia One não conseguiu ler o seu mês agora. Tenta de novo.";
  }
}
