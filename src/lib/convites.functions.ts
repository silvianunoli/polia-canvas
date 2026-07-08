import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const emailInput = z.object({ email: z.string().trim().toLowerCase().email().max(255) });

interface ConviteRow {
  usado_em: string | null;
}

export interface ConviteListItem {
  email: string;
  criado_em: string;
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

// As 3 funções abaixo usam supabaseAdmin (bypassa RLS deny-all da tabela) —
// só são seguras porque assertAdmin barra qualquer chamador que não seja
// admin ANTES de tocar na tabela.
async function assertAdmin(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.is_admin) throw new Error("Forbidden");
}

export const listarConvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("convites_cadastro" as never)
      .select("email, criado_em, usado_em")
      .order("criado_em", { ascending: false });
    if (error) throw new Error("Falha ao listar convites.");
    return { convites: (data ?? []) as unknown as ConviteListItem[] };
  });

export const criarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => emailInput.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("convites_cadastro" as never)
      .insert({ email: data.email } as never);
    if (error) {
      if (error.code === "23505") throw new Error("Esse e-mail já tem convite.");
      throw new Error("Falha ao criar convite.");
    }
    return { ok: true };
  });

export const removerConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => emailInput.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("convites_cadastro" as never)
      .delete()
      .eq("email", data.email);
    if (error) throw new Error("Falha ao remover convite.");
    return { ok: true };
  });
