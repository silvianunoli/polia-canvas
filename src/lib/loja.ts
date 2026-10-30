// Loja do catálogo próprio no Pro (ONE-148, fases 2 e 3, 29/10/2026). Puro:
// não conhece Supabase nem React. A dona configura em /catalogo e a cliente
// compra em /loja/<endereço>. O pedido entra em Pedidos pela
// registrar_pedido_loja (migration 20261029230000), com o preço do cadastro.
import { z } from "zod";
import { normalizarWhatsapp, slugValido } from "@/lib/leads";

export { slugValido };

export const MAX_FOTOS_PRODUTO = 4;
export const FOTO_TIPOS = ["image/png", "image/jpeg", "image/webp"] as const;
export const FOTO_MAX_BYTES = 3 * 1024 * 1024;

/** O que a dona configura na tela Catálogo (vazio vira null no banco). */
export const configLojaSchema = z.object({
  slug: z.string().trim().toLowerCase().refine(slugValido, "Use de 3 a 40 letras, números ou hífen."),
  ativo: z.boolean(),
  chamada: z.string().trim().max(120).optional(),
  subchamada: z.string().trim().max(300).optional(),
  corDestaque: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .or(z.literal("")),
  whatsapp: z.string().max(30).optional(),
  instagram: z
    .string()
    .trim()
    .transform((s) => s.replace(/^@/, ""))
    .refine((s) => s === "" || /^[A-Za-z0-9._]{1,30}$/.test(s), "Confira o @ do Instagram.")
    .optional(),
  prazoDiasUteis: z.number().int().min(1).max(60),
  sinalPercentual: z.number().int().min(0).max(100),
  entregaTexto: z.string().trim().max(200).optional(),
  pedeEndereco: z.boolean(),
  aviso: z.string().trim().max(300).optional(),
});
export type ConfigLoja = z.infer<typeof configLojaSchema>;

/** Linha do banco a partir do que a tela mandou. WhatsApp inválido volta null (a tela avisa antes). */
export function linhaDaConfig(c: ConfigLoja) {
  const vazio = (s: string | undefined) => (s && s.trim() ? s.trim() : null);
  return {
    slug: c.slug,
    ativo: c.ativo,
    chamada: vazio(c.chamada),
    subchamada: vazio(c.subchamada),
    cor_destaque: vazio(c.corDestaque),
    whatsapp: c.whatsapp ? normalizarWhatsapp(c.whatsapp) : null,
    instagram: vazio(c.instagram),
    prazo_dias_uteis: c.prazoDiasUteis,
    sinal_percentual: c.sinalPercentual,
    entrega_texto: vazio(c.entregaTexto),
    pede_endereco: c.pedeEndereco,
    aviso: vazio(c.aviso),
  };
}

export interface VariacaoLoja {
  id: string;
  nome: string;
}

export interface ProdutoLoja {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  fotos: string[];
  variacoes: VariacaoLoja[];
}

/** Só o que a loja pública mostra: sem user_id, custo, estoque ou dado de cliente. */
export interface LojaPublica {
  slug: string;
  nome: string;
  logoUrl: string | null;
  capaUrl: string | null;
  cor: string | null;
  chamada: string | null;
  subchamada: string | null;
  whatsapp: string | null;
  instagram: string | null;
  prazoDiasUteis: number;
  sinalPercentual: number;
  entregaTexto: string | null;
  pedeEndereco: boolean;
  aviso: string | null;
  produtos: ProdutoLoja[];
}

/** Pedido que a loja manda: produto, variação e quantidade. Preço e nome saem do banco. */
export const pedidoLojaSchema = z.object({
  slug: z.string().min(3).max(40),
  id: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  itens: z
    .array(
      z.object({
        produtoId: z.string().uuid(),
        skuId: z.string().uuid().nullable().optional(),
        quantidade: z.number().int().min(1).max(1000),
      }),
    )
    .min(1)
    .max(50),
  cliente: z.object({ nome: z.string().trim().min(1).max(120), whatsapp: z.string().max(30) }),
  endereco: z.string().trim().max(300).optional(),
  presentePara: z.string().trim().max(120).optional(),
  observacao: z.string().trim().max(400).optional(),
  turnstileToken: z.string().optional(),
  /** Campo-isca: gente não vê, robô preenche. */
  hp: z.string().optional(),
});
export type PedidoLoja = z.infer<typeof pedidoLojaSchema>;

/** Observação do cartão do pedido (até 500, o teto de vendas.observacao). */
export function observacaoDoPedidoLoja(p: Pick<PedidoLoja, "endereco" | "presentePara" | "observacao">): string {
  const partes = ["Pedido pela loja da Pólia One."];
  if (p.endereco) partes.push(`Endereço: ${p.endereco}.`);
  if (p.presentePara) partes.push(`Presente para ${p.presentePara}.`);
  if (p.observacao) partes.push(`Observação da cliente: ${p.observacao}`);
  const junto = partes.join(" ");
  return junto.length > 500 ? `${junto.slice(0, 499)}…` : junto;
}

export type ResultadoPedidoLoja =
  | { ok: true; repetido: boolean }
  | { ok: false; motivo: "turnstile" | "whatsapp" | "indisponivel" | "limite" | "invalido" | "erro" };

/** "R$ 189" / "R$ 144,50": o jeito que a loja escreve preço. */
export function reais(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Mensagem do WhatsApp que a cliente manda depois de confirmar (o pedido já está salvo). */
export function mensagemDoPedido(
  loja: Pick<LojaPublica, "nome" | "sinalPercentual">,
  itens: Array<{ nome: string; variacao: string | null; quantidade: number; preco: number }>,
  dados: { nome: string; whatsapp: string; endereco?: string; presentePara?: string; observacao?: string },
): string {
  const sub = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const linhas = [`*Pedido pela loja da ${loja.nome}*`, "", `Nome: ${dados.nome}`, `WhatsApp: ${dados.whatsapp}`];
  if (dados.endereco) linhas.push(`Endereço: ${dados.endereco}`);
  if (dados.presentePara) linhas.push(`Presente para: ${dados.presentePara}`);
  linhas.push("", "*Itens*");
  for (const i of itens) linhas.push(`- ${i.nome}${i.variacao ? `, ${i.variacao}` : ""} x${i.quantidade}: ${reais(i.preco * i.quantidade)}`);
  linhas.push("", `*Total: ${reais(sub)}*`);
  if (loja.sinalPercentual) linhas.push(`Sinal de ${loja.sinalPercentual}% pra começar: ${reais((sub * loja.sinalPercentual) / 100)}`);
  if (dados.observacao) linhas.push("", `Observações: ${dados.observacao}`);
  return linhas.join("\n");
}
