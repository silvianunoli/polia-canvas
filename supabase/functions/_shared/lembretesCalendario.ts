import { emailPolia, escapeHtml } from "./email-polia.ts";
import type { Aviso } from "./fcm.ts";

// Lembretes do Calendário (ONE-244, 24/11/2026, pedido da Sil: "posso colocar o
// dia de enviar o relatório pra contabilidade e isso gerar lembretes por e-mail
// e push"). Puro: datas e texto, sem rede nem banco. O app (Calendário) e a edge
// function lembretes-calendario importam daqui, então a regra de repetição é uma
// só nos dois lados. Teste em src/lib/lembretesCalendario.test.ts.
//
// Regras:
// - Repetição: nenhuma, toda semana (mesmo dia da semana), todo mês (mesmo dia
//   do mês; dia 31 cai no último dia dos meses mais curtos) e todo ano (29/02
//   cai em 28/02 nos anos comuns). A primeira ocorrência é o `dia`.
// - Aviso: sai às 8h de Brasília, no dia da ocorrência ou 1, 3 ou 7 dias antes.
//   Null = sem aviso. Ocorrência marcada como feita não avisa.
//
// Voz: aviso de produto, a Pólia é o sujeito, sem exclamação e sem piada.

export type Repeticao = "nenhuma" | "semanal" | "mensal" | "anual";
export const REPETICOES: Repeticao[] = ["nenhuma", "semanal", "mensal", "anual"];

export const ANTECEDENCIAS = [0, 1, 3, 7] as const;
export type Antecedencia = (typeof ANTECEDENCIAS)[number];

export interface Lembrete {
  id: string;
  titulo: string;
  observacao: string | null;
  /** Primeira ocorrência, AAAA-MM-DD. */
  dia: string;
  /** "09:00" ou null. Só aparece na tela e no aviso; não muda a hora do aviso. */
  horario: string | null;
  repeticao: Repeticao;
  avisar_dias_antes: Antecedencia | null;
  /** Ocorrências marcadas como feitas, AAAA-MM-DD. */
  feitos: string[];
}

export function ehRepeticao(v: unknown): v is Repeticao {
  return typeof v === "string" && (REPETICOES as string[]).includes(v);
}

export function ehAntecedencia(v: unknown): v is Antecedencia {
  return typeof v === "number" && (ANTECEDENCIAS as readonly number[]).includes(v);
}

// ── datas (AAAA-MM-DD, sempre em UTC pra não pular com fuso) ──────────────────

function partes(iso: string): [number, number, number] {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return [a, m, d];
}

export function somaDiasISO(iso: string, dias: number): string {
  const [a, m, d] = partes(iso);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

function diasEntre(deISO: string, ateISO: string): number {
  const [a1, m1, d1] = partes(deISO);
  const [a2, m2, d2] = partes(ateISO);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** O lembrete cai neste dia? */
export function ocorreEm(l: Pick<Lembrete, "dia" | "repeticao">, dia: string): boolean {
  const inicio = l.dia.slice(0, 10);
  if (dia < inicio) return false;
  if (dia === inicio) return true;
  const [, mi, di] = partes(inicio);
  const [a, m, d] = partes(dia);
  switch (l.repeticao) {
    case "semanal":
      return diasEntre(inicio, dia) % 7 === 0;
    case "mensal":
      return d === Math.min(di, ultimoDiaDoMes(a, m));
    case "anual":
      return m === mi && d === Math.min(di, ultimoDiaDoMes(a, m));
    default:
      return false;
  }
}

/** Dias do intervalo [inicio, fim] em que o lembrete cai. */
export function ocorrenciasNoIntervalo(
  l: Pick<Lembrete, "dia" | "repeticao">,
  inicio: string,
  fim: string,
): string[] {
  const dias: string[] = [];
  const primeiro = l.dia.slice(0, 10) > inicio ? l.dia.slice(0, 10) : inicio;
  if (l.repeticao === "nenhuma")
    return primeiro === l.dia.slice(0, 10) && primeiro <= fim ? [primeiro] : [];
  for (let dia = primeiro; dia <= fim; dia = somaDiasISO(dia, 1)) {
    if (ocorreEm(l, dia)) dias.push(dia);
  }
  return dias;
}

// ── aviso ─────────────────────────────────────────────────────────────────────

export interface AvisoDoDia {
  lembrete: Lembrete;
  /** O dia do compromisso, AAAA-MM-DD. */
  ocorrencia: string;
}

/** Lembretes que avisam hoje: a ocorrência cai `avisar_dias_antes` dias depois. */
export function avisosDoDia(lembretes: Lembrete[], hoje: string): AvisoDoDia[] {
  const avisos: AvisoDoDia[] = [];
  for (const l of lembretes) {
    if (l.avisar_dias_antes === null) continue;
    const ocorrencia = somaDiasISO(hoje, l.avisar_dias_antes);
    if (!ocorreEm(l, ocorrencia)) continue;
    if (l.feitos.some((f) => f.slice(0, 10) === ocorrencia)) continue;
    avisos.push({ lembrete: l, ocorrencia });
  }
  return avisos.sort((a, b) =>
    a.ocorrencia === b.ocorrencia
      ? (a.lembrete.horario ?? "").localeCompare(b.lembrete.horario ?? "")
      : a.ocorrencia.localeCompare(b.ocorrencia),
  );
}

export const ROTULO_ANTECEDENCIA: Record<Antecedencia, string> = {
  0: "No dia, às 8h",
  1: "1 dia antes, às 8h",
  3: "3 dias antes, às 8h",
  7: "1 semana antes, às 8h",
};

export const ROTULO_REPETICAO: Record<Repeticao, string> = {
  nenhuma: "Não repete",
  semanal: "Toda semana",
  mensal: "Todo mês",
  anual: "Todo ano",
};

function ddmm(iso: string): string {
  const [, m, d] = partes(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** "hoje", "amanhã, 05/12", "em 3 dias, 05/12", "em 7 dias, 05/12". */
export function quando(ocorrencia: string, hoje: string): string {
  const faltam = diasEntre(hoje, ocorrencia);
  if (faltam <= 0) return "hoje";
  if (faltam === 1) return `amanhã, ${ddmm(ocorrencia)}`;
  return `em ${faltam} dias, ${ddmm(ocorrencia)}`;
}

function horaCurta(horario: string | null): string | null {
  return horario ? horario.slice(0, 5) : null;
}

export function linhaDoAviso(a: AvisoDoDia, hoje: string): string {
  const hora = horaCurta(a.lembrete.horario);
  return `${a.lembrete.titulo} · ${quando(a.ocorrencia, hoje)}${hora ? ` às ${hora}` : ""}`;
}

const SITE = "https://one.usepolia.com.br";
const ROTA = "/calendario";

function encurtar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max - 1).trimEnd()}…` : texto;
}

export function avisoLembretes(avisos: AvisoDoDia[], hoje: string): Aviso {
  if (avisos.length === 1) {
    const a = avisos[0];
    const hora = horaCurta(a.lembrete.horario);
    const q = quando(a.ocorrencia, hoje);
    return {
      titulo: encurtar(a.lembrete.titulo, 60),
      corpo: `Lembrete do Calendário: ${q}${hora ? ` às ${hora}` : ""}.`,
      rota: ROTA,
    };
  }
  return {
    titulo: `${avisos.length} lembretes no Calendário`,
    corpo: "A Pólia One mostra no Calendário o que está chegando.",
    rota: ROTA,
  };
}

export function montarEmailLembretes(
  avisos: AvisoDoDia[],
  hoje: string,
): { assunto: string; texto: string; html: string } {
  const linhas = avisos.map((a) => linhaDoAviso(a, hoje));
  const observacoes = avisos
    .filter((a) => a.lembrete.observacao?.trim())
    .map((a) => `${a.lembrete.titulo}: ${a.lembrete.observacao!.trim()}`);
  const assunto =
    avisos.length === 1
      ? `Lembrete: ${encurtar(avisos[0].lembrete.titulo, 70)}`
      : `${avisos.length} lembretes na Pólia One`;
  const headline =
    avisos.length === 1
      ? encurtar(avisos[0].lembrete.titulo, 90)
      : `${avisos.length} lembretes chegando`;
  const rodape =
    "Pra não receber este aviso, é só desligar em Configurações, na Pólia One, ou tirar o aviso do lembrete no Calendário.";
  const ctaLabel = "Quero abrir o Calendário";
  const url = `${SITE}${ROTA}`;
  return {
    assunto,
    texto: [...linhas, ...observacoes, "", `${ctaLabel}: ${url}`, "", rodape].join("\n"),
    html: emailPolia({
      preheader: "A Pólia One avisa do que você marcou no Calendário.",
      headline: escapeHtml(headline),
      paragrafos: [...linhas.map(escapeHtml), ...observacoes.map(escapeHtml), rodape],
      ctaLabel,
      ctaUrl: url,
    }),
  };
}
