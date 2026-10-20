import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const STATUS_PAGOS = ["active", "past_due", "trialing"];

/**
 * Quantas assinaturas pagas existem (cortesia fora). Lido no servidor porque
 * `assinaturas` só deixa cada conta ler a própria linha. Devolve só o número,
 * nunca quem são. Falhou: null, e a tela não mostra a contagem de vagas.
 */
export async function contarAssinaturasPagas(): Promise<number | null> {
  // Nunca derruba quem chama (checkout incluso): sem contagem, sem oferta.
  try {
    const { count, error } = await supabaseAdmin
      .from("assinaturas" as never)
      .select("user_id", { count: "exact", head: true })
      .in("status", STATUS_PAGOS)
      .eq("cortesia", false);
    if (error) {
      console.error("[fundadora] contagem de assinaturas falhou:", error.message);
      return null;
    }
    return typeof count === "number" ? count : null;
  } catch (err) {
    console.error("[fundadora] contagem de assinaturas falhou:", err);
    return null;
  }
}

/** Público (o /planos é aberto): só um número agregado. */
export const assinaturasPagasFundadora = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ pagas: number | null }> => ({ pagas: await contarAssinaturasPagas() }),
);
