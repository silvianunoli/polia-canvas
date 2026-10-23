// Curva ABC e produto parado (ONE-130). Puro: recebe o que lib/vendas.ts já
// calcula (maisVendidos), o catálogo e a última venda de cada produto, e
// devolve o que a aba Mais vendidos mostra. Benchmark Bling (Curva ABC e Sem
// Movimentação, ONE-126).

import { diasEntreDatas } from "./data.functions";
import type { LinhaRanking } from "./vendas";

export type ClasseABC = "A" | "B" | "C";

export interface CurvaABC {
  /** Lucro quando todo produto vendido tem custo; senão, o que a marca vendeu. */
  base: "lucrou" | "entrou";
  classes: Map<string, ClasseABC>;
  resumo: Record<ClasseABC, { produtos: number; parte: number }>;
  /** Produtos do período sem custo (por causa deles a base vira "entrou"). */
  semCusto: string[];
}

const LIMITE_A = 0.8;
const LIMITE_B = 0.95;

/**
 * A = produtos que, somados, chegam a 80% do total; B = os seguintes, até
 * 95%; C = o resto. Quem cruza a linha fica na classe de cima, e valores
 * iguais ficam sempre na mesma classe (a ordem escolhida na tela não muda a
 * curva). Lucro zero ou negativo é C.
 */
export function curvaABC(linhas: readonly LinhaRanking[]): CurvaABC {
  const semCusto = linhas.filter((l) => l.lucrou == null).map((l) => l.produtoNome);
  const base: CurvaABC["base"] = linhas.length > 0 && semCusto.length === 0 ? "lucrou" : "entrou";
  const valor = (l: LinhaRanking) => (base === "lucrou" ? (l.lucrou ?? 0) : l.entrou);
  const positivos = linhas
    .filter((l) => valor(l) > 0)
    .sort((a, b) => valor(b) - valor(a) || a.chave.localeCompare(b.chave));
  const total = positivos.reduce((s, l) => s + valor(l), 0);

  const classes = new Map<string, ClasseABC>();
  const resumo: CurvaABC["resumo"] = {
    A: { produtos: 0, parte: 0 },
    B: { produtos: 0, parte: 0 },
    C: { produtos: 0, parte: 0 },
  };
  let acumuladoAntes = 0;
  let valorAnterior: number | null = null;
  let classeAnterior: ClasseABC = "A";
  for (const l of positivos) {
    const v = valor(l);
    const classe: ClasseABC =
      v === valorAnterior
        ? classeAnterior
        : acumuladoAntes / total < LIMITE_A
          ? "A"
          : acumuladoAntes / total < LIMITE_B
            ? "B"
            : "C";
    classes.set(l.chave, classe);
    resumo[classe].produtos += 1;
    resumo[classe].parte += v / total;
    acumuladoAntes += v;
    valorAnterior = v;
    classeAnterior = classe;
  }
  for (const l of linhas) {
    if (classes.has(l.chave)) continue;
    classes.set(l.chave, "C");
    resumo.C.produtos += 1;
  }
  return { base, classes, resumo, semCusto };
}

export interface EntradaParado {
  id: string;
  nome: string;
  tipo: string;
  precoCusto: number | null;
  controlaEstoque: boolean;
  /** created_at do produto (ISO). */
  criadoEm: string;
  /** Saldo de cada variação. */
  saldos: number[];
}

export interface ProdutoParado {
  id: string;
  nome: string;
  /** null quando nunca vendeu. */
  ultimaVenda: string | null;
  diasSemVenda: number | null;
  /** Dias desde o cadastro, quando nunca vendeu. */
  cadastradoHa: number | null;
  controlaEstoque: boolean;
  saldo: number;
  /** Saldo x custo; null com estoque desligado ou sem custo. */
  dinheiroParado: number | null;
}

/** Sem prateleira: não fica "parado". */
const SEM_ESTOQUE_FISICO = new Set(["servico", "digital"]);

/**
 * Produto físico sem venda há `dias` ou mais. Fica de fora: serviço e produto
 * digital; produto cadastrado há menos de `dias` (ainda não teve tempo de
 * vender); com estoque ligado, quem não tem saldo. Saldo negativo de uma
 * variação não abate o positivo de outra. Ordena pelo dinheiro parado, depois
 * por há quanto tempo não vende.
 */
export function produtosParados(
  produtos: readonly EntradaParado[],
  ultimaVenda: ReadonlyMap<string, string>,
  hoje: string,
  dias: number,
): ProdutoParado[] {
  const parados: ProdutoParado[] = [];
  for (const p of produtos) {
    if (SEM_ESTOQUE_FISICO.has(p.tipo)) continue;
    const saldo = p.saldos.reduce((s, x) => s + Math.max(0, x), 0);
    if (p.controlaEstoque && saldo <= 0) continue;
    const ultima = ultimaVenda.get(p.id) ?? null;
    if (ultima) {
      if (diasEntreDatas(ultima, hoje) < dias) continue;
    } else if (diasEntreDatas(p.criadoEm.slice(0, 10), hoje) < dias) {
      continue;
    }
    parados.push({
      id: p.id,
      nome: p.nome,
      ultimaVenda: ultima,
      diasSemVenda: ultima ? diasEntreDatas(ultima, hoje) : null,
      cadastradoHa: ultima ? null : diasEntreDatas(p.criadoEm.slice(0, 10), hoje),
      controlaEstoque: p.controlaEstoque,
      saldo,
      dinheiroParado:
        p.controlaEstoque && p.precoCusto != null
          ? Math.round(saldo * p.precoCusto * 100) / 100
          : null,
    });
  }
  const tempo = (x: ProdutoParado) => x.diasSemVenda ?? x.cadastradoHa ?? 0;
  return parados.sort(
    (a, b) =>
      (b.dinheiroParado ?? -1) - (a.dinheiroParado ?? -1) ||
      tempo(b) - tempo(a) ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );
}
