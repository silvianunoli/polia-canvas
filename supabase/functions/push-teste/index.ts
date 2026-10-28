import { createClient } from "npm:@supabase/supabase-js@2";
import { enviarPush, lerContaDeServico } from "../_shared/fcm.ts";
import { avisoDeTeste } from "../_shared/pushLembretes.ts";

// Botão "Mandar um aviso de teste" em Configurações (AND-06, 27/10/2026).
// Manda o aviso de teste só pros aparelhos da própria conta logada. O JWT é
// conferido aqui no código (verify_jwt desligado no config.toml, mesmo padrão
// do founder-monitor): sem sessão válida, 401.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const conta = lerContaDeServico(Deno.env.get("FIREBASE_SERVICE_ACCOUNT_B64") ?? "");
const ORIGENS = new Set(["https://one.usepolia.com.br", "http://localhost:8080"]);

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function cors(req: Request): Record<string, string> {
  const origem = req.headers.get("origin") ?? "";
  return ORIGENS.has(origem)
    ? {
        "Access-Control-Allow-Origin": origem,
        "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        Vary: "Origin",
      }
    : { Vary: "Origin" };
}

Deno.serve(async (req) => {
  const cabecalhos = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cabecalhos });
  if (req.method !== "POST")
    return new Response("método não permitido", { status: 405, headers: cabecalhos });

  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: usuario, error: erroUsuario } = jwt
    ? await supabaseAdmin.auth.getUser(jwt)
    : { data: { user: null }, error: null };
  if (erroUsuario || !usuario.user) {
    return Response.json({ ok: false, motivo: "sem_sessao" }, { status: 401, headers: cabecalhos });
  }
  if (!conta) {
    console.error("[push-teste] FIREBASE_SERVICE_ACCOUNT_B64 ausente ou inválido");
    return Response.json(
      { ok: false, motivo: "indisponivel" },
      { status: 500, headers: cabecalhos },
    );
  }

  const { data: aparelhos, error } = await supabaseAdmin
    .from("push_aparelhos")
    .select("token")
    .eq("user_id", usuario.user.id);
  if (error) {
    console.error("[push-teste] Falha ao ler aparelhos:", error.message);
    return Response.json(
      { ok: false, motivo: "indisponivel" },
      { status: 500, headers: cabecalhos },
    );
  }
  if (!aparelhos || aparelhos.length === 0) {
    return Response.json({ ok: false, motivo: "sem_aparelho" }, { headers: cabecalhos });
  }

  let enviados = 0;
  const invalidos: string[] = [];
  for (const { token } of aparelhos) {
    try {
      const resultado = await enviarPush(conta, token, avisoDeTeste());
      if (resultado === "ok") enviados++;
      else if (resultado === "token_invalido") invalidos.push(token);
    } catch (e) {
      console.error("[push-teste] Falha no envio:", (e as Error).message);
    }
  }
  if (invalidos.length > 0) {
    await supabaseAdmin.from("push_aparelhos").delete().in("token", invalidos);
  }
  return Response.json(
    { ok: enviados > 0, motivo: enviados > 0 ? null : "falha_envio", enviados },
    { headers: cabecalhos },
  );
});
