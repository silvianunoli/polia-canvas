import { lerCsvExtrato, linhasDoCsv } from "./csvExtrato";
import { lerNfe } from "./nfe";
import { lerOfx } from "./ofx";
import type { LinhaImportada } from "./comum";

export * from "./comum";
export { linhasDoCsv, type ColunasCsv } from "./csvExtrato";
export { criarSugestorDeCategoria, marcarRepetidos, type LancamentoExistente } from "./revisao";

export type Leitura =
  | { tipo: "linhas"; linhas: LinhaImportada[]; avisos: string[] }
  | { tipo: "mapear"; matriz: string[][] }
  | { tipo: "erro"; erro: string };

export type FormatoArquivo = "ofx" | "csv" | "xml";

/** Pela extensão; sem extensão conhecida, pelo começo do conteúdo. */
export function formatoDoArquivo(nome: string, texto: string): FormatoArquivo | null {
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  if (ext === "ofx" || ext === "qfx") return "ofx";
  if (ext === "csv" || ext === "txt") return /<OFX>/i.test(texto) ? "ofx" : "csv";
  if (ext === "xml") return "xml";
  const inicio = texto.trimStart().slice(0, 300);
  if (/OFXHEADER|<OFX>/i.test(inicio)) return "ofx";
  if (inicio.startsWith("<?xml") || /<nfeProc|<NFe/i.test(inicio)) return "xml";
  return null;
}

export function lerArquivo(nome: string, texto: string, cnpjDela: string | null): Leitura {
  const formato = formatoDoArquivo(nome, texto);
  if (!formato) {
    return {
      tipo: "erro",
      erro: `${nome}: a Pólia lê extrato .ofx, planilha .csv e nota fiscal .xml. Planilha do Excel ou do Google, salve como CSV antes.`,
    };
  }
  if (formato === "csv") {
    const csv = lerCsvExtrato(texto);
    if (csv.tipo === "erro") return { tipo: "erro", erro: `${nome}: ${csv.erro}` };
    if (csv.tipo === "mapear") return { tipo: "mapear", matriz: csv.matriz };
    const r = linhasDoCsv(csv.matriz, csv.colunas, csv.linhaTitulos);
    return "erro" in r ? { tipo: "erro", erro: `${nome}: ${r.erro}` } : { tipo: "linhas", ...r };
  }
  const r = formato === "ofx" ? lerOfx(texto) : lerNfe(texto, cnpjDela);
  return "erro" in r ? { tipo: "erro", erro: `${nome}: ${r.erro}` } : { tipo: "linhas", ...r };
}
