// Regras puras do sino de avisos e da janela de Novidades (ONE-152, 29/10/2026).
// O banco cria os avisos (pedido novo da loja, resposta do suporte); as
// novidades são uma lista só pra todo mundo, com o "já li" por conta.

export type TipoAviso = "pedido" | "chamado" | "novidade";

export interface LinhaAviso {
  id: string;
  tipo: "pedido" | "chamado";
  titulo: string;
  corpo: string | null;
  valor: number | null;
  link: string | null;
  lido_em: string | null;
  created_at: string;
}

export interface Novidade {
  id: string;
  titulo: string;
  texto: string;
  imagem_url: string | null;
  link: string | null;
  link_rotulo: string | null;
  publicada_em: string;
}

/** Item que o sino mostra: aviso da conta ou novidade da Pólia One. */
export interface ItemSino {
  chave: string;
  id: string;
  tipo: TipoAviso;
  titulo: string;
  corpo: string | null;
  valor: number | null;
  link: string | null;
  lido: boolean;
  quando: string;
}

/**
 * Novidade que conta pra quem tem conta: só a publicada depois que a conta
 * existe. Quem chega hoje não recebe a fila inteira do que saiu antes dela.
 */
export function novidadesDaConta(novidades: Novidade[], contaCriadaEm: string | null | undefined): Novidade[] {
  const desde = contaCriadaEm ? Date.parse(contaCriadaEm) : NaN;
  if (Number.isNaN(desde)) return novidades;
  return novidades.filter((n) => Date.parse(n.publicada_em) >= desde);
}

/** Avisos e novidades num feed só, do mais novo pro mais antigo. */
export function itensDoSino(avisos: LinhaAviso[], novidades: Novidade[], lidas: ReadonlySet<string>): ItemSino[] {
  const deAvisos: ItemSino[] = avisos.map((a) => ({
    chave: `aviso-${a.id}`,
    id: a.id,
    tipo: a.tipo,
    titulo: a.titulo,
    corpo: a.corpo,
    valor: a.valor === null ? null : Number(a.valor),
    link: a.link,
    lido: a.lido_em !== null,
    quando: a.created_at,
  }));
  const deNovidades: ItemSino[] = novidades.map((n) => ({
    chave: `novidade-${n.id}`,
    id: n.id,
    tipo: "novidade",
    titulo: n.titulo,
    corpo: n.texto,
    valor: null,
    link: n.link,
    lido: lidas.has(n.id),
    quando: n.publicada_em,
  }));
  return [...deAvisos, ...deNovidades].sort((a, b) => Date.parse(b.quando) - Date.parse(a.quando));
}

export const contarNaoLidos = (itens: ItemSino[]) => itens.filter((i) => !i.lido).length;

/** Número do sino: acima de 9 vira "9+", pra caber na bolinha. */
export const rotuloContador = (n: number) => (n > 9 ? "9+" : String(n));

/** Novidades que a janela ainda precisa mostrar, da mais nova pra mais antiga. */
export function novidadesPendentes(novidades: Novidade[], lidas: ReadonlySet<string>): Novidade[] {
  return novidades
    .filter((n) => !lidas.has(n.id))
    .sort((a, b) => Date.parse(b.publicada_em) - Date.parse(a.publicada_em));
}

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias" ou a data. */
export function quandoFoi(iso: string, agora: Date = new Date()): string {
  const diffMin = Math.floor((agora.getTime() - Date.parse(iso)) / 60000);
  if (Number.isNaN(diffMin) || diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "ontem";
  if (diffD < 7) return `há ${diffD} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
