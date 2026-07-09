import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { emailPolia, enviarEmailResend, escapeHtml } from "@/lib/email-template";

const inputSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  assunto: z.string().trim().min(1).max(120),
  mensagem: z.string().trim().min(10).max(2000),
  // Honeypot: campo invisível que só um bot preenche. Vindo preenchido,
  // fingimos sucesso sem gravar nem notificar.
  hp: z.string().optional(),
});

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
    await enviarEmailResend({
      to: ["oi@usepolia.com.br"],
      replyTo: data.email,
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
      contexto: "[Contato]",
    });

    return { ok: true };
  });
