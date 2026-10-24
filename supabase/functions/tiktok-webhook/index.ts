import { createClient } from "npm:@supabase/supabase-js@2";
import { pedidoDoWebhook, webhookAutentico } from "../_shared/tiktokShop.ts";

// Webhook do TikTok Shop (Fase 3a, etapa 3a.3, VND-05). URL cadastrada no app
// "Pólia One" do Partner Center. O TikTok espera resposta em até 3 segundos, então
// aqui só confere a assinatura (HMAC de app_key + corpo cru, com o app_secret) e
// põe o pedido na fila canal_eventos. Quem busca o pedido e registra a venda é o
// tiktok-sync, chamado pelo pg_cron. verify_jwt desligado: quem chama é o TikTok.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_KEY = Deno.env.get("TIKTOK_SHOP_APP_KEY") ?? "";
const APP_SECRET = Deno.env.get("TIKTOK_SHOP_APP_SECRET") ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  if (!APP_KEY || !APP_SECRET) {
    console.error("[tiktok-webhook] Sem TIKTOK_SHOP_APP_KEY/APP_SECRET no ambiente.");
    return new Response(null, { status: 500 });
  }

  const corpoCru = await req.text();
  if (corpoCru.length > 100_000) return new Response(null, { status: 413 });
  const autentico = await webhookAutentico({
    appKey: APP_KEY,
    appSecret: APP_SECRET,
    corpoCru,
    assinatura: req.headers.get("authorization"),
  });
  if (!autentico) return new Response(null, { status: 401 });

  let corpo: unknown;
  try {
    corpo = JSON.parse(corpoCru);
  } catch {
    return new Response(null, { status: 400 });
  }
  const pedido = pedidoDoWebhook(corpo);
  // Outros avisos (produto, devolução...) ainda não têm uso: confirma e ignora.
  if (!pedido) return new Response(null, { status: 200 });

  // Pedido já na fila volta a ficar pendente; sem dado de compradora aqui.
  const { error } = await supabaseAdmin.from("canal_eventos").upsert(
    {
      canal: "tiktok_shop",
      shop_id: pedido.shopId,
      id_externo: pedido.pedidoId,
      recebido_em: new Date().toISOString(),
      processado_em: null,
      tentativas: 0,
      erro: null,
    },
    { onConflict: "canal,shop_id,id_externo" },
  );
  if (error) {
    console.error("[tiktok-webhook] Falha ao enfileirar:", error.message);
    // 500 faz o TikTok tentar de novo; a varredura de 15 minutos também cobre.
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 200 });
});
