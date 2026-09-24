import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verificarTurnstileServer } from "@/lib/turnstile.server";
import { normalizarTelefone } from "@/lib/telefone";
import { enviarEmailResend } from "@/lib/email-template";
import { urlCanonica } from "@/lib/seo";
import { CONSENT_TEXTO_MANUAL } from "@/lib/manual/conteudo";
import { montarEmailManual } from "@/lib/manual/email";
import { urlDownloadManual } from "@/lib/manual/download";

// Gravação do lead do manual gratuito (/manual). Mesmo padrão de
// quiz.functions.ts: a RLS de manual_leads é deny-all, então a escrita só
// acontece aqui, pelo service role, com o Turnstile validado no SERVIDOR.

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  // WhatsApp opcional (CRM-08, 18/09/2026): quem quiser deixar, deixa.
  telefone: z.string().trim().max(40).optional(),
  consentimento: z.literal(true),
  origem: z
    .string()
    .trim()
    .max(40)
    .regex(/^[a-z0-9_-]+$/i)
    .optional(),
  turnstileToken: z.string().optional(),
  // Honeypot: campo invisível que só bot preenche. Vindo preenchido, fingimos
  // sucesso sem gravar nada.
  hp: z.string().optional(),
});

export type ResultadoManual =
  | { ok: true; downloadUrl: string; eventId?: string }
  | { ok: false; motivo: "turnstile" | "erro" };

export const gravarLeadManual = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<ResultadoManual> => {
    // O bot recebe um link que não abre nada: token aleatório sem linha no banco.
    if (data.hp) return { ok: true, downloadUrl: urlDownloadManual(crypto.randomUUID()) };

    if (!(await verificarTurnstileServer(data.turnstileToken))) {
      return { ok: false, motivo: "turnstile" };
    }

    // Descobre ANTES do upsert se o e-mail já tinha lead: pedir o manual de
    // novo sempre reenvia o PDF, mas não deve contar como um novo Lead pro
    // anúncio (senão a mesma pessoa infla o Lead várias vezes).
    const { data: existente } = await supabaseAdmin
      .from("manual_leads")
      .select("email")
      .eq("email", data.email)
      .maybeSingle();
    const leadNovo = !existente;

    // Upsert por e-mail: pedir de novo atualiza a linha, nunca duplica.
    // created_at e os dois tokens ficam de fora do payload de propósito: em
    // conflito o Postgres só sobrescreve as colunas listadas, então a data da
    // primeira captura e os links já enviados por e-mail sobrevivem.
    //
    // descadastrado_em volta a null: quem pediu de novo marcou o consentimento
    // outra vez, agora. É consentimento novo e explícito.
    const { data: linha, error } = await supabaseAdmin
      .from("manual_leads")
      .upsert(
        {
          email: data.email,
          origem: data.origem ?? "instagram_bio",
          consentimento: true,
          consent_texto: CONSENT_TEXTO_MANUAL,
          descadastrado_em: null,
          // Só entra no payload quando veio preenchido: o campo é opcional, e
          // num upsert um `telefone: null` apagaria o número que ela já tinha
          // deixado numa passagem anterior.
          ...(normalizarTelefone(data.telefone)
            ? { telefone: normalizarTelefone(data.telefone) }
            : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      )
      .select("download_token, descadastro_token")
      .single();

    if (error || !linha) {
      console.error("[Manual] Falha ao gravar o lead:", error);
      return { ok: false, motivo: "erro" };
    }

    const downloadUrl = urlDownloadManual(linha.download_token);
    const descadastroUrl = `${urlCanonica("/descadastrar")}?t=${linha.descadastro_token}`;

    // O e-mail é a cópia que fica guardada, então sai aqui, na hora.
    // Best-effort de propósito: o lead JÁ está gravado e o download automático
    // da tela não depende do Resend. Falha fica no log e em erros_app.
    const email = montarEmailManual({ downloadUrl, descadastroUrl });
    await enviarEmailResend({
      to: [data.email],
      subject: email.subject,
      text: email.text,
      html: email.html,
      replyTo: "oi@usepolia.com.br",
      headers: { "List-Unsubscribe": `<${descadastroUrl}>` },
      contexto: "[Manual]",
    });

    // eventId só existe pra lead novo de verdade (nunca no honeypot, nunca em
    // falha, nunca em reenvio de e-mail já cadastrado): é o gatilho pro Meta
    // Pixel disparar o Lead, com o mesmo ID que a API de Conversões vai usar
    // depois pra deduplicar.
    return { ok: true, downloadUrl, eventId: leadNovo ? crypto.randomUUID() : undefined };
  });
