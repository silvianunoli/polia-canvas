/**
 * Leitura completa de uma consulta do Supabase, página por página.
 *
 * Existe por causa do QA-24 (08/10/2026): o PostgREST do projeto devolve no
 * máximo 1.000 linhas por requisição, sem erro e sem aviso. O Painel lia os
 * lançamentos sem filtro de data e somava o que voltou, então acima de 1.000
 * lançamentos a receita e o "quanto sobrou" do mês ficavam errados em
 * silêncio. Tela de dinheiro não pode mentir: ou soma tudo, ou avisa que falhou.
 */

/** Tamanho da página. Igual ao teto do PostgREST, pra uma página nunca ser cortada. */
export const TAMANHO_PAGINA = 1000;

/** Teto de páginas: passou disso, a leitura falha em vez de devolver soma parcial. */
export const MAX_PAGINAS = 50;

export class LeituraIncompletaError extends Error {
  constructor() {
    super("leitura_incompleta");
    this.name = "LeituraIncompletaError";
  }
}

type Pagina<T> = { data: T[] | null; error: unknown };

/**
 * Chama `buscarPagina(de, ate)` (índices inclusivos, como o `.range()` do
 * supabase-js) até vir uma página incompleta. A consulta precisa ter `order`
 * estável, senão linhas podem repetir ou pular entre as páginas.
 * Propaga o primeiro erro; estoura `LeituraIncompletaError` se passar do teto.
 */
export async function lerTodasAsPaginas<T>(
  buscarPagina: (de: number, ate: number) => PromiseLike<Pagina<T>>,
  tamanho = TAMANHO_PAGINA,
  maxPaginas = MAX_PAGINAS,
): Promise<T[]> {
  const todas: T[] = [];
  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const de = pagina * tamanho;
    const { data, error } = await buscarPagina(de, de + tamanho - 1);
    if (error) throw error;
    const linhas = data ?? [];
    todas.push(...linhas);
    if (linhas.length < tamanho) return todas;
  }
  throw new LeituraIncompletaError();
}

/**
 * Primeiro dia do mês e primeiro dia do mês seguinte (AAAA-MM-DD), pra
 * filtrar coluna `date` com `.gte(inicio).lt(fimExclusivo)`.
 * `mes` vai de 1 a 12.
 */
export function intervaloDoMes(ano: number, mes: number): { inicio: string; fimExclusivo: string } {
  const p = (n: number) => String(n).padStart(2, "0");
  const proxAno = mes === 12 ? ano + 1 : ano;
  const proxMes = mes === 12 ? 1 : mes + 1;
  return { inicio: `${ano}-${p(mes)}-01`, fimExclusivo: `${proxAno}-${p(proxMes)}-01` };
}
