import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verificarTurnstileServer } from "@/lib/turnstile.server";
import { normalizarWhatsapp, slugValido } from "@/lib/leads";
import { rotaLiberada } from "@/lib/planos";

// Link de captura (/l/<slug>, VND-04). A pessoa não tem login: links_captura e
// clientes não têm policy pra anon, então a leitura e o envio acontecem aqui,
// pelo service role, no mesmo padrão do orçamento público
// (orcamentos.functions.ts). A resposta leva só o que a página mostra: nada de
// user_id nem de dado de outra cliente.

const slugSchema = z.object({ slug: z.string().min(3).max(40) });

export interface LinkPublico {
  titulo: string | null;
  pergunta: string | null;
  /** Nome de marca é obrigatório pro link abrir (nunca o nome pessoal da dona). */
  marca: { nome: string; logoUrl: string | null; cor: string | null };
}

export type LeituraLink = { ok: true; link: LinkPublico } | { ok: false };

export const lerLinkPublico = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => slugSchema.parse(input))
  .handler(async ({ data }): Promise<LeituraLink> => {
    const slug = data.slug.toLowerCase();
    if (!slugValido(slug)) return { ok: false };
    const { data: link, error } = await supabaseAdmin
      .from("links_captura")
      .select("user_id, titulo, pergunta")
      .eq("slug", slug)
      .eq("ativo", true)
      .maybeSingle();
    if (error) console.error("[Captura] leitura", error);
    if (!link) return { ok: false };

    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("business_name, logo_path, cor_marca, plano")
      .eq("id", link.user_id)
      .maybeSingle();
    // Conta que saiu do plano pago some igual a link desligado. Sem nome de
    // marca também: o aceite tem que dizer de quem são as mensagens (LGPD).
    if (!perfil || !rotaLiberada("/clientes", perfil.plano)) return { ok: false };
    const nome = perfil.business_name?.trim();
    if (!nome) return { ok: false };

    const logoUrl = perfil.logo_path
      ? supabaseAdmin.storage.from("marca-logos").getPublicUrl(perfil.logo_path).data.publicUrl
      : null;
    return {
      ok: true,
      link: {
        titulo: link.titulo,
        pergunta: link.pergunta,
        marca: {
          nome,
          logoUrl,
          cor: perfil.cor_marca ?? null,
        },
      },
    };
  });

const envioSchema = slugSchema.extend({
  nome: z.string().trim().min(1).max(120),
  whatsapp: z.string().max(30),
  interesse: z.string().max(500).optional(),
  consentimento: z.boolean(),
  turnstileToken: z.string().optional(),
  // Honeypot: campo invisível que só robô preenche.
  hp: z.string().optional(),
});

export type ResultadoEnvio =
  | { ok: true }
  | { ok: false; motivo: "turnstile" | "whatsapp" | "indisponivel" | "limite" | "erro" };

export const enviarLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => envioSchema.parse(input))
  .handler(async ({ data }): Promise<ResultadoEnvio> => {
    // Honeypot preenchido: erro, não sucesso falso (mesmo motivo do orçamento).
    if (data.hp) return { ok: false, motivo: "erro" };
    const whatsapp = normalizarWhatsapp(data.whatsapp);
    if (!whatsapp) return { ok: false, motivo: "whatsapp" };
    if (!(await verificarTurnstileServer(data.turnstileToken))) {
      return { ok: false, motivo: "turnstile" };
    }
    const { data: r, error } = await supabaseAdmin.rpc("capturar_lead", {
      p_ip_hash: await hashDoAparelho(),
      p_slug: data.slug.toLowerCase(),
      p_nome: data.nome,
      p_whatsapp: whatsapp,
      p_interesse: data.interesse?.trim() || null,
      p_consentimento: data.consentimento,
    });
    if (error) {
      console.error("[Captura] envio", error);
      return { ok: false, motivo: "erro" };
    }
    if (r === "ok") return { ok: true };
    if (r === "limite") return { ok: false, motivo: "limite" };
    return { ok: false, motivo: "indisponivel" };
  });

/**
 * Hash do IP com o dia junto: serve pro teto de envios por aparelho e não
 * guarda o IP (com o dia no meio, o mesmo IP vira outro hash amanhã).
 */
async function hashDoAparelho(): Promise<string | null> {
  const ip = getRequest()?.headers.get("cf-connecting-ip");
  if (!ip) return null;
  const dia = new Date().toISOString().slice(0, 10);
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`lead|${dia}|${ip}`),
  );
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
