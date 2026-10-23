// Insumos e produção (ONE-133). Puro: a gravação e a baixa são das RPCs
// (migration 20261023280000). Aqui mora o que a tela mostra antes de gravar:
// quanto sai de cada insumo, quantas peças dá pra produzir, quanto custa o
// material de uma peça e a receita sugerida a partir da Calculadora.

export interface InsumoComSaldo {
  id: string;
  nome: string;
  unidade: string;
  /** R$ por unidade (por grama, por folha). null = sem custo cadastrado. */
  custoUnitario: number | null;
  minimo: number;
  saldo: number;
  /** Data do cadastro (ONE-134: dias de histórico do giro). */
  criadoEm?: string | null;
}

export interface LinhaReceita {
  insumoId: string;
  /** Quanto vai numa peça, na unidade do insumo. */
  quantidade: number;
}

/** Arredonda como o banco (numeric(12,3)): sem 0,30000000000000004. */
export const arred3 = (v: number) => Math.round(v * 1000) / 1000;

export function insumoBaixo(i: Pick<InsumoComSaldo, "saldo" | "minimo">): boolean {
  return i.minimo > 0 && i.saldo <= i.minimo;
}

export interface ConsumoDoInsumo {
  insumoId: string;
  nome: string;
  unidade: string;
  usa: number;
  tem: number;
  fica: number;
}

/** O que sai de cada insumo produzindo `pecas`, e com quanto cada um fica. */
export function consumoDaProducao(
  receita: readonly LinhaReceita[],
  pecas: number,
  insumos: ReadonlyMap<string, InsumoComSaldo>,
): ConsumoDoInsumo[] {
  if (!(pecas >= 1)) return [];
  return receita.flatMap((l) => {
    const i = insumos.get(l.insumoId);
    if (!i) return [];
    const usa = arred3(l.quantidade * pecas);
    return [
      {
        insumoId: i.id,
        nome: i.nome,
        unidade: i.unidade,
        usa,
        tem: i.saldo,
        fica: arred3(i.saldo - usa),
      },
    ];
  });
}

/** Quantas peças o material de hoje dá: o menor "saldo ÷ uso". null sem receita. */
export function pecasQueDaPraProduzir(
  receita: readonly LinhaReceita[],
  insumos: ReadonlyMap<string, InsumoComSaldo>,
): number | null {
  let menor: number | null = null;
  for (const l of receita) {
    const i = insumos.get(l.insumoId);
    if (!i || !(l.quantidade > 0)) continue;
    // Folga de arredondamento: 0,3 ÷ 0,1 dá 2,9999999.
    const pecas = Math.floor(Math.max(0, i.saldo) / l.quantidade + 1e-9);
    menor = menor == null ? pecas : Math.min(menor, pecas);
  }
  return menor;
}

/** Custo do material de uma peça. null se algum insumo não tem custo. */
export function custoDaReceita(
  receita: readonly LinhaReceita[],
  insumos: ReadonlyMap<string, InsumoComSaldo>,
): number | null {
  if (receita.length === 0) return null;
  let total = 0;
  for (const l of receita) {
    const custo = insumos.get(l.insumoId)?.custoUnitario;
    if (custo == null) return null;
    total += l.quantidade * custo;
  }
  return Math.round(total * 100) / 100;
}

export type ErroReceita = "quantidade" | "repetido" | "sem_insumo";

/** Mesmas travas do salvar_receita, ditas antes de gravar. */
export function validarReceita(receita: readonly LinhaReceita[]): ErroReceita | null {
  const vistos = new Set<string>();
  for (const l of receita) {
    if (!l.insumoId) return "sem_insumo";
    // Menos de 0,001 o banco arredonda pra zero e recusa.
    if (!(l.quantidade >= 0.001) || l.quantidade > 100000) return "quantidade";
    if (vistos.has(l.insumoId)) return "repetido";
    vistos.add(l.insumoId);
  }
  return null;
}

/** "1.234,5": até 3 casas, sem zero sobrando. */
export function fmtQtd(v: number): string {
  // arred3 de -0,0001 dá -0, e o toLocaleString escreve "-0".
  return (v === 0 ? 0 : v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

/**
 * Número pra voltar a um campo editável: sem ponto de milhar ("1000,5").
 * Com milhar, reabrir e salvar sem mexer podia virar outro número.
 */
export function qtdNoCampo(v: number): string {
  return (v === 0 ? 0 : v).toLocaleString("pt-BR", {
    maximumFractionDigits: 4,
    useGrouping: false,
  });
}

// ── Sugestão a partir da Calculadora ───────────────────────────────────────

export interface SugestaoInsumo {
  nome: string;
  unidade: string;
  /** pago ÷ veio quanto. null quando a linha não tem valor pago. */
  custoUnitario: number | null;
  /** Uso por peça. */
  quantidade: number;
}

interface LinhaCalculadora {
  nome?: unknown;
  pago?: unknown;
  rende?: unknown;
  unidade?: unknown;
  uso?: unknown;
}

const numero = (v: unknown) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function linhasDe(json: unknown): LinhaCalculadora[] {
  if (typeof json !== "string" || !json) return [];
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? (v as LinhaCalculadora[]) : [];
  } catch {
    return [];
  }
}

/**
 * Materiais e embalagem que ela já preencheu "pelo pacote" na Calculadora
 * (valores.itensMateriaPrima / itensEmbalagem, texto JSON). Linha sem nome
 * fica de fora; o mesmo nome em duas linhas vira uma, somando o uso.
 */
export function sugestaoDaCalculadora(
  breakdown: { valores?: Record<string, unknown> } | null | undefined,
): SugestaoInsumo[] {
  const valores = breakdown?.valores ?? {};
  const linhas = [...linhasDe(valores.itensMateriaPrima), ...linhasDe(valores.itensEmbalagem)];
  const porNome = new Map<string, SugestaoInsumo>();
  for (const l of linhas) {
    const nome = String(l.nome ?? "")
      .trim()
      .slice(0, 80);
    if (!nome) continue;
    const uso = numero(l.uso) > 0 ? numero(l.uso) : 1;
    const pago = numero(l.pago);
    const rende = numero(l.rende) > 0 ? numero(l.rende) : 1;
    const chave = nome.toLowerCase();
    const atual = porNome.get(chave);
    if (atual) {
      atual.quantidade = arred3(atual.quantidade + uso);
      continue;
    }
    porNome.set(chave, {
      nome,
      unidade:
        String(l.unidade ?? "")
          .trim()
          .slice(0, 20) || "un",
      custoUnitario: pago > 0 ? Math.round((pago / rende) * 10000) / 10000 : null,
      quantidade: arred3(uso),
    });
  }
  return [...porNome.values()];
}

/**
 * Número digitado: "0,05", "1.000,5" ou "2.5". Com vírgula, o ponto é de
 * milhar. NaN quando vazio ou não é número (a tela diz o que corrigir).
 */
export function lerQuantidade(texto: string): number {
  const t = texto.trim().replace(/\s/g, "");
  if (!t) return NaN;
  // "1.000" e "12.500" sem vírgula: ponto de milhar, como se escreve aqui.
  // "2.5" continua 2,5.
  const normal = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(t)
      ? t.replace(/\./g, "")
      : t;
  return /^-?\d*\.?\d+$/.test(normal) ? Number(normal) : NaN;
}

/** Custo por unidade: material de grama sai em fração de centavo (R$ 0,0035). */
export function fmtCustoUnitario(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

/** "2026-10-23" → "23/10/2026", sem passar por Date (fuso puxava um dia pra trás). */
export function fmtDia(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

/** Produto que pode ter receita: físico e que não seja kit (kit é montado com os itens). */
export function produzivel(p: { tipo: string; componentes: readonly unknown[] }): boolean {
  return p.tipo === "fisico" && p.componentes.length === 0;
}
