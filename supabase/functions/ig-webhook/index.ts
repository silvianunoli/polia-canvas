// Bot de DM por gatilho: DESATIVADO em 15/09/2026 (decisão da fundadora, card
// EMAIL-19). Esteve em standby desde 25/07 (webhook nunca recebia evento de
// comentário real, diagnóstico não concluído) e ela decidiu não retomar.
//
// Function mantida viva de propósito (não apagada): só responde ao desafio de
// verificação da Meta, caso a assinatura do app ainda aponte pra cá. Não lê
// nem grava em `dm_gatilhos`/`dm_conversas`, não chama a Graph API, não manda
// e-mail nenhum. Se um dia a Meta parar de mandar o GET de verificação, é
// sinal de que a assinatura caiu sozinha e nem isso é mais necessário.

const WEBHOOK_VERIFY_TOKEN = Deno.env.get("WEBHOOK_VERIFY_TOKEN") ?? "";

Deno.serve((req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const modo = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (modo === "subscribe" && token === WEBHOOK_VERIFY_TOKEN && WEBHOOK_VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // POST: reconhece o evento sem processar nada (bot desativado).
  return new Response("EVENT_RECEIVED", { status: 200 });
});
