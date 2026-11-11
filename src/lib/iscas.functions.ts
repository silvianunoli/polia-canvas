import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verificarTurnstileServer } from "@/lib/turnstile.server";
import { whatsappDaConta } from "@/lib/telefone";
import { enviarEmailResend } from "@/lib/email-template";
import { urlCanonica } from "@/lib/seo";
import { SLUG_ISCA, buscarIsca } from "@/lib/iscas/catalogo";
import { montarEmailIsca } from "@/lib/iscas/email";
import { urlDownloadIsca } from "@/lib/iscas/download";

// Gravação do lead das iscas em PDF (/materiais/<slug>). Mesmo padrão de
// manual.functions.ts: a RLS de isca_leads é deny-all, então a escrita só
// acontece aqui, pelo service role, com o Turnstile validado no SERVIDOR.
//
// Diferença do manual: aqui o WhatsApp é OBRIGATÓRIO (decisão de 11/11/2026,
// a isca chega pelo Direct e o contato segue pelo WhatsApp), e uma pessoa tem
// uma linha por isca (unique em email + isca_slug).

const inputSchema = z.object({
  slug: z.string().trim().max(60).regex(SLUG_ISCA),
  email: z.string().trim().toLowerCase().email().max(255),
  telefone: z.string().trim().min(1).max(40),
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

export type ResultadoIsca =
  | { ok: true; downloadUrl: string; eventId?: string }
  | { ok: false; motivo: "turnstile" | "telefone" | "erro" };

export const gravarLeadIsca = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<ResultadoIsca> => {
    const isca = buscarIsca(data.slug);
    if (!isca) return { ok: false, motivo: "erro" };

    // O bot recebe um link que não abre nada: token aleatório sem linha no banco.
    if (data.hp) return { ok: true, downloadUrl: urlDownloadIsca(isca.slug, crypto.randomUUID()) };

    // whatsappDaConta e não normalizarTelefone: o segundo devolve null pra
    // DDD 55 digitado sem o +55 ("(55) 99999-9999" tem 11 dígitos começando
    // com 55). No /manual o campo é opcional e isso só perde o número; aqui,
    // obrigatório, travaria a pessoa. Mesmo formato de saída: 55 + DDD + número.
    const telefone = whatsappDaConta(data.telefone);
    if (!telefone) return { ok: false, motivo: "telefone" };

    if (!(await verificarTurnstileServer(data.turnstileToken))) {
      return { ok: false, motivo: "turnstile" };
    }

    // Antes do upsert: o que já existe desse e-mail em QUALQUER isca. Serve
    // pra duas coisas. (1) Lead novo pro anúncio é e-mail novo NESTA isca;
    // pedir de novo reenvia o PDF mas não infla o Lead. (2) Quem saiu da lista
    // por qualquer isca continua fora: o descadastro vale pra pessoa, não pra
    // linha (ver marcarDescadastro em quiz.functions.ts).
    const { data: existentes, error: erroBusca } = await supabaseAdmin
      .from("isca_leads")
      .select("isca_slug, descadastrado_em")
      .eq("email", data.email);
    if (erroBusca) {
      console.error("[Iscas] Falha ao consultar o lead:", erroBusca);
      return { ok: false, motivo: "erro" };
    }
    const linhas = existentes ?? [];
    const leadNovo = !linhas.some((l) => l.isca_slug === isca.slug);
    const descadastradoEm = linhas.find((l) => l.descadastrado_em)?.descadastrado_em ?? null;

    // Upsert por (email, isca_slug). created_at e os dois tokens ficam de
    // fora do payload: em conflito o Postgres só sobrescreve as colunas
    // listadas, então a data da primeira captura e os links já enviados
    // sobrevivem. descadastrado_em só entra pra CARREGAR o descadastro de
    // outra isca pra linha nova; nunca vai como null (o formulário é público e
    // não prova que quem digitou é a dona do e-mail, LGPD 08/10/2026).
    const { data: linha, error } = await supabaseAdmin
      .from("isca_leads")
      .upsert(
        {
          isca_slug: isca.slug,
          email: data.email,
          telefone,
          origem: data.origem ?? isca.origemPadrao,
          consentimento: true,
          consent_texto: isca.consentTexto,
          ...(descadastradoEm ? { descadastrado_em: descadastradoEm } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,isca_slug" },
      )
      .select("download_token, descadastro_token, descadastrado_em")
      .single();

    if (error || !linha) {
      console.error("[Iscas] Falha ao gravar o lead:", error);
      return { ok: false, motivo: "erro" };
    }

    const downloadUrl = urlDownloadIsca(isca.slug, linha.download_token);
    const descadastroUrl = `${urlCanonica("/descadastrar")}?t=${linha.descadastro_token}`;

    // E-mail best-effort: o lead já está gravado e o download da tela não
    // depende do Resend. Descadastrada não recebe.
    if (!linha.descadastrado_em) {
      const email = montarEmailIsca({ isca, downloadUrl, descadastroUrl });
      await enviarEmailResend({
        to: [data.email],
        subject: email.subject,
        text: email.text,
        html: email.html,
        replyTo: "oi@usepolia.com.br",
        headers: { "List-Unsubscribe": `<${descadastroUrl}>` },
        contexto: "[Iscas]",
      });
    }

    // eventId só pra lead novo nesta isca (nunca no honeypot, em falha ou em
    // reenvio): é o gatilho do Lead no Meta Pixel e no TikTok.
    return { ok: true, downloadUrl, eventId: leadNovo ? crypto.randomUUID() : undefined };
  });
