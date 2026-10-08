// Conflito entre duas abas no Planejamento (07/10/2026).
//
// Com a mesma seção aberta em duas abas (ou no celular e no computador), a
// última a salvar gravava por cima da outra sem aviso. Agora cada aba guarda a
// versão de cada resposta que ela leu (texto + updated_at) e só grava se o banco
// ainda estiver nessa versão. A gravação é condicional no próprio banco
// (UPDATE ... WHERE updated_at = o que a aba leu; INSERT que falha se a linha já
// existir), então não há janela entre conferir e gravar.
//
// Mudou só o updated_at e o texto é o mesmo (ex.: um gatilho do banco renovou a
// data, ou as duas abas gravaram a mesma coisa): isso não é conflito, a
// gravação segue com a versão nova.
//
// A lógica não conhece Supabase nem React: as operações de banco entram por
// parâmetro, pra dar pra testar com dublês.

export interface VersaoResposta {
  resposta: string | null;
  updated_at: string;
}

/** Outra aba ou aparelho salvou esta resposta depois da leitura desta aba. */
export class ConflitoDeVersao extends Error {
  constructor(public readonly noBanco: VersaoResposta) {
    super("planejamento: resposta alterada em outra aba");
    this.name = "ConflitoDeVersao";
  }
}

export function ehConflitoDeVersao(e: unknown): e is ConflitoDeVersao {
  return e instanceof ConflitoDeVersao;
}

const texto = (s: string | null | undefined) => s ?? "";

/**
 * O que está no banco agora contradiz o que esta aba leu?
 *
 * - O banco já tem exatamente o texto que vai ser salvo: não há o que proteger.
 * - A aba não tinha lido linha nenhuma: só é conflito se a outra aba escreveu
 *   alguma coisa (linha em branco não tem o que perder).
 * - A aba tinha lido uma versão: é conflito se o texto do banco mudou desde ela.
 */
export function houveConflito(
  lida: VersaoResposta | null,
  noBanco: VersaoResposta,
  aSalvar: string,
): boolean {
  if (texto(noBanco.resposta) === aSalvar) return false;
  if (!lida) return texto(noBanco.resposta).trim() !== "";
  return texto(noBanco.resposta) !== texto(lida.resposta);
}

export interface OperacoesResposta {
  /** Linha atual no banco, ou null se não existe. */
  ler: () => Promise<VersaoResposta | null>;
  /**
   * UPDATE só se o updated_at no banco ainda for `updatedAtLido`. Devolve a
   * linha gravada, ou null quando nenhuma linha bateu (alguém gravou antes).
   */
  atualizarSe: (updatedAtLido: string, resposta: string) => Promise<VersaoResposta | null>;
  /** INSERT. Devolve null quando a linha já existe (violação de chave única). */
  inserir: (resposta: string) => Promise<VersaoResposta | null>;
  /**
   * A versão do banco foi gravada por esta mesma aba (ex.: o envio de saída de
   * uma seção voltou depois que a seção seguinte montou com a versão anterior).
   * Escrita própria nunca é conflito.
   */
  ehDestaAba?: (v: VersaoResposta) => boolean;
  /**
   * Gravação sem condição (o upsert de antes). Só é usada quando o UPDATE
   * condicional não bateu mas o banco mostra exatamente a versão lida (mesma
   * data, mesmo texto): ninguém gravou no meio, então a falha foi do filtro
   * por data, e travar o salvamento seria pior do que gravar.
   */
  gravarSemCondicao?: (resposta: string) => Promise<VersaoResposta>;
}

/**
 * Grava `aSalvar` partindo da versão `lida`. Devolve a versão gravada (que vira
 * a nova versão lida da aba) ou lança ConflitoDeVersao com a versão do banco.
 * Erro de rede/banco sobe como veio, pra fila de salvamento tentar de novo.
 */
export async function salvarComVersao(
  lida: VersaoResposta | null,
  aSalvar: string,
  ops: OperacoesResposta,
  tentativas = 3,
): Promise<VersaoResposta> {
  let base = lida;
  for (let i = 0; i < tentativas; i++) {
    const gravada = base
      ? await ops.atualizarSe(base.updated_at, aSalvar)
      : await ops.inserir(aSalvar);
    if (gravada) return gravada;

    // Não gravou: alguém mexeu na linha (ou apagou) desde a leitura.
    const noBanco = await ops.ler();
    if (!noBanco) {
      // Linha sumiu (só acontece com exclusão): grava do zero.
      base = null;
      continue;
    }
    if (!ops.ehDestaAba?.(noBanco) && houveConflito(base, noBanco, aSalvar)) {
      throw new ConflitoDeVersao(noBanco);
    }
    if (
      base &&
      ops.gravarSemCondicao &&
      noBanco.updated_at === base.updated_at &&
      texto(noBanco.resposta) === texto(base.resposta)
    ) {
      return ops.gravarSemCondicao(aSalvar);
    }
    // Mudou só a data, ou a outra aba gravou o mesmo texto: segue dessa versão.
    base = noBanco;
  }
  // A linha mudou a cada tentativa: melhor parar e mostrar do que gravar às cegas.
  const noBanco = await ops.ler();
  if (noBanco && texto(noBanco.resposta) === aSalvar) return noBanco;
  if (noBanco) throw new ConflitoDeVersao(noBanco);
  throw new Error("planejamento: não foi possível gravar a resposta");
}
