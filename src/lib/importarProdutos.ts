// Importar produtos de planilha (ONE-121, pedido de teste de 11/10/2026).
// Mesmo caminho da importação do Financeiro (lib/importarExtrato): CSV lido no
// navegador, títulos de coluna reconhecidos sozinhos ou apontados por ela, e
// revisão antes de gravar. Regra pura, sem React.

import { parseCsv } from "@/lib/csv";
import { detectarSeparador } from "@/lib/importarExtrato/csvExtrato";
import { lerValorExtrato, limparTexto } from "@/lib/importarExtrato/comum";
import type { ProdutoTipo } from "@/components/produtos/tipos";

export interface ProdutoImportado {
  /** Linha da planilha (1 = primeira), pra dizer qual ficou de fora. */
  linha: number;
  nome: string;
  tipo: ProdutoTipo;
  precoVenda: number;
  precoCusto: number | null;
  canal: string | null;
  descricao: string | null;
  observacaoInterna: string | null;
}

export interface ColunasProduto {
  nome: number;
  precoVenda: number;
  tipo?: number;
  custo?: number;
  canal?: number;
  descricao?: number;
  observacao?: number;
  /** Código, SKU, fornecedor: entram juntos na observação interna (ONE-120). */
  extras?: { titulo: string; indice: number }[];
}

export type LeituraPlanilhaProdutos =
  | { tipo: "pronto"; matriz: string[][]; linhaTitulos: number; colunas: ColunasProduto }
  | { tipo: "mapear"; matriz: string[][] }
  | { tipo: "erro"; erro: string };

export const TITULOS_MODELO = [
  "Nome",
  "Tipo",
  "Preço de venda",
  "Custo",
  "Onde vende",
  "Descrição",
  "Observação interna",
];

export const EXEMPLO_MODELO = [
  "Caneca de cerâmica pintada",
  "Físico",
  "89,90",
  "32,50",
  "Instagram e feira",
  "Caneca de 300 ml, pintada à mão",
  "Cód. CAN-014 · Ateliê Barro Bom",
];

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function detectarColunasProduto(titulos: string[]): ColunasProduto | null {
  const t = titulos.map(norm);
  const usadas = new Set<number>();
  const achar = (teste: (s: string) => boolean): number | undefined => {
    const i = t.findIndex((s, idx) => !usadas.has(idx) && s.length > 0 && teste(s));
    if (i < 0) return undefined;
    usadas.add(i);
    return i;
  };
  const nome = achar((s) => /^(nome|produto|item)\b/.test(s));
  const custo = achar((s) => s.includes("custo"));
  const precoVenda = achar((s) => s.includes("venda") || /^(preco|valor)\b/.test(s));
  if (nome === undefined || precoVenda === undefined) return null;
  const tipo = achar((s) => s.startsWith("tipo"));
  const canal = achar((s) => s.startsWith("canal") || s.startsWith("onde"));
  const observacao = achar((s) => /^(observ|obs\b|nota)/.test(s));
  const descricao = achar((s) => s.startsWith("descri"));
  const extras: { titulo: string; indice: number }[] = [];
  for (;;) {
    const i = achar((s) => /^(codigo|cod\b|sku|ref|referencia|fornecedor|ean|gtin)/.test(s));
    if (i === undefined) break;
    extras.push({ titulo: limparTexto(titulos[i]), indice: i });
  }
  return { nome, precoVenda, tipo, custo, canal, descricao, observacao, extras };
}

export function lerPlanilhaProdutos(texto: string): LeituraPlanilhaProdutos {
  const matriz = parseCsv(texto, detectarSeparador(texto));
  if (matriz.length === 0) return { tipo: "erro", erro: "A planilha está vazia." };
  for (let i = 0; i < Math.min(matriz.length, 10); i++) {
    const colunas = detectarColunasProduto(matriz[i]);
    if (colunas) return { tipo: "pronto", matriz, linhaTitulos: i, colunas };
  }
  return { tipo: "mapear", matriz };
}

/** "Físico", "produto", vazio: físico. "Digital", "curso": digital. "Serviço": serviço. */
export function lerTipoProduto(bruto: string | undefined): ProdutoTipo {
  const s = norm(bruto ?? "");
  if (s.includes("servic")) return "servico";
  if (s.includes("digital") || s.includes("curso")) return "digital";
  return "fisico";
}

function textoOuNulo(s: string | undefined, max: number): string | null {
  const v = limparTexto(s ?? "");
  return v ? v.slice(0, max) : null;
}

export function produtosDaPlanilha(
  matriz: string[][],
  colunas: ColunasProduto,
  linhaTitulos: number,
): { produtos: ProdutoImportado[]; recusadas: { linha: number; motivo: string }[] } {
  const produtos: ProdutoImportado[] = [];
  const recusadas: { linha: number; motivo: string }[] = [];
  matriz.slice(linhaTitulos + 1).forEach((row, i) => {
    const linha = linhaTitulos + 2 + i;
    const nome = limparTexto(row[colunas.nome] ?? "").slice(0, 120);
    const preco = lerValorExtrato(row[colunas.precoVenda] ?? "");
    if (!nome) {
      recusadas.push({ linha, motivo: "sem nome" });
      return;
    }
    if (preco === null || preco <= 0) {
      recusadas.push({ linha, motivo: `${nome} sem preço de venda` });
      return;
    }
    const custoBruto =
      colunas.custo !== undefined ? lerValorExtrato(row[colunas.custo] ?? "") : null;
    const partesObs = [
      colunas.observacao !== undefined ? limparTexto(row[colunas.observacao] ?? "") : "",
      ...(colunas.extras ?? []).map((e) => {
        const v = limparTexto(row[e.indice] ?? "");
        return v ? `${e.titulo}: ${v}` : "";
      }),
    ].filter(Boolean);
    produtos.push({
      linha,
      nome,
      tipo: lerTipoProduto(colunas.tipo !== undefined ? row[colunas.tipo] : undefined),
      precoVenda: Math.abs(preco),
      precoCusto: custoBruto === null ? null : Math.abs(custoBruto),
      canal: colunas.canal !== undefined ? textoOuNulo(row[colunas.canal], 120) : null,
      descricao: colunas.descricao !== undefined ? textoOuNulo(row[colunas.descricao], 300) : null,
      observacaoInterna: partesObs.length > 0 ? partesObs.join(" · ").slice(0, 2000) : null,
    });
  });
  return { produtos, recusadas };
}

/** true no produto que já está no catálogo pelo nome (ou que se repete na planilha). */
export function marcarJaCadastrados(
  produtos: ProdutoImportado[],
  nomesExistentes: string[],
): boolean[] {
  const vistos = new Set(nomesExistentes.map(chaveDoNome));
  return produtos.map((p) => {
    const chave = chaveDoNome(p.nome);
    if (vistos.has(chave)) return true;
    vistos.add(chave);
    return false;
  });
}

// Sem acento, caixa, espaço e pontuação, mas com número: "Caneca 300ml" é a
// mesma "Caneca 300 ml", e "Caneca 500 ml" é outro produto.
function chaveDoNome(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .trim();
}
