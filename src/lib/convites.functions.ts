import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const emailInput = z.object({ email: z.string().trim().toLowerCase().email().max(255) });

interface ConviteRow {
  usado_em: string | null;
}

export const verificarConvite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => emailInput.parse(input))
  .handler(async ({ data }) => {
    const { data: convite } = await supabaseAdmin
      .from("convites_cadastro" as never)
      .select("usado_em")
      .eq("email", data.email)
      .maybeSingle();
    if (!convite) return { permitido: false };
    return { permitido: (convite as unknown as ConviteRow).usado_em === null };
  });

export const marcarConviteUsado = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => emailInput.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("convites_cadastro" as never)
      .update({ usado_em: new Date().toISOString() } as never)
      .eq("email", data.email);
    if (error) console.error("[Convites] Falha ao marcar convite usado:", error);
    return { ok: !error };
  });
