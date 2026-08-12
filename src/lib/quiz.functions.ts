import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verificarTurnstileServer } from "@/lib/turnstile.server";
import { enviarEmailResend } from "@/lib/email-template";
import { CONSENT_TEXTO } from "@/lib/quiz/perguntas";
import { montarEmailDiagnostico } from "@/lib/quiz/email";
import { calcularResultado, respostasCompletas, sanitizarRespostas } from "@/lib/quiz/pontuacao";
import type { Json } from "@/integrations/supabase/types";

// Gravação do lead do quiz público (/quiz). Mesmo padrão de
// lista-espera.functions.ts: a RLS de quiz_leads é deny-all, então a escrita
// só acontece aqui, pelo service role, com o Turnstile validado no SERVIDOR.
//
// A faixa, os pontos e o território fraco são RECALCULADOS aqui a partir das
// respostas. O que o navegador mandou nesses campos não é lido: o cliente
// calcula só pra mostrar na tela.

const SITE_URL = "https://usepolia.com.br";

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  consentimento: z.literal(true),
  respostas: z.record(z.unknown()).default({}),
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

export type ResultadoGravacao =
  | { ok: true }
  | { ok: false; motivo: "turnstile" | "incompleto" | "erro" };

// ── Descadastro ────────────────────────────────────────────────────────────
// Chega pelo link do rodapé do e-mail. A única credencial é o token, então ele
// é validado como uuid antes de encostar no banco, e a resposta NUNCA devolve
// o e-mail da linha: quem tem o token pode sair da lista, não ler quem é.
//
// Sem Turnstile aqui de propósito: exigir prova de humanidade pra alguém sair
// de uma lista é o padrão escuro que a LGPD existe pra evitar. Sair tem que
// ser mais fácil que entrar.

const tokenSchema = z.object({ token: z.string().uuid() });

export type ResultadoDescadastro = { ok: boolean };

async function marcarDescadastro(token: string, saindo: boolean): Promise<ResultadoDescadastro> {
  const { data, error } = await supabaseAdmin
    .from("quiz_leads")
    .update({ descadastrado_em: saindo ? new Date().toISOString() : null })
    .eq("descadastro_token", token)
    .select("id");

  if (error) {
    console.error("[Quiz] Falha ao atualizar o descadastro:", error);
    return { ok: false };
  }
  // Token que não existe cai aqui. A tela trata igual a falha, sem dizer qual
  // dos dois foi: confirmar que um token é inválido já é informação.
  return { ok: (data?.length ?? 0) > 0 };
}

export const descadastrarLeadQuiz = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(({ data }) => marcarDescadastro(data.token, true));

export const reinscreverLeadQuiz = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(({ data }) => marcarDescadastro(data.token, false));

export const gravarLeadQuiz = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<ResultadoGravacao> => {
    if (data.hp) return { ok: true };

    if (!(await verificarTurnstileServer(data.turnstileToken))) {
      return { ok: false, motivo: "turnstile" };
    }

    const respostas = sanitizarRespostas(data.respostas as Record<string, unknown>);
    if (!respostasCompletas(respostas)) {
      return { ok: false, motivo: "incompleto" };
    }

    const { pontos, faixa, territorioFraco } = calcularResultado(respostas);

    // Upsert por e-mail: refazer o quiz atualiza a linha, nunca duplica.
    // created_at e descadastro_token ficam de fora do payload de propósito — em
    // conflito, o Postgres só sobrescreve as colunas listadas, então a data da
    // primeira captura e o token do link já enviado sobrevivem.
    //
    // descadastrado_em volta a null: quem refez o quiz marcou o consentimento
    // de novo, na tela, agora. Isso é consentimento novo e explícito, e é o
    // único caminho de volta pra quem já tinha saído.
    const { data: linha, error } = await supabaseAdmin
      .from("quiz_leads")
      .upsert(
        {
          email: data.email,
          faixa: faixa.nome,
          territorio_fraco: territorioFraco.nome,
          pontos,
          respostas: respostas as unknown as Json,
          origem: data.origem ?? "instagram_bio",
          consentimento: true,
          consent_texto: CONSENT_TEXTO,
          descadastrado_em: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      )
      .select("descadastro_token")
      .single();

    if (error || !linha) {
      console.error("[Quiz] Falha ao gravar o lead:", error);
      return { ok: false, motivo: "erro" };
    }

    // O diagnóstico por e-mail é o que o gate promete, então sai aqui, na hora.
    // Best-effort de propósito: o lead JÁ está gravado, e derrubar a tela de
    // resultado por causa de uma falha do Resend seria trocar um problema
    // pequeno (e-mail que não chegou) por um grande (a pessoa respondeu 8
    // perguntas e não viu o resultado). A falha fica no log.
    //
    // Refazer o quiz manda de novo, e isso é intencional: respostas novas,
    // diagnóstico novo. O Turnstile no gate é o que segura repetição em massa.
    const descadastroUrl = `${SITE_URL}/descadastrar?t=${linha.descadastro_token}`;
    const email = montarEmailDiagnostico({
      faixa,
      territorio: territorioFraco,
      descadastroUrl,
    });
    await enviarEmailResend({
      to: [data.email],
      subject: email.subject,
      text: email.text,
      html: email.html,
      replyTo: "oi@usepolia.com.br",
      // Faz o Gmail mostrar "Cancelar inscrição" ao lado do remetente, fora do
      // corpo. Vale entrega também: caixa de entrada trata melhor quem oferece
      // saída fácil do que quem esconde.
      headers: { "List-Unsubscribe": `<${descadastroUrl}>` },
      contexto: "[Quiz]",
    });

    return { ok: true };
  });
