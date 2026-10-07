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
  canal: string | null;
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
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
