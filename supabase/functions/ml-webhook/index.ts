import { createClient } from "npm:@supabase/supabase-js@2";
import { pedidoDoAviso } from "../_shared/mercadoLivre.ts";

// Aviso de pedido do Mercado Livre (Fase 3c, etapa 3c.3, VND-30). URL cadastrada
// no app "Pólia One" do DevCenter, tópico orders_v2. O Mercado Livre espera 200
// na hora, então aqui só põe o pedido na fila canal_eventos; quem busca o pedido
// e registra a venda é o ml-sync, chamado pelo pg_cron. verify_jwt desligado:
// quem chama é o Mercado Livre.
//
// O aviso NÃO é assinado. Por isso ele só põe um id na fila, e só de vendedora
// conectada na Pólia: a venda nasce do pedido buscado na API com o token dela,
// nunca do que veio aqui. Aviso que não serve recebe 200 mesmo assim, senão o
// Mercado Livre insiste e acaba desligando o tópico.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_ID = Deno.env.get("MERCADO_LIVRE_CLIENT_ID") ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  if (!APP_ID) {
    console.error("[ml-webhook] Sem MERCADO_LIVRE_CLIENT_ID no ambiente.");
    return new Response(null, { status: 500 });
  }

  const corpoCru = await req.text();
  if (corpoCru.length > 20_000) return new Response(null, { status: 413 });
  let corpo: unknown;
  try {
    corpo = JSON.parse(corpoCru);
  } catch {
    return new Response(null, { status: 400 });
  }
  const pedido = pedidoDoAviso(corpo, APP_ID);
  // Outros tópicos (anúncio, pergunta) ainda não têm uso: confirma e ignora.
  if (!pedido) return new Response(null, { status: 200 });

  const { data: conexao } = await supabaseAdmin
    .from("canal_conexoes")
    .select("id")
    .eq("canal", "mercado_livre")
    .eq("shop_id", pedido.vendedoraId)
    .eq("status", "conectada")
    .maybeSingle();
  if (!conexao) return new Response(null, { status: 200 });

  // Pedido já na fila volta a ficar pendente sem zerar as tentativas, o que já
  // desistiu continua desistido e a fila para em 500 pendentes por vendedora
  // (enfileirar_evento_canal, revisão 3c.5). Sem dado de compradora aqui.
  const { error } = await supabaseAdmin.rpc("enfileirar_evento_canal", {
    p_canal: "mercado_livre",
    p_shop_id: pedido.vendedoraId,
    p_id_externo: pedido.pedidoId,
  });
  if (error) {
    console.error("[ml-webhook] Falha ao enfileirar:", error.message);
    // 500 faz o Mercado Livre tentar de novo; a varredura de 15 minutos também cobre.
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 200 });
});
