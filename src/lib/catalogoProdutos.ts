// Filtros, contagem e ordem do Catálogo de Produtos (23/11/2026, desenho em
// cinza aprovado pela Sil). Antes eram 123 produtos numa grade só, sem
// contagem, sem filtro e sem ordem, e os arquivados não apareciam em lugar
// nenhum. Aqui mora só a regra; a tela é routes/_authenticated/produtos.tsx.

export type FiltroCatalogo = "todos" | "vitrine" | "fora" | "sem_custo" | "arquivados";
export type OrdemCatalogo = "recentes" | "nome" | "preco" | "lucro";

export const ROTULO_FILTRO: Record<FiltroCatalogo, string> = {
  todos: "Todos",
  vitrine: "Na Vitrine",
  fora: "Fora da Vitrine",
  sem_custo: "Sem custo",
  arquivados: "Arquivados",
};

export const ROTULO_ORDEM: Record<OrdemCatalogo, string> = {
  recentes: "Mais recentes",
  nome: "Nome (A a Z)",
  preco: "Maior preço",
  lucro: "Maior lucro",
};

export interface ProdutoDoCatalogo {
  nome: string;
  tipo: string;
  preco_venda: number | string | null;
  preco_custo: number | string | null;
  no_catalogo?: boolean | null;
  created_at: string;
}

const semCusto = (p: ProdutoDoCatalogo) => p.preco_custo == null;

export type ContagemCatalogo = Record<FiltroCatalogo, number>;

/** Quantos produtos cada filtro mostra. `ativos` não inclui os arquivados. */
export function contagemDoCatalogo(
  ativos: readonly ProdutoDoCatalogo[],
  arquivados: number,
): ContagemCatalogo {
  let vitrine = 0;
  let semCustoN = 0;
  for (const p of ativos) {
    if (p.no_catalogo) vitrine += 1;
    if (semCusto(p)) semCustoN += 1;
  }
  return {
    todos: ativos.length,
    vitrine,
    fora: ativos.length - vitrine,
    sem_custo: semCustoN,
    arquivados,
  };
}

/** Filtra os ativos. "arquivados" é outra lista, lida à parte pela tela. */
export function filtrarCatalogo<T extends ProdutoDoCatalogo>(
  ativos: readonly T[],
  filtro: Exclude<FiltroCatalogo, "arquivados">,
): T[] {
  if (filtro === "vitrine") return ativos.filter((p) => !!p.no_catalogo);
  if (filtro === "fora") return ativos.filter((p) => !p.no_catalogo);
  if (filtro === "sem_custo") return ativos.filter(semCusto);
  return [...ativos];
}

/**
 * Ordena sem mexer na lista original. `lucroPct` devolve o lucro em % do
 * produto, ou null sem custo: quem não tem lucro conhecido vai pro fim em
 * "Maior lucro". No empate, o nome decide.
 */
export function ordenarCatalogo<T extends ProdutoDoCatalogo>(
  lista: readonly T[],
  ordem: OrdemCatalogo,
  lucroPct: (p: T) => number | null,
): T[] {
  const porNome = (a: T, b: T) => a.nome.localeCompare(b.nome, "pt-BR");
  const copia = [...lista];
  if (ordem === "nome") return copia.sort(porNome);
  if (ordem === "preco") {
    return copia.sort(
      (a, b) => Number(b.preco_venda ?? 0) - Number(a.preco_venda ?? 0) || porNome(a, b),
    );
  }
  if (ordem === "lucro") {
    return copia.sort((a, b) => {
      const la = lucroPct(a);
      const lb = lucroPct(b);
      if (la == null && lb == null) return porNome(a, b);
      if (la == null) return 1;
      if (lb == null) return -1;
      return lb - la || porNome(a, b);
    });
  }
  return copia.sort((a, b) => b.created_at.localeCompare(a.created_at) || porNome(a, b));
}

/**
 * O tipo ("Produto físico") só diz algo quando o catálogo mistura tipos. Com
 * todos do mesmo tipo, ele se repetia em cada card sem informar nada.
 */
export function mostraTipoNoCard(produtos: readonly Pick<ProdutoDoCatalogo, "tipo">[]): boolean {
  return new Set(produtos.map((p) => p.tipo)).size > 1;
}

/**
 * A conta acompanha o saldo dos materiais? Sim quando algum material tem
 * saldo ou mínimo. Sem isso, "0 un", "mínimo não definido" e "o material
 * acabou" em todas as linhas só faziam barulho pra quem trabalha sem contar.
 */
export function controlaMateriais(insumos: readonly { saldo: number; minimo: number }[]): boolean {
  return insumos.some((i) => i.saldo !== 0 || i.minimo > 0);
}

export type FiltroReceitas = "todas" | "sem" | "com";

export function filtrarReceitas<T extends { id: string }>(
  produtos: readonly T[],
  temReceita: (id: string) => boolean,
  filtro: FiltroReceitas,
): T[] {
  if (filtro === "sem") return produtos.filter((p) => !temReceita(p.id));
  if (filtro === "com") return produtos.filter((p) => temReceita(p.id));
  return [...produtos];
}
