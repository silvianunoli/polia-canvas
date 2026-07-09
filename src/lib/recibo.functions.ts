import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Dados do emissor do recibo (pessoa física, CPF). Vêm do ambiente — nunca
// hardcoded no componente. Não são segredo (aparecem em todo recibo baixado),
// só ficam fora do código pra poder trocar sem deploy.
//
// Só quem tem (ou teve) plano pago recebe recibo: o dado traz o CPF do emissor
// (PII/LGPD), então não é servido a contas beta/gratuitas — que não têm recibo.
export const dadosEmissorRecibo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plano")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile || profile.plano === "beta") {
      throw new Error("Forbidden");
    }
    return {
      nome: process.env.POLIA_EMISSOR_NOME ?? null,
      cpf: process.env.POLIA_EMISSOR_CPF ?? null,
      endereco: process.env.POLIA_EMISSOR_ENDERECO ?? null,
    };
  });
