import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { emailPolia, escapeHtml } from "@/lib/email-template";

const inputSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  assunto: z.string().trim().min(1).max(120),
  mensagem: z.string().trim().min(10).max(2000),
  // Honeypot: campo invisível que só um bot preenche. Vindo preenchido,
  // fingimos sucesso sem gravar nem notificar.
  hp: z.string().optional(),
});

function resendApiKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[Contato] Missing RESEND_API_KEY environment variable.");
    throw new Error("Missing RESEND_API_KEY environment variable.");
  }
  return key;
}

export const enviarContato = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.hp) return { ok: true };

    const { error } = await supabaseAdmin.from("contatos").insert({
      nome: data.nome,
      email: data.email,
      assunto: data.assunto,
      mensagem: data.mensagem,
    });
    if (error) {
      console.error("[Contato] Falha ao gravar contato:", error);
      return { ok: false };
    }

    // Notificação por e-mail é best-effort: o contato já está salvo e visível
    // no painel admin mesmo se o Resend falhar, então não derrubamos a resposta.
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Pólia <naoresponda@usepolia.com.br>",
          to: ["oi@usepolia.com.br"],
          reply_to: data.email,
          subject: `[Contato] ${data.assunto} — ${data.nome}`,
          text: `${data.mensagem}\n\n—\n${data.nome} <${data.email}>`,
          html: emailPolia({
            preheader: escapeHtml(`${data.assunto} — ${data.nome}`),
            headline: escapeHtml(data.assunto),
            paragrafos: [
              escapeHtml(data.mensagem).replace(/\n/g, "<br />"),
              `— ${escapeHtml(data.nome)} &lt;${escapeHtml(data.email)}&gt;`,
            ],
          }),
        }),
      });
      if (!resp.ok) {
        console.error("[Contato] Falha ao notificar por e-mail:", await resp.text());
      }
    } catch (err) {
      console.error("[Contato] Erro ao notificar por e-mail:", err);
    }

    return { ok: true };
  });
