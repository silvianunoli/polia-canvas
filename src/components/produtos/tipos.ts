import type { CalculadoraBreakdown } from "@/lib/precificacao.functions";

export type ProdutoTipo = "fisico" | "digital" | "servico";

export interface PrecoHistorico {
  preco: number;
  data: string;
}

export interface Produto {
  id: string;
  user_id: string;
  nome: string;
  tipo: string;
  foto_url: string | null;
  preco_venda: number;
  preco_custo: number | null;
  descricao: string | null;
  /** Só pra dona da marca (código, fornecedor). Não sai em nada que a cliente vê. */
  observacao_interna: string | null;
  canal: string | null;
  /** Liga o estoque (VND-03). Nasce false. */
  controla_estoque: boolean;
  /** Aparece na Vitrine online (Pro). Liga na janela do produto desde 22/11/2026. */
  no_catalogo?: boolean;
  /** Na vitrine, a cliente escolhe a cor da paleta da loja (ONE-217). */
  usa_paleta?: boolean;
  /** Nome da cor que aparece na foto ("Cor da foto (Preto e branco)"). */
  cor_da_foto?: string | null;
  /** Com paleta: quantas cores a cliente pode misturar na vitrine (1 a 3). */
  max_cores?: number;
  /** Na vitrine, combinado pelo WhatsApp: preço (sem carrinho), cor, tamanho. */
  preco_sob_consulta?: boolean;
  cor_sob_consulta?: boolean;
  tamanho_sob_consulta?: boolean;
  /** Na vitrine: pronta entrega (sai sem prazo de produção). false = sob encomenda. */
  pronta_entrega?: boolean;
  /** Posição na lista e na loja (1 = primeiro). null = sem número, vai pelo cadastro mais recente. */
  catalogo_ordem?: number | null;
  /** Categoria da vitrine (produto_categorias). Também é a da Loja da marca. */
  categoria_id?: string | null;
  /** Preço promocional, o "por" (ONE-239). Vale quando menor que o preço de venda. */
  preco_promocional?: number | string | null;
  arquivado: boolean;
  preco_atualizado_em: string | null;
  historico_precos: PrecoHistorico[];
  calculadora_breakdown: CalculadoraBreakdown | null;
  created_at: string;
  updated_at: string;
}

export interface Prefill {
  nome?: string;
  preco_venda?: number;
  preco_custo?: number;
  tipo?: ProdutoTipo;
  calculadora_breakdown?: CalculadoraBreakdown;
}

export const TIPO_LABEL: Record<string, string> = {
  fisico: "Produto físico",
  digital: "Produto digital",
  servico: "Serviço",
};

// Dinheiro sempre com duas casas: sem isso o toLocaleString mostrava
// "R$ 44,1" (ONE-74).
export function fmt(v: number) {
  // Sinal antes do símbolo ("-R$ 2,91"), igual a formatarReais; antes saía "R$ -2,91".
  const corpo = Math.abs(v).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${v < 0 && corpo !== "0,00" ? "-" : ""}R$ ${corpo}`;
}

export function fmtData(iso: string) {
  // iso pode vir como ISO completo ou "YYYY-MM-DD"
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(
    2,
    "0",
  )}/${d.getFullYear()}`;
}

export function num(s: string) {
  const v = parseFloat(s.replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

// "Coloque um número." inline — negativo ou texto não-numérico num campo que
// já tem algo digitado (campo vazio não é erro, é só ainda-não-preenchido).
export function numInvalido(s: string): boolean {
  if (!s.trim()) return false;
  const v = parseFloat(s.replace(",", "."));
  return !Number.isFinite(v) || v < 0;
}

/** Busca do Catálogo de Produtos: sem diferença de maiúscula nem de acento ("lilas" acha "Lilás"). */
export function nomeBate(nome: string, busca: string): boolean {
  const limpa = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const b = limpa(busca);
  return !b || limpa(nome).includes(b);
}
