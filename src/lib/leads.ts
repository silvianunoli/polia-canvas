// Regras de Clientes e leads (VND-04, Fase 2). Puro: não conhece Supabase nem
// React. Lead é cliente nos status de "Antes do pedido" (ou sem status); não
// existe tabela separada. WhatsApp é guardado só em dígitos, com o 55, igual
// ao check clientes_whatsapp_check da migration 20261023230000.

import { emNegociacao } from "@/lib/statusCliente";

export const ORIGENS = [
  "instagram",
  "whatsapp",
  "indicacao",
  "feira",
  "site",
  "link",
  "tiktok",
  "outro",
] as const;
export type Origem = (typeof ORIGENS)[number];

export const ORIGEM_LABEL: Record<Origem, string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  indicacao: "Indicação",
  feira: "Feira ou presencial",
  site: "Site",
  link: "Link de captura",
  tiktok: "TikTok",
  outro: "Outro",
};

/** Origens que a dona escolhe à mão; "link" só entra pelo próprio link. */
export const ORIGENS_MANUAIS: Origem[] = ORIGENS.filter((o) => o !== "link");

/**
 * Número brasileiro em dígitos com 55: "(11) 98888-0000" vira "5511988880000".
 * Aceita com ou sem 55, com ou sem o 9 do celular. null quando não dá pra ser
 * um número brasileiro (a tela pede pra conferir).
 */
export function normalizarWhatsapp(entrada: string): string | null {
  let d = entrada.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (d.length === 11 && d[2] !== "9") return null;
  return `55${d}`;
}

/** "5511988880000" vira "(11) 98888-0000". Entrada fora do padrão volta igual. */
export function formatarWhatsapp(digitos: string): string {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digitos);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : digitos;
}

/** Endereço do link a partir do nome da marca: "Canecas da Aimer" vira "canecas-da-aimer". */
export function sugerirSlug(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base.length >= 3 ? base : "";
}

/** Mesmo check do banco: 3 a 40, letras minúsculas, números e hífen no meio. */
export function slugValido(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug);
}

/** Lead = antes do pedido, ou ainda sem status. */
export function ehLead(status: string | null | undefined): boolean {
  return !status || emNegociacao(status);
}

export interface ClienteResumo {
  id: string;
  status_pedido: string | null;
  origem: string | null;
  created_at: string;
  venda_registrada: boolean;
  novo: boolean;
}

export interface ResumoLeads {
  /** Fichas criadas no mês. */
  novosNoMes: number;
  /** Das criadas no mês, quantas vieram pelo link. */
  peloLink: number;
  /** Das criadas no mês, quantas já passaram do "Antes do pedido". */
  viraramCliente: number;
  /** Chegaram pelo link e a dona ainda não abriu. */
  naoVistos: number;
  /** Origem com mais fichas no mês (null sem origem nenhuma). */
  origemMaisComum: Origem | null;
  /** Origem que mais trouxe dinheiro, pelo total comprado (null sem compra). */
  origemQueMaisCompra: Origem | null;
}

/**
 * Números do topo de Clientes. `mesISO` é "AAAA-MM". `compradoPorCliente`
 * vem das vendas (cliente_id → total), pra saber de onde vem quem compra.
 */
export function resumoLeads(
  clientes: readonly ClienteResumo[],
  mesISO: string,
  compradoPorCliente: ReadonlyMap<string, number> = new Map(),
): ResumoLeads {
  const doMes = clientes.filter((c) => c.created_at.slice(0, 7) === mesISO);
  const contagem = new Map<Origem, number>();
  for (const c of doMes) {
    if (c.origem && (ORIGENS as readonly string[]).includes(c.origem)) {
      const o = c.origem as Origem;
      contagem.set(o, (contagem.get(o) ?? 0) + 1);
    }
  }
  const dinheiro = new Map<Origem, number>();
  for (const c of clientes) {
    const total = compradoPorCliente.get(c.id) ?? 0;
    if (total > 0 && c.origem && (ORIGENS as readonly string[]).includes(c.origem)) {
      const o = c.origem as Origem;
      dinheiro.set(o, (dinheiro.get(o) ?? 0) + total);
    }
  }
  const maior = (m: Map<Origem, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;

  return {
    novosNoMes: doMes.length,
    peloLink: doMes.filter((c) => c.origem === "link").length,
    viraramCliente: doMes.filter((c) => !ehLead(c.status_pedido) || c.venda_registrada).length,
    naoVistos: clientes.filter((c) => c.novo).length,
    origemMaisComum: maior(contagem),
    origemQueMaisCompra: maior(dinheiro),
  };
}

export type FiltroGrupo = "todas" | "leads" | "pedido" | "depois";

/** Filtro de grupo da lista de Clientes. */
export function noGrupo(status: string | null | undefined, grupo: FiltroGrupo): boolean {
  if (grupo === "todas") return true;
  if (grupo === "leads") return ehLead(status);
  if (grupo === "depois") return status === "Pós-venda";
  return !ehLead(status) && status !== "Pós-venda";
}
