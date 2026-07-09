import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verificarTurnstileServer } from "@/lib/turnstile.server";

const inputSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(255),
  tipo_negocio: z.string().trim().max(120).nullish(),
  turnstileToken: z.string().optional(),
  // Honeypot: campo invisível que só um bot preenche. Vindo preenchido,
  // fingimos sucesso sem gravar nada.
  hp: z.string().optional(),
});

// Inscrição na lista de espera. Substitui o insert anon direto que o formulário
// fazia — o Turnstile agora é validado no SERVIDOR antes de gravar, e a gravação
// passa pelo service role (a RLS pública de INSERT foi removida na migração
// 20260709170200).
export const entrarListaEspera = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.hp) return { ok: true, jaEstava: false };

    if (!(await verificarTurnstileServer(data.turnstileToken))) {
      return { ok: false, jaEstava: false };
    }

    const { error } = await supabaseAdmin.from("lista_espera").insert({
      nome: data.nome,
      email: data.email,
      tipo_negocio: data.tipo_negocio ?? null,
    });

    if (error) {
      // 23505 = e-mail já está na lista. Não é erro pra usuária: já está dentro.
      if (error.code === "23505") return { ok: true, jaEstava: true };
      console.error("[ListaEspera] Falha ao inserir:", error);
      return { ok: false, jaEstava: false };
    }

    return { ok: true, jaEstava: false };
  });
