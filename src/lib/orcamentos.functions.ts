import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verificarTurnstileServer } from "@/lib/turnstile.server";
import { enviarEmailResend, emailPolia, escapeHtml } from "@/lib/email-template";
import { hojeEmBrasilia } from "@/lib/data.functions";
import { formatarReais } from "@/lib/formatarReais";
import { urlCanonica } from "@/lib/seo";
import type { StatusOrcamento } from "@/lib/orcamentos";

// Página pública do orçamento (/o/<token>, ONE-129). A cliente não tem login:
// orcamentos não tem policy pra anon, então a leitura e a aprovação acontecem
// aqui, pelo service role, achando a linha só pelo link_token (uuid aleatório).
// Mesmo padrão de manual.functions.ts e quiz.functions.ts. A resposta leva só
// o que a página mostra: nada de user_id, cliente_id, contato ou custo.

const tokenSchema = z.object({ token: z.string().uuid() });

export interface OrcamentoPublico {
  numero: number;
  clienteNome: string | null;
  itens: { nome: string; variacao: string | null; quantidade: number; precoUnitario: number }[];
  subtotal: number;
  desconto: number;
  frete: number;
  total: number;
  validade: string;
  observacao: string | null;
  status: StatusOrcamento;
  criadoEm: string;
  vencido: boolean;
  /** updated_at: aprovar só vale pra versão que a cliente está vendo. */
  versao: string;
  /** Sem nome de marca cadastrado fica null (nunca o nome pessoal da dona). */
  marca: { nome: string | null; logoUrl: string | null; cor: string | null };
}

export type ResultadoLeitura = { ok: true; orcamento: OrcamentoPublico } | { ok: false };

type ItemBanco = {
  produto_nome?: string;
  variacao?: string | null;
  quantidade?: number;
  preco_unitario?: number;
};

async function marcaDaDona(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("business_name, logo_path, cor_marca")
    .eq("id", userId)
    .maybeSingle();
  const logoUrl = data?.logo_path
    ? supabaseAdmin.storage.from("marca-logos").getPublicUrl(data.logo_path).data.publicUrl
    : null;
  return {
    nome: data?.business_name?.trim() || null,
    logoUrl,
    cor: data?.cor_marca ?? null,
  };
}

export const lerOrcamentoPublico = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }): Promise<ResultadoLeitura> => {
    const { data: o, error } = await supabaseAdmin
      .from("orcamentos")
      .select(
        "user_id, numero, cliente_nome, itens, subtotal, desconto, frete, total, validade, observacao, status, created_at, updated_at",
      )
      .eq("link_token", data.token)
      .maybeSingle();
    if (error) console.error("[Orçamento] leitura pública", error);
    if (!o) return { ok: false };

    const itens = ((o.itens ?? []) as ItemBanco[]).map((i) => ({
      nome: String(i.produto_nome ?? ""),
      variacao: typeof i.variacao === "string" ? i.variacao : null,
      quantidade: Number(i.quantidade ?? 0),
      precoUnitario: Number(i.preco_unitario ?? 0),
    }));

    return {
      ok: true,
      orcamento: {
        numero: o.numero,
        clienteNome: o.cliente_nome,
        itens,
        subtotal: Number(o.subtotal),
        desconto: Number(o.desconto),
        frete: Number(o.frete),
        total: Number(o.total),
        validade: o.validade,
        observacao: o.observacao,
        status: o.status as StatusOrcamento,
        criadoEm: o.created_at,
        vencido: o.status === "enviado" && o.validade < hojeEmBrasilia(),
        versao: o.updated_at,
        marca: await marcaDaDona(o.user_id),
      },
    };
  });

const aprovarSchema = tokenSchema.extend({
  /** updated_at que a página leu: se a dona mudou o orçamento, não aprova. */
  versao: z.string().max(40),
  turnstileToken: z.string().optional(),
  // Honeypot: campo invisível que só bot preenche.
  hp: z.string().optional(),
});

export type ResultadoAprovacao =
  | { ok: true }
  | { ok: false; motivo: "turnstile" | "vencido" | "cancelado" | "mudou" | "erro" };

export const aprovarOrcamento = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => aprovarSchema.parse(input))
  .handler(async ({ data }): Promise<ResultadoAprovacao> => {
    // Honeypot preenchido: erro, não sucesso falso. Se um preenchimento
    // automático cair nele, a cliente vê que não foi e tenta de novo, em vez
    // de achar que aprovou (revisão de 23/10).
    if (data.hp) return { ok: false, motivo: "erro" };
    if (!(await verificarTurnstileServer(data.turnstileToken))) {
      return { ok: false, motivo: "turnstile" };
    }

    // Só muda de enviado pra aprovado, dentro da validade e na versão que a
    // cliente viu: o filtro no update é a trava (dois cliques, ou duas abas,
    // aprovam uma vez só). O gatilho do banco só aceita aprovado vindo daqui.
    const { data: aprovado, error } = await supabaseAdmin
      .from("orcamentos")
      .update({ status: "aprovado" })
      .eq("link_token", data.token)
      .eq("status", "enviado")
      .eq("updated_at", data.versao)
      .gte("validade", hojeEmBrasilia())
      .select("user_id, numero, cliente_nome, total")
      .maybeSingle();
    if (error) {
      console.error("[Orçamento] aprovação", error);
      return { ok: false, motivo: "erro" };
    }

    if (!aprovado) {
      // Nada mudou: descobre por quê, sem dizer se o token existe.
      const { data: atual } = await supabaseAdmin
        .from("orcamentos")
        .select("status, validade, updated_at")
        .eq("link_token", data.token)
        .maybeSingle();
      if (!atual) return { ok: false, motivo: "erro" };
      if (atual.status === "aprovado" || atual.status === "convertido") return { ok: true };
      if (atual.status === "cancelado") return { ok: false, motivo: "cancelado" };
      if (atual.validade < hojeEmBrasilia()) return { ok: false, motivo: "vencido" };
      return { ok: false, motivo: "mudou" };
    }

    await avisarDona(aprovado);
    return { ok: true };
  });

/** Best-effort: a aprovação já está gravada; e-mail que falha fica no log. */
async function avisarDona(o: {
  user_id: string;
  numero: number;
  cliente_nome: string | null;
  total: number;
}) {
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(o.user_id);
    const email = data.user?.email;
    if (!email) return;
    const quem = o.cliente_nome?.trim() || "A cliente";
    const valor = formatarReais(Number(o.total), { sempreCentavos: true });
    const link = urlCanonica("/vendas?aba=orcamentos");
    const headline = `${quem} aprovou o orçamento nº ${o.numero}.`;
    const paragrafos = [
      `O orçamento de ${valor} foi aprovado pelo link.`,
      "Agora é combinar o pagamento e a entrega. Quando a venda acontecer, é só abrir o orçamento na Pólia One e clicar em Virar venda: os itens já vão preenchidos.",
    ];
    await enviarEmailResend({
      to: [email],
      subject: headline,
      text: [headline, "", ...paragrafos, "", `Ver o orçamento: ${link}`].join("\n"),
      html: emailPolia({
        preheader: escapeHtml(`${valor} aprovados pelo link.`),
        rotulo: "Pólia One · Orçamento",
        headline: escapeHtml(headline),
        paragrafos: paragrafos.map(escapeHtml),
        ctaLabel: "Ver o orçamento",
        ctaUrl: link,
      }),
      replyTo: "oi@usepolia.com.br",
      contexto: "[Orçamento]",
    });
  } catch (e) {
    console.error("[Orçamento] aviso à dona", e);
  }
}
