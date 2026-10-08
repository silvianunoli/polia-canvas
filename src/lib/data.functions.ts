/** AAAA-MM-DD de um instante no fuso LOCAL do navegador (nunca o dia UTC). */
export function dataISOLocal(d: Date): string {
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
}

export function hojeISO(): string {
  return dataISOLocal(new Date());
}

/**
 * Dia LOCAL de uma data vinda de fora (ex.: evento do Google Calendar).
 * "AAAA-MM-DD" puro é dia de calendário (evento de dia inteiro) e volta igual:
 * passar por `new Date()` leria como meia-noite UTC e cairia no dia anterior.
 * Data com hora (com fuso ou "Z") vira o dia no fuso do navegador, o mesmo
 * fuso em que a tela mostra o horário.
 */
export function diaLocalDe(isoOuDia: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOuDia)) return isoOuDia;
  return dataISOLocal(new Date(isoOuDia));
}

export function mesAnoDe(iso: string): { ano: number; mes: number } {
  const [ano, mes] = iso.split("-").map(Number);
  return { ano, mes };
}

export function mesAnoAtual(): { ano: number; mes: number } {
  return mesAnoDe(hojeISO());
}

export function ehMesAtual(iso: string): boolean {
  const { ano, mes } = mesAnoAtual();
  const alvo = mesAnoDe(iso);
  return alvo.ano === ano && alvo.mes === mes;
}

// ── Servidor (07/10/2026) ──────────────────────────────────────────────────
// O Worker roda em UTC: `new Date().toISOString().slice(0, 10)` e
// `getUTCMonth()` viram o dia e o mês às 21h de Brasília. No servidor não
// existe o fuso do navegador, então o "hoje" da usuária é calculado no fuso
// de Brasília, explícito. Brasil sem horário de verão desde 2019, mas o Intl
// cuidaria disso se voltasse.

export const FUSO_BRASILIA = "America/Sao_Paulo";

const formatoDiaBrasilia = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_BRASILIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** AAAA-MM-DD do instante no horário de Brasília. Use no servidor. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  const partes = formatoDiaBrasilia.formatToParts(agora);
  const pega = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? "";
  return `${pega("year")}-${pega("month")}-${pega("day")}`;
}

/** AAAA-MM do instante no horário de Brasília (período mensal de cota). */
export function mesEmBrasilia(agora: Date = new Date()): string {
  return hojeEmBrasilia(agora).slice(0, 7);
}

/** Ano e mês numéricos no horário de Brasília. */
export function mesAnoEmBrasilia(agora: Date = new Date()): { ano: number; mes: number } {
  return mesAnoDe(hojeEmBrasilia(agora));
}
