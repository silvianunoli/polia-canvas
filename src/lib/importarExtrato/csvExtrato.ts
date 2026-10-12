// CSV: extrato salvo em planilha. Cada banco escreve de um jeito (separador,
// nome de coluna, linhas de cabeçalho da conta antes da tabela), então a
// leitura procura a linha de títulos sozinha; se não achar, a tela pede pra
// ela apontar qual coluna é qual.

import { parseCsv } from "@/lib/csv";
import {
  lerDataExtrato,
  lerValorExtrato,
  limparTexto,
  normalizarDescricao,
  type LinhaImportada,
  type ResultadoLeitura,
} from "./comum";

export interface ColunasCsv {
  data: number;
  descricao: number;
  /** Coluna única com sinal. */
  valor?: number;
  /** Bancos que separam entrada e saída em duas colunas. */
  credito?: number;
  debito?: number;
}

export type LeituraCsv =
  | { tipo: "pronto"; matriz: string[][]; linhaTitulos: number; colunas: ColunasCsv }
  | { tipo: "mapear"; matriz: string[][] }
  | { tipo: "erro"; erro: string };

export function detectarSeparador(texto: string): string {
  const amostra = texto.split(/\r?\n/).slice(0, 20).join("\n");
  const contar = (sep: string) => amostra.split(sep).length - 1;
  const candidatos = [";", "\t", ","].map((sep) => ({ sep, n: contar(sep) }));
  candidatos.sort((a, b) => b.n - a.n);
  return candidatos[0].n > 0 ? candidatos[0].sep : ";";
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function acharColuna(titulos: string[], teste: (t: string) => boolean): number | undefined {
  const i = titulos.findIndex((t) => teste(norm(t)));
  return i >= 0 ? i : undefined;
}

export function detectarColunas(titulos: string[]): ColunasCsv | null {
  const data = acharColuna(titulos, (t) => t.startsWith("data") || t === "dt" || t === "date");
  const descricao = acharColuna(titulos, (t) =>
    /descri|historico|lancamento|memo|detalhe|estabelecimento|titulo|identifica/.test(t),
  );
  const ehSaldo = (t: string) => t.includes("saldo");
  const valor = acharColuna(
    titulos,
    (t) => !ehSaldo(t) && /^(valor|montante|quantia|amount)/.test(t),
  );
  const credito = acharColuna(titulos, (t) => !ehSaldo(t) && /^(credito|entrada)/.test(t));
  const debito = acharColuna(titulos, (t) => !ehSaldo(t) && /^(debito|saida)/.test(t));
  if (data === undefined || descricao === undefined) return null;
  if (valor !== undefined) return { data, descricao, valor };
  if (credito !== undefined && debito !== undefined) return { data, descricao, credito, debito };
  return null;
}

export function lerCsvExtrato(texto: string): LeituraCsv {
  const matriz = parseCsv(texto, detectarSeparador(texto));
  if (matriz.length === 0) return { tipo: "erro", erro: "A planilha está vazia." };
  // Banco costuma pôr agência, conta e período antes da tabela.
  for (let i = 0; i < Math.min(matriz.length, 15); i++) {
    const colunas = detectarColunas(matriz[i]);
    if (colunas) return { tipo: "pronto", matriz, linhaTitulos: i, colunas };
  }
  return { tipo: "mapear", matriz };
}

export function linhasDoCsv(
  matriz: string[][],
  colunas: ColunasCsv,
  linhaTitulos: number,
): ResultadoLeitura {
  const linhas: LinhaImportada[] = [];
  let ignoradas = 0;
  let saldos = 0;
  for (const row of matriz.slice(linhaTitulos + 1)) {
    const descricao = limparTexto(row[colunas.descricao] ?? "");
    // "SALDO ANTERIOR", "SALDO DO DIA": não é movimentação.
    if (/^SALDO\b/.test(normalizarDescricao(descricao))) {
      saldos++;
      continue;
    }
    const data = lerDataExtrato(row[colunas.data] ?? "");
    let valor: number | null = null;
    if (colunas.valor !== undefined) {
      valor = lerValorExtrato(row[colunas.valor] ?? "");
    } else {
      const c = lerValorExtrato(row[colunas.credito!] ?? "");
      const d = lerValorExtrato(row[colunas.debito!] ?? "");
      if (c) valor = Math.abs(c);
      else if (d) valor = -Math.abs(d);
    }
    if (!data || valor === null || valor === 0) {
      ignoradas++;
      continue;
    }
    linhas.push({
      data,
      descricao: descricao || "Movimentação do extrato",
      valor: Math.abs(valor),
      tipo: valor > 0 ? "entrada" : "saida",
      idExterno: null,
    });
  }
  if (linhas.length === 0) {
    return {
      erro: "A Pólia não achou nenhuma movimentação com data e valor nessas colunas.",
    };
  }
  const avisos: string[] = [];
  if (ignoradas > 0) {
    avisos.push(
      `${ignoradas} ${ignoradas === 1 ? "linha ficou" : "linhas ficaram"} de fora por não ter data ou valor.`,
    );
  }
  if (saldos > 0) avisos.push("Linhas de saldo ficaram de fora: não são movimentação.");
  return { linhas, avisos };
}
