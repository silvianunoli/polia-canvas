// Filtros, contagem e ordem do Catálogo de Produtos (23/11/2026, desenho em
// cinza aprovado pela Sil). Antes eram 123 produtos numa grade só, sem
// contagem, sem filtro e sem ordem, e os arquivados não apareciam em lugar
// nenhum. Aqui mora só a regra; a tela é routes/_authenticated/produtos.tsx.

// Desde 23/11/2026 (pedido da Sil) o Catálogo é uma lista, não uma vitrine:
// foto, preço, custo, lucro e status, com o cabeçalho de cada coluna ordenando.
// "Arquivados" virou "Inativos", o mesmo nome do Painel.

export type FiltroCatalogo = "ativos" | "vitrine" | "fora" | "sem_custo" | "inativos" | "todos";
export type ColunaCatalogo = "ordem" | "recentes" | "nome" | "preco" | "custo" | "lucro" | "status";
export type DirecaoOrdem = "asc" | "desc";

export const ROTULO_FILTRO: Record<FiltroCatalogo, string> = {
  ativos: "Ativos",
  vitrine: "Na Vitrine",
  fora: "Fora da Vitrine",
  sem_custo: "Sem custo",
  inativos: "Inativos",
  todos: "Todos",
};

export const FILTROS_CATALOGO: FiltroCatalogo[] = [
  "ativos",
  "vitrine",
  "fora",
  "sem_custo",
  "inativos",
  "todos",
];

export interface ProdutoDoCatalogo {
  id?: string;
  nome: string;
  tipo: string;
  preco_venda: number | string | null;
  preco_custo: number | string | null;
  no_catalogo?: boolean | null;
  arquivado?: boolean | null;
  /** Posição que a dona digitou (produtos.catalogo_ordem, 1 = primeiro). null = sem número. */
  catalogo_ordem?: number | null;
  created_at: string;
}

const semCusto = (p: ProdutoDoCatalogo) => p.preco_custo == null;

/** O mínimo pra ordenar como a vitrine: número da dona, cadastro, nome e id. */
export interface ItemDaOrdem {
  id?: string;
  nome: string;
  catalogo_ordem?: number | null;
  created_at: string;
}

/**
 * A ordem da vitrine, a mesma em Produtos, na Vitrine online e na loja pública
 * (24/11/2026, ONE-239). Numerados primeiro, pelo número; os sem número do
 * cadastro mais recente pro mais antigo. No empate (produtos importados juntos
 * têm o mesmo created_at), decide o nome e, por fim, o id. Sem o desempate,
 * cada tela escolhia uma ordem diferente pros 46 produtos da mesma importação.
 * O SQL de loja_marca_publica repete a regra (migration 20261124040000).
 */
export function compararOrdemDaVitrine(a: ItemDaOrdem, b: ItemDaOrdem): number {
  const na = a.catalogo_ordem ?? null;
  const nb = b.catalogo_ordem ?? null;
  if (na != null && nb == null) return -1;
  if (na == null && nb != null) return 1;
  if (na != null && nb != null && na !== nb) return na - nb;
  return (
    b.created_at.localeCompare(a.created_at) ||
    a.nome.localeCompare(b.nome, "pt-BR") ||
    (a.id ?? "").localeCompare(b.id ?? "")
  );
}

export type ContagemCatalogo = Record<FiltroCatalogo, number>;

/** Quantos produtos cada filtro mostra. Vitrine, fora e sem custo contam só os ativos. */
export function contagemDoCatalogo(
  ativos: readonly ProdutoDoCatalogo[],
  inativos: number,
): ContagemCatalogo {
  let vitrine = 0;
  let semCustoN = 0;
  for (const p of ativos) {
    if (p.no_catalogo) vitrine += 1;
    if (semCusto(p)) semCustoN += 1;
  }
  return {
    ativos: ativos.length,
    vitrine,
    fora: ativos.length - vitrine,
    sem_custo: semCustoN,
    inativos,
    todos: ativos.length + inativos,
  };
}

/** A lista de cada filtro, a partir dos ativos e dos inativos (lidos à parte). */
export function filtrarCatalogo<T extends ProdutoDoCatalogo>(
  ativos: readonly T[],
  inativos: readonly T[],
  filtro: FiltroCatalogo,
): T[] {
  if (filtro === "vitrine") return ativos.filter((p) => !!p.no_catalogo);
  if (filtro === "fora") return ativos.filter((p) => !p.no_catalogo);
  if (filtro === "sem_custo") return ativos.filter(semCusto);
  if (filtro === "inativos") return [...inativos];
  if (filtro === "todos") return [...ativos, ...inativos];
  return [...ativos];
}

/** A direção que a coluna usa no primeiro clique: texto de A a Z, número do maior pro menor. */
export function direcaoInicial(coluna: ColunaCatalogo): DirecaoOrdem {
  return coluna === "nome" || coluna === "status" || coluna === "ordem" ? "asc" : "desc";
}

/**
 * Ordena sem mexer na lista original. Quem não tem o número da coluna (sem
 * custo, sem lucro conhecido) fica no fim nas duas direções. No empate, o
 * nome decide. "status" põe os ativos antes dos inativos em "asc".
 */
export function ordenarCatalogo<T extends ProdutoDoCatalogo>(
  lista: readonly T[],
  coluna: ColunaCatalogo,
  direcao: DirecaoOrdem,
  lucroPct: (p: T) => number | null,
): T[] {
  const porNome = (a: T, b: T) => a.nome.localeCompare(b.nome, "pt-BR");
  const sinal = direcao === "asc" ? 1 : -1;
  const numero = (p: T): number | null => {
    if (coluna === "preco") return p.preco_venda == null ? null : Number(p.preco_venda);
    if (coluna === "custo") return p.preco_custo == null ? null : Number(p.preco_custo);
    if (coluna === "lucro") return lucroPct(p);
    if (coluna === "status") return p.arquivado ? 1 : 0;
    return null;
  };
  const copia = [...lista];
  if (coluna === "ordem") {
    // Numerados primeiro, pelo número; o resto do cadastro mais recente pro
    // mais antigo, a mesma regra da loja pública (loja_marca_publica).
    // Em "desc", só os números invertem; os sem número seguem no fim.
    return copia.sort((a, b) => {
      const na = a.catalogo_ordem ?? null;
      const nb = b.catalogo_ordem ?? null;
      if (sinal === -1 && na != null && nb != null && na !== nb) return nb - na;
      return compararOrdemDaVitrine(a, b);
    });
  }
  if (coluna === "nome") return copia.sort((a, b) => sinal * porNome(a, b));
  if (coluna === "recentes") {
    return copia.sort((a, b) => sinal * a.created_at.localeCompare(b.created_at) || porNome(a, b));
  }
  return copia.sort((a, b) => {
    const na = numero(a);
    const nb = numero(b);
    if (na == null && nb == null) return porNome(a, b);
    if (na == null) return 1;
    if (nb == null) return -1;
    return sinal * (na - nb) || porNome(a, b);
  });
}

export interface PosicaoDoProduto {
  id: string;
  ordem: number | null;
}

/**
 * O que muda quando a dona digita um número na coluna "Ordem" (23/11/2026,
 * pedido da Sil). Número vazio tira o produto da fila numerada. Número que já
 * tem dono: o produto entra ali e quem estava encostado desce um (3, 4, 5
 * viram 4, 5, 6; um buraco depois para a descida). Devolve só quem mudou.
 */
export function reposicionar(
  lista: readonly PosicaoDoProduto[],
  id: string,
  nova: number | null,
): PosicaoDoProduto[] {
  if (nova == null) return [{ id, ordem: null }];
  const ocupados = new Map<number, string[]>();
  for (const p of lista) {
    if (p.id === id || p.ordem == null) continue;
    ocupados.set(p.ordem, [...(ocupados.get(p.ordem) ?? []), p.id]);
  }
  const mudancas: PosicaoDoProduto[] = [{ id, ordem: nova }];
  let atual = nova;
  while (ocupados.has(atual)) {
    for (const outro of ocupados.get(atual) ?? []) mudancas.push({ id: outro, ordem: atual + 1 });
    atual += 1;
  }
  return mudancas;
}

/** Lê o que foi digitado no campo de ordem: inteiro de 1 a 9999, vazio = sem número, resto = inválido. */
export function lerOrdemDigitada(texto: string): number | null | "invalido" {
  const limpo = texto.trim();
  if (limpo === "") return null;
  if (!/^\d+$/.test(limpo)) return "invalido";
  const n = Number(limpo);
  return n >= 1 && n <= 9999 ? n : "invalido";
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
