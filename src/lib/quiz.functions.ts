import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verificarTurnstileServer } from "@/lib/turnstile.server";
import { CONSENT_TEXTO } from "@/lib/quiz/perguntas";
import { calcularResultado, respostasCompletas, sanitizarRespostas } from "@/lib/quiz/pontuacao";
import type { Json } from "@/integrations/supabase/types";

// Gravação do lead do quiz público (/quiz). Mesmo padrão de
// lista-espera.functions.ts: a RLS de quiz_leads é deny-all, então a escrita
// só acontece aqui, pelo service role, com o Turnstile validado no SERVIDOR.
//
// A faixa, os pontos e o território fraco são RECALCULADOS aqui a partir das
// respostas. O que o navegador mandou nesses campos não é lido: o cliente
// calcula só pra mostrar na tela.

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
    // created_at fica de fora do payload de propósito — em conflito, o Postgres
    // só sobrescreve as colunas listadas, então a data da primeira captura
    // sobrevive.
    const { error } = await supabaseAdmin.from("quiz_leads").upsert(
      {
        email: data.email,
        faixa: faixa.nome,
        territorio_fraco: territorioFraco.nome,
        pontos,
        respostas: respostas as unknown as Json,
        origem: data.origem ?? "instagram_bio",
        consentimento: true,
        consent_texto: CONSENT_TEXTO,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );

    if (error) {
      console.error("[Quiz] Falha ao gravar o lead:", error);
      return { ok: false, motivo: "erro" };
    }

    return { ok: true };
  });
