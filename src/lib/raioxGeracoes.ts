// Histórico de gerações do raio-x (07/10/2026, pedido da Sil): cada geração
// vira uma linha nova em ia_raiox em vez de apagar a anterior do mesmo mês.
// Partes puras, sem Supabase: a tela e o servidor dividem, e o teste roda sem
// banco.

/**
 * Erro de "tabela/coluna não existe" (migração ainda não aplicada): PostgREST
 * devolve PGRST205/PGRST204, o Postgres 42P01/42703.
 */
const CODIGOS_SEM_SCHEMA = new Set(["PGRST205", "PGRST204", "42P01", "42703"]);

/** Violação de UNIQUE no Postgres. */
const CODIGO_DUPLICADO = "23505";

function codigoDoErro(erro: unknown): string | null {
  const code = (erro as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}

export function faltaSchema(erro: unknown): boolean {
  const code = codigoDoErro(erro);
  return code != null && CODIGOS_SEM_SCHEMA.has(code);
}

export function ehDuplicado(erro: unknown): boolean {
  return codigoDoErro(erro) === CODIGO_DUPLICADO;
}

export interface OperacoesGravacao<T> {
  /** Insere uma linha nova (uma por geração). */
  inserir: (valores: T) => PromiseLike<{ error: unknown }>;
  /** Atualiza a linha que já existe daquele mês (comportamento antigo). */
  atualizar: (valores: T) => PromiseLike<{ error: unknown }>;
}

export type ResultadoGravacao =
  | { modo: "inserido" | "atualizado" }
  | { modo: "falhou"; error: unknown };

async function inserirOuAtualizar<T>(
  valores: T,
  ops: OperacoesGravacao<T>,
): Promise<ResultadoGravacao> {
  const inserido = await ops.inserir(valores);
  if (!inserido.error) return { modo: "inserido" };
  // Antes da migração 20261008200000 a UNIQUE (user_id, mes) ainda existe:
  // o insert num mês que já tem raio-x volta 23505 e a geração cai no update
  // da linha existente, sem perder a leitura que acabou de sair.
  if (!ehDuplicado(inserido.error)) return { modo: "falhou", error: inserido.error };
  const atualizado = await ops.atualizar(valores);
  return atualizado.error ? { modo: "falhou", error: atualizado.error } : { modo: "atualizado" };
}

/**
 * Grava uma geração do raio-x. Tenta com `avisos`; se a coluna ainda não
 * existe (migração 20261008190000 pendente), grava de novo sem ela.
 */
export async function gravarGeracaoRaioX<T extends object>(
  linha: T,
  avisos: string[],
  ops: OperacoesGravacao<T & { avisos?: string[] }>,
): Promise<ResultadoGravacao> {
  const comAvisos = await inserirOuAtualizar<T & { avisos?: string[] }>({ ...linha, avisos }, ops);
  if (comAvisos.modo !== "falhou" || !faltaSchema(comAvisos.error)) return comAvisos;
  return inserirOuAtualizar<T & { avisos?: string[] }>(linha, ops);
}

export interface VersaoRaioX {
  id: string;
  criado_em: string;
}

/**
 * Ordena as gerações da mais recente pra mais antiga. Empate de horário
 * desempata pelo id, pra ordem não pular entre leituras.
 */
export function ordenarVersoes<T extends VersaoRaioX>(versoes: readonly T[]): T[] {
  return [...versoes].sort((a, b) => {
    const ta = Date.parse(a.criado_em);
    const tb = Date.parse(b.criado_em);
    const da = Number.isFinite(ta) ? ta : 0;
    const db = Number.isFinite(tb) ? tb : 0;
    if (db !== da) return db - da;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
}

/**
 * Versão que a tela mostra: a escolhida na lista, se ainda existir; senão a
 * mais recente. Lista vazia devolve null.
 */
export function versaoEscolhida<T extends VersaoRaioX>(
  versoes: readonly T[],
  idEscolhido: string | null,
): T | null {
  if (idEscolhido) {
    const achada = versoes.find((v) => v.id === idEscolhido);
    if (achada) return achada;
  }
  return ordenarVersoes(versoes)[0] ?? null;
}

/**
 * Data e hora da geração em pt-BR, no fuso de quem lê ("07/10/2026 às 14:32").
 * `fuso` existe pro teste; a tela usa o do navegador.
 */
export function dataHoraDaGeracao(iso: string, fuso?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Data indisponível";
  const data = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: fuso,
  });
  const hora = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: fuso,
  });
  return `${data} às ${hora}`;
}
