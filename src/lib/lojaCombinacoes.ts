// Combinações da seção "Na loja" da janela de produto (ONE-181). Puro: a dona
// escreve as opções ("Cor": "Azul, Verde") e sai a lista de combinações, sem
// perder o que ela já preencheu quando muda uma opção.

export const MAX_EIXOS = 3;
export const MAX_COMBINACOES = 200;
const MAX_TEXTO_OPCAO = 40;
const MAX_NOME_COMBINACAO = 80;

export interface EixoEditavel {
  chave: string;
  nome: string;
  /** Do jeito que ela digitou, separado por vírgula. */
  valores: string;
}

export interface CombinacaoEditavel {
  /** Identifica a combinação pelos valores, sem diferenciar maiúscula. */
  chave: string;
  /** Presente quando a variação já existe no banco. */
  id?: string;
  nome: string;
  opcoes: Record<string, string>;
  /** Vazio segue o preço do produto. */
  preco: string;
  fotoPath: string | null;
  /** Só pra combinação nova: vira um movimento de entrada. */
  inicial: string;
  saldo?: number;
}

export interface SkuDoBanco {
  id: string;
  variacao: string;
  opcoes: Record<string, string> | null;
  preco_venda: number | null;
  foto_path: string | null;
  saldo: number;
}

const normalizar = (s: string) => s.trim().toLocaleLowerCase("pt-BR");

/** "Azul, verde, azul," vira ["Azul", "verde"]: sem vazio e sem repetido. */
export function separarValores(texto: string): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const parte of texto.split(",")) {
    const valor = parte.trim();
    if (!valor || vistos.has(normalizar(valor))) continue;
    vistos.add(normalizar(valor));
    saida.push(valor);
  }
  return saida;
}

const eixosValidos = (eixos: EixoEditavel[]) =>
  eixos
    .map((e) => ({ nome: e.nome.trim(), valores: separarValores(e.valores) }))
    .filter((e) => e.nome && e.valores.length > 0);

export const chaveDaCombinacao = (valores: string[]) => valores.map(normalizar).join("|");

/** Todas as combinações dos eixos preenchidos, na ordem em que ela digitou. */
export function combinarEixos(
  eixos: EixoEditavel[],
): Array<{ chave: string; nome: string; opcoes: Record<string, string> }> {
  const validos = eixosValidos(eixos);
  if (!validos.length) return [];
  let linhas: Array<Array<[string, string]>> = [[]];
  for (const eixo of validos) {
    linhas = linhas.flatMap((l) =>
      eixo.valores.map((v) => [...l, [eixo.nome, v] as [string, string]]),
    );
    if (linhas.length > MAX_COMBINACOES) break;
  }
  return linhas.map((l) => ({
    chave: chaveDaCombinacao(l.map(([, v]) => v)),
    nome: l.map(([, v]) => v).join(" / "),
    opcoes: Object.fromEntries(l),
  }));
}

/** Nova lista depois de mudar um eixo. Combinação que continua guarda id, preço, foto e quantidade. */
export function atualizarCombinacoes(
  eixos: EixoEditavel[],
  atuais: CombinacaoEditavel[],
): CombinacaoEditavel[] {
  const porChave = new Map(atuais.map((c) => [c.chave, c]));
  return combinarEixos(eixos).map((c) => {
    const antes = porChave.get(c.chave);
    return antes
      ? { ...antes, nome: c.nome, opcoes: c.opcoes }
      : { ...c, preco: "", fotoPath: null, inicial: "" };
  });
}

let contador = 0;
export const novoEixo = (nome = "", valores = ""): EixoEditavel => ({
  chave: `eixo-${++contador}`,
  nome,
  valores,
});

/**
 * Monta os eixos e as combinações a partir do que está no banco. Variação antiga,
 * só com o nome em texto, vira o eixo "Opção" e não se perde.
 */
export function estadoDoBanco(
  eixosBanco: unknown,
  skus: SkuDoBanco[],
): { eixos: EixoEditavel[]; combinacoes: CombinacaoEditavel[] } {
  const nomes = Array.isArray(eixosBanco)
    ? eixosBanco.filter((e): e is string => typeof e === "string" && !!e.trim())
    : [];
  const usaEixos =
    nomes.length > 0 && skus.length > 0 && skus.every((s) => nomes.every((n) => s.opcoes?.[n]));
  const eixosFinais = usaEixos ? nomes : skus.length ? ["Opção"] : [];
  const opcoesDe = (s: SkuDoBanco): Record<string, string> =>
    usaEixos ? Object.fromEntries(nomes.map((n) => [n, s.opcoes![n]])) : { Opção: s.variacao };

  const eixos = eixosFinais.map((nome) => {
    const valores = [...new Set(skus.map((s) => opcoesDe(s)[nome]))];
    return novoEixo(nome, valores.join(", "));
  });
  const combinacoes: CombinacaoEditavel[] = skus.map((s) => {
    const opcoes = opcoesDe(s);
    return {
      chave: chaveDaCombinacao(eixosFinais.map((n) => opcoes[n])),
      id: s.id,
      nome: s.variacao,
      opcoes,
      preco: s.preco_venda == null ? "" : String(s.preco_venda),
      fotoPath: s.foto_path,
      inicial: "",
      saldo: s.saldo,
    };
  });
  return { eixos, combinacoes };
}

/** O motivo que impede salvar, no português da tela. Null quando está tudo certo. */
export function problemaDasCombinacoes(
  eixos: EixoEditavel[],
  combinacoes: CombinacaoEditavel[],
): string | null {
  const preenchidos = eixos.filter((e) => e.nome.trim() || e.valores.trim());
  if (preenchidos.some((e) => !e.nome.trim()))
    return "Dê um nome pra cada opção, como Cor ou Tamanho.";
  if (preenchidos.some((e) => !separarValores(e.valores).length))
    return "Escreva os valores de cada opção, separados por vírgula.";
  if (preenchidos.length > MAX_EIXOS) return `O produto pode ter até ${MAX_EIXOS} opções.`;
  const nomes = preenchidos.map((e) => normalizar(e.nome));
  if (new Set(nomes).size !== nomes.length) return "Tem duas opções com o mesmo nome.";
  if (
    preenchidos.some(
      (e) =>
        e.nome.trim().length > MAX_TEXTO_OPCAO ||
        separarValores(e.valores).some((v) => v.length > MAX_TEXTO_OPCAO),
    )
  )
    return `Nome e valor de opção vão até ${MAX_TEXTO_OPCAO} letras.`;
  const total = preenchidos.reduce((t, e) => t * separarValores(e.valores).length, 1);
  if (preenchidos.length && total > MAX_COMBINACOES)
    return `São ${total} combinações, e o limite é ${MAX_COMBINACOES}. Tire alguns valores.`;
  if (combinacoes.some((c) => c.nome.length > MAX_NOME_COMBINACAO))
    return "Alguma combinação ficou com o nome longo demais. Encurte os valores.";
  if (combinacoes.some((c) => c.preco.trim() && !(Number(c.preco) >= 0)))
    return "Confira o preço das combinações.";
  return null;
}

const inteiro = (s: string) => {
  const v = Number(s);
  return Number.isInteger(v) && v >= 0 ? v : 0;
};

/** Os parâmetros da salvar_combinacoes_loja. Quantidade de combinação que já existe não vai junto. */
export function corpoParaSalvar(
  eixos: EixoEditavel[],
  combinacoes: CombinacaoEditavel[],
  controla: boolean,
  inicialPadrao: string,
) {
  return {
    p_controla: controla,
    p_eixos: eixosValidos(eixos).map((e) => e.nome),
    p_combinacoes: combinacoes.map((c) => ({
      id: c.id ?? null,
      opcoes: c.opcoes,
      preco: c.preco.trim() ? Number(c.preco) : null,
      foto_path: c.fotoPath,
      inicial: c.id || !controla ? 0 : inteiro(c.inicial),
    })),
    p_inicial_padrao: controla ? inteiro(inicialPadrao) : 0,
  };
}

/** Endereço da categoria na loja: minúsculo, sem acento, até 60 letras. */
export function slugDaCategoria(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}
