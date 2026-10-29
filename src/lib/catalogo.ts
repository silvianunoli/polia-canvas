// Catálogo online como canal de venda (ONE-148, fase 1, 29/10/2026). Puro: não
// conhece Supabase nem HTTP. O pedido chega do site do catálogo (feito pela
// Pólia Lab; depois, montado pela dona no Premium), vira uma venda com
// andamento "A fazer" no quadro de Pedidos (registrar_pedido_catalogo, migration
// 20261029200000) e a cliente segue pro WhatsApp da loja como antes.
//
// A loja é o domínio do catálogo, sem www (canal_conexoes.shop_id). O Worker só
// aceita pedido vindo desse domínio ou de uma prévia da Pólia Lab.
import { z } from "zod";

/** Prévias da Pólia Lab moram em <projeto>.usepolia.workers.dev antes do domínio próprio. */
export const SUFIXO_PREVIA_LAB = ".usepolia.workers.dev";

const DOMINIO = /^(?=.{4,100}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

/** "https://www.LovelessCrochet.com.br/" vira "lovelesscrochet.com.br"; inválido vira null. */
export function normalizarDominio(entrada: string | null | undefined): string | null {
  let d = String(entrada ?? "").trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").replace(/:\d+$/, "").replace(/^www\./, "");
  return DOMINIO.test(d) ? d : null;
}

/**
 * O navegador da cliente só pode gravar pedido da loja de onde ela está: o
 * domínio do catálogo (com ou sem www) ou uma prévia da Pólia Lab.
 */
export function origemPermitida(origem: string | null | undefined, dominio: string): boolean {
  if (!origem) return false;
  let host: string;
  try {
    const u = new URL(origem);
    if (u.protocol !== "https:") return false;
    host = u.hostname.toLowerCase();
  } catch {
    return false;
  }
  return host === dominio || host === `www.${dominio}` || host.endsWith(SUFIXO_PREVIA_LAB);
}

/** Dígitos com DDI 55, no formato que clientes.whatsapp aceita (12 ou 13 dígitos). */
export function normalizarWhatsapp(entrada: string | null | undefined): string | null {
  const bruto = String(entrada ?? "").trim();
  // "+1 415..." tem 11 dígitos e passaria por celular brasileiro de DDD 14.
  if (bruto.startsWith("+") && !bruto.replace(/\s/g, "").startsWith("+55")) return null;
  let d = bruto.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return /^55[0-9]{10,11}$/.test(d) ? d : null;
}

const texto = (max: number) => z.string().trim().max(max);

export const pedidoCatalogoSchema = z.object({
  dominio: z.string().max(120),
  id: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  itens: z
    .array(
      z.object({
        nome: texto(200).min(1),
        variacao: texto(80).optional().nullable(),
        quantidade: z.number().int().min(1).max(1000),
        preco_unitario: z.number().min(0).max(100000),
      }),
    )
    .min(1)
    .max(50),
  cliente: z.object({
    nome: texto(120).min(1),
    whatsapp: z.string().max(30),
  }),
  entrega: z
    .object({
      tipo: texto(60).optional(),
      endereco: texto(300).optional(),
      presente_para: texto(120).optional(),
    })
    .optional(),
  observacao: texto(400).optional(),
  prazo_dias_uteis: z.number().int().min(1).max(60).optional(),
  /** Campo-isca: gente não vê, robô preenche. */
  site: z.string().max(0).optional(),
});
export type PedidoCatalogo = z.infer<typeof pedidoCatalogoSchema>;

/**
 * Observação que a dona lê no cartão do pedido (até 500 caracteres, o teto de
 * vendas.observacao). O que a cliente escreveu vem por último, porque é o que
 * mais cabe cortar.
 */
export function montarObservacao(p: PedidoCatalogo): string {
  const partes = ["Pedido pelo catálogo online."];
  if (p.entrega?.tipo) partes.push(`Entrega: ${p.entrega.tipo}.`);
  if (p.entrega?.endereco) partes.push(`Endereço: ${p.entrega.endereco}.`);
  if (p.entrega?.presente_para) partes.push(`Presente para ${p.entrega.presente_para}.`);
  if (p.observacao) partes.push(`Observação da cliente: ${p.observacao}`);
  const junto = partes.join(" ");
  return junto.length > 500 ? `${junto.slice(0, 499)}…` : junto;
}

export type ResultadoPedidoCatalogo = "ok" | "repetido" | "indisponivel" | "limite" | "invalido" | "erro";
