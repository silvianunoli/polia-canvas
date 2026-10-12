// Importar lançamentos no Financeiro (ONE-124, pedido de teste de 11/10/2026:
// "poderia lançar direto o extrato bancário, por planilha, por XML"). Tudo
// aqui é regra pura: o arquivo é lido no navegador e nada sobe pro servidor
// até ela revisar e mandar importar só as linhas marcadas.

export type TipoLancamento = "entrada" | "saida";

export interface LinhaImportada {
  /** YYYY-MM-DD */
  data: string;
  descricao: string;
  /** Sempre positivo; o sentido vem do tipo. */
  valor: number;
  tipo: TipoLancamento;
  /** Id estável do banco/nota (FITID do OFX, chave da NF-e). Barra importar duas vezes. */
  idExterno: string | null;
  /** Categoria que o próprio arquivo já indica (ex.: nota de venda). */
  categoria?: string | null;
}

export type ResultadoLeitura = { linhas: LinhaImportada[]; avisos: string[] } | { erro: string };

/** Teto por importação: acima disso a revisão linha a linha deixa de ser revisão. */
export const MAX_LINHAS_IMPORTACAO = 2000;
/** Extrato de um ano inteiro em OFX fica bem abaixo disso. */
export const MAX_BYTES_ARQUIVO = 5 * 1024 * 1024;

/** Maiúscula, sem acento, sem número nem pontuação: o que sobra é o "nome" da movimentação. */
export function normalizarDescricao(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function limparTexto(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function soDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

function dataValida(ano: number, mes: number, dia: number): string | null {
  if (ano < 1990 || ano > 2100 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Aceita 02/10/2026, 02/10/26, 2026-10-02, 02-10-2026, 02.10.2026 e 20261002. */
export function lerDataExtrato(bruto: string): string | null {
  const s = bruto.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return dataValida(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/);
  if (m) {
    const ano = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return dataValida(ano, +m[2], +m[1]);
  }
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return dataValida(+m[1], +m[2], +m[3]);
  return null;
}

/**
 * Valor como o banco escreve: "-1.234,56", "R$ 29,90", "(29,90)", "29,90 D",
 * "1234.56". Devolve com sinal (saída negativa) ou null se não for número.
 */
export function lerValorExtrato(bruto: string): number | null {
  let s = bruto.replace(/\u00a0/g, " ").trim();
  if (!s) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1);
  }
  const sufixo = s.match(/\s*([DC])$/i);
  if (sufixo) {
    if (sufixo[1].toUpperCase() === "D") negativo = true;
    s = s.slice(0, -sufixo[0].length);
  }
  s = s.replace(/R\$/gi, "").replace(/\s/g, "");
  if (s.startsWith("-")) {
    negativo = !negativo;
    s = s.slice(1);
  } else if (s.endsWith("-")) {
    negativo = !negativo;
    s = s.slice(0, -1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s)) return null;
  const ultimaVirgula = s.lastIndexOf(",");
  const ultimoPonto = s.lastIndexOf(".");
  if (ultimaVirgula > ultimoPonto) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (ultimoPonto > ultimaVirgula && ultimaVirgula >= 0) {
    s = s.replace(/,/g, "");
  } else if (ultimaVirgula < 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.234" sem vírgula é milhar no jeito brasileiro.
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/** Extrato brasileiro costuma vir em Windows-1252; o resto, em UTF-8. */
export function decodificarArquivo(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function centavos(v: number): number {
  return Math.round(v * 100);
}
