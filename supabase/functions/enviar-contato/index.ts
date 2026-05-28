import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isString(v: unknown, max: number): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { nome, email, assunto, mensagem } = await req.json();

    if (
      !isString(nome, 120) ||
      !isString(email, 255) ||
      !isString(assunto, 80) ||
      !isString(mensagem, 2000)
    ) {
      return new Response(JSON.stringify({ error: "Dados inválidos." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    // Se nenhuma chave estiver configurada, apenas loga e responde ok pra não bloquear o usuário no beta.
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      console.log("[enviar-contato] sem RESEND_API_KEY ou LOVABLE_API_KEY, log apenas:", {
        nome,
        email,
        assunto,
        mensagem,
      });
      return new Response(JSON.stringify({ ok: true, logged: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "Pólia <onboarding@resend.dev>",
        to: ["contato@polia.app"],
        reply_to: email,
        subject: `[Contato] ${assunto} - ${nome}`,
        text: `De: ${nome} <${email}>\nAssunto: ${assunto}\n\n${mensagem}`,
      }),
    });

    if (!resp.ok) {
      console.error("[enviar-contato] resend falhou", resp.status, await resp.text());
      return new Response(JSON.stringify({ error: "Falha no envio." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[enviar-contato] erro", e);
    return new Response(JSON.stringify({ error: "Erro interno." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
