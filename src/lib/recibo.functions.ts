import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Dados do emissor do recibo (pessoa física, CPF). Vêm do ambiente — nunca
// hardcoded no componente. Não são segredo (aparecem em todo recibo baixado),
// só ficam fora do código pra poder trocar sem deploy.
export const dadosEmissorRecibo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    nome: process.env.POLIA_EMISSOR_NOME ?? null,
    cpf: process.env.POLIA_EMISSOR_CPF ?? null,
    endereco: process.env.POLIA_EMISSOR_ENDERECO ?? null,
  }));
