// Orçamentos (ONE-129). Puro: sem React nem Supabase. O banco recalcula os
// totais no gatilho orcamentos_antes_de_gravar (migration 20261023200000) com a
// mesma conta de totaisDoOrcamento; a tela mostra antes, o banco grava.

export type StatusOrcamento = "enviado" | "aprovado" | "convertido" | "cancelado";
/** O que a tela mostra: "vencido" é enviado com a validade passada. */
export type SituacaoOrcamento = StatusOrcamento | "vencido";

export interface ItemOrcamento {
  produto_id: string | null;
  sku_id: string | null;
  produto_nome: string;
  variacao: string | null;
  quantidade: number;
  preco_unitario: number;
}

export interface Orcamento {
  id: string;
  numero: number;
  clienteId: string | null;
  clienteNome: string | null;
  itens: ItemOrcamento[];
  subtotal: number;
  desconto: number;
  frete: number;
  total: number;
  validade: string; // AAAA-MM-DD
  observacao: string | null;
  status: StatusOrcamento;
  aprovadoEm: string | null;
  vendaId: string | null;
  linkToken: string;
  createdAt: string;
}

const centavos = (v: number) => Math.round(v * 100) / 100;

export function totaisDoOrcamento(o: {
  itens: Pick<ItemOrcamento, "quantidade" | "preco_unitario">[];
  desconto: number;
  frete: number;
}): { subtotal: number; total: number } {
  const subtotal = centavos(
    o.itens.reduce((s, i) => s + centavos(i.quantidade * i.preco_unitario), 0),
  );
  return { subtotal, total: Math.max(centavos(subtotal - o.desconto + o.frete), 0) };
}

export function situacaoDoOrcamento(
  o: Pick<Orcamento, "status" | "validade">,
  hoje: string,
): SituacaoOrcamento {
  if (o.status === "enviado" && o.validade < hoje) return "vencido";
  return o.status;
}

export const ROTULO_SITUACAO: Record<SituacaoOrcamento, string> = {
  enviado: "Esperando a cliente",
  aprovado: "Aprovado pela cliente",
  convertido: "Virou venda",
  cancelado: "Cancelado",
  vencido: "Vencido",
};

/** Ainda dá pra transformar em venda (aprovado ou à espera, mesmo vencido). */
export function podeVirarVenda(o: Pick<Orcamento, "status">): boolean {
  return o.status === "enviado" || o.status === "aprovado";
}

/** AAAA-MM-DD somado de dias, sem fuso (data de calendário). */
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

export const VALIDADE_PADRAO_DIAS = 7;

export type ErroOrcamento =
  | "sem_itens"
  | "item_sem_produto"
  | "quantidade_invalida"
  | "preco_invalido"
  | "desconto_maior"
  | "valor_negativo"
  | "validade_passada";

export function validarOrcamento(
  o: {
    itens: Pick<ItemOrcamento, "produto_nome" | "quantidade" | "preco_unitario">[];
    desconto: number;
    frete: number;
    validade: string;
  },
  hoje: string,
): ErroOrcamento | null {
  if (o.itens.length === 0) return "sem_itens";
  for (const i of o.itens) {
    if (!i.produto_nome.trim()) return "item_sem_produto";
    if (!Number.isInteger(i.quantidade) || i.quantidade < 1 || i.quantidade > 999_999)
      return "quantidade_invalida";
    if (!(i.preco_unitario >= 0) || centavos(i.preco_unitario) !== i.preco_unitario)
      return "preco_invalido";
  }
  if (o.desconto < 0 || o.frete < 0) return "valor_negativo";
  if (o.desconto > totaisDoOrcamento(o).subtotal) return "desconto_maior";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.validade) || o.validade < hoje) return "validade_passada";
  return null;
}

function contrastes(hex: string): { branco: number; tinta: number } | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum =
    0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
  // Tinta do projeto (--ink, quase preto): luminância ~0,003.
  return { branco: 1.05 / (lum + 0.05), tinta: (lum + 0.05) / 0.053 };
}

/**
 * Cor do texto em cima da cor da marca: tinta em cor clara, branco em cor
 * escura. Contraste WCAG contra os dois, fica o maior.
 */
export function textoSobreCor(hex: string): "escuro" | "claro" {
  const c = contrastes(hex);
  if (!c) return "escuro";
  return c.tinta >= c.branco ? "escuro" : "claro";
}

/**
 * Como a cor da marca entra no orçamento. "fundo": a cor pinta o topo e o
 * botão, com texto legível em cima (contraste AA, 4,5:1). "faixa": cor de meio
 * de escala, em que nem tinta nem branco passam; ela vira só uma faixa e o
 * texto fica no fundo neutro (revisão de 23/10).
 */
export function usoDaCor(hex: string | null): {
  modo: "nenhum" | "fundo" | "faixa";
  texto: "escuro" | "claro";
} {
  const c = hex ? contrastes(hex) : null;
  if (!c) return { modo: "nenhum", texto: "escuro" };
  const texto = c.tinta >= c.branco ? "escuro" : "claro";
  return { modo: Math.max(c.tinta, c.branco) >= 4.5 ? "fundo" : "faixa", texto };
}

export function mensagemWhatsApp(p: {
  marca: string | null;
  numero: number;
  clienteNome: string | null;
  link: string;
}): string {
  const oi = p.clienteNome ? `Oi, ${p.clienteNome.split(" ")[0]}.` : "Oi.";
  const de = p.marca ? ` de ${p.marca}` : "";
  return `${oi} Segue o orçamento nº ${p.numero}${de}: ${p.link}\nPor ali dá pra ver os itens e aprovar.`;
}
