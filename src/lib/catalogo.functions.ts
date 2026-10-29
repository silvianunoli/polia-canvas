import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ehBeta, tierDoPlano } from "@/lib/planos";
import { normalizarDominio } from "@/lib/catalogo";

// Cartão "Catálogo online" em Configurações > Integrações (ONE-148, fase 1).
// Ligar = guardar o domínio do catálogo como conexão do canal 'catalogo'. Daí
// em diante o pedido confirmado no catálogo entra em Pedidos (catalogo/pedido.server.ts).
// Só em plano pago, como a registrar_pedido_catalogo confere de novo no banco.

const CANAL = "catalogo";
const SO_PAGO = "O catálogo online ligado aos Pedidos é do Premium e do Pro.";

async function temPlanoPago(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from("profiles").select("plano").eq("id", userId).maybeSingle();
  const plano = data?.plano as string | null | undefined;
  return ehBeta(plano) || tierDoPlano(plano) === "controle";
}

async function lerConexao(userId: string): Promise<{ shop_id: string | null; status: string } | null> {
  const { data } = await supabaseAdmin
    .from("canal_conexoes" as never)
    .select("shop_id, status")
    .eq("user_id", userId)
    .eq("canal", CANAL)
    .maybeSingle();
  return (data as unknown as { shop_id: string | null; status: string }) ?? null;
}

export const statusCatalogo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [conexao, liberado] = await Promise.all([lerConexao(context.userId), temPlanoPago(context.userId)]);
    const ligado = conexao?.status === "conectada";
    return { liberado, ligado, dominio: ligado ? conexao!.shop_id : null };
  });

export const ligarCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ dominio: z.string().max(200) }).parse(d))
  .handler(async ({ context, data }) => {
    if (!(await temPlanoPago(context.userId))) return { ok: false as const, error: SO_PAGO };
    const dominio = normalizarDominio(data.dominio);
    if (!dominio) return { ok: false as const, error: "Esse endereço não parece um domínio. Exemplo: suamarca.com.br" };

    const { error } = await supabaseAdmin
      .from("canal_conexoes" as never)
      .upsert(
        { user_id: context.userId, canal: CANAL, status: "conectada", shop_id: dominio, loja_nome: dominio, ultimo_erro: null } as never,
        { onConflict: "user_id,canal" },
      );
    if (error) {
      if (error.code === "23505")
        return { ok: false as const, error: "Esse domínio já está ligado a outra conta da Pólia One." };
      console.error("ligarCatalogo", error.code, error.message);
      return { ok: false as const, error: "A Pólia One não conseguiu ligar o catálogo agora." };
    }
    return { ok: true as const, dominio };
  });

export const desligarCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await supabaseAdmin
      .from("canal_conexoes" as never)
      .delete()
      .eq("user_id", context.userId)
      .eq("canal", CANAL);
    if (error) {
      console.error("desligarCatalogo", error.code, error.message);
      return { ok: false as const, error: "A Pólia One não conseguiu desligar o catálogo agora." };
    }
    return { ok: true as const };
  });
