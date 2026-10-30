import { createClient } from "npm:@supabase/supabase-js@2";
import { MSG_RECONECTAR, precisaRenovarNoCron, type Rede } from "../_shared/redesSociais.ts";
import { pedirTokenTiktok, renovarInstagram } from "../_shared/redesSociaisCliente.ts";

// Renovação dos tokens da Agenda das redes (ONE-154). Chamada só pelo pg_cron
// (disparar_redes_token_renovar(), migração 20261030120000) uma vez por dia, e
// só quando há token para renovar. verify_jwt desligado: o segredo do cron mora
// no Vault e é conferido por RPC, igual ao ml-sync.
//
// Instagram: token longo de 60 dias, renovado quando faltam 20. TikTok: a
// renovação (365 dias) ganha prazo novo quando faltam 30; o token de acesso, de
// 24 h, é renovado pelo Worker na hora de usar. Recusa da rede = conexão em
// "erro", e o card de Integrações pede para conectar de novo.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TIKTOK_CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY") ?? "";
const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET") ?? "";
const MAX_POR_RODADA = 200;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type Conexao = {
  id: string;
  rede: Rede;
  access_expira_em: string | null;
  refresh_expira_em: string | null;
  renovado_em: string | null;
};
type TokenRow = { access_token: string | null; refresh_token: string | null };

async function autenticado(req: Request): Promise<boolean> {
  const recebido = req.headers.get("x-redes-token-secret") ?? "";
  if (!recebido) return false;
  const { data, error } = await supabaseAdmin.rpc("conferir_segredo_redes_token", {
    p_segredo: recebido,
  });
  if (error) console.error("[redes-token-renovar] Falha ao conferir o segredo:", error.message);
  return data === true;
}

async function marcarErro(c: Conexao) {
  console.warn("[redes-token-renovar] Conexão em erro:", c.id, c.rede);
  await supabaseAdmin
    .from("redes_conexoes")
    .update({
      status: "erro",
      ultimo_erro: MSG_RECONECTAR[c.rede],
      updated_at: new Date().toISOString(),
    })
    .eq("id", c.id);
}

async function salvar(
  c: Conexao,
  t: { access: string; refresh: string | null; accessExpira: string; refreshExpira: string | null },
): Promise<boolean> {
  const { error } = await supabaseAdmin.rpc("redes_token_salvar", {
    p_conexao_id: c.id,
    p_access: t.access,
    p_refresh: t.refresh,
    p_access_expira: t.accessExpira,
    p_refresh_expira: t.refreshExpira,
  });
  if (error) console.error("[redes-token-renovar] Falha ao salvar:", c.id, error.message);
  return !error;
}

async function renovar(c: Conexao): Promise<"ok" | "erro" | "pulou"> {
  const { data } = await supabaseAdmin.rpc("redes_token_ler", { p_conexao_id: c.id });
  const token = ((data as TokenRow[] | null) ?? [])[0];

  if (c.rede === "instagram") {
    if (!token?.access_token) return "pulou";
    const r = await renovarInstagram(token.access_token);
    if (!r.valor) {
      if (r.recusado) await marcarErro(c);
      return r.recusado ? "erro" : "pulou";
    }
    return (await salvar(c, {
      access: r.valor.accessToken,
      refresh: null,
      accessExpira: r.valor.accessExpiraEm,
      refreshExpira: null,
    }))
      ? "ok"
      : "pulou";
  }

  if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET || !token?.refresh_token) return "pulou";
  const r = await pedirTokenTiktok(
    { clientKey: TIKTOK_CLIENT_KEY, clientSecret: TIKTOK_CLIENT_SECRET },
    { grant: "refresh_token", refreshToken: token.refresh_token },
  );
  if (!r.valor) {
    if (r.recusado) await marcarErro(c);
    return r.recusado ? "erro" : "pulou";
  }
  return (await salvar(c, {
    access: r.valor.accessToken,
    refresh: r.valor.refreshToken,
    accessExpira: r.valor.accessExpiraEm,
    refreshExpira: r.valor.refreshExpiraEm,
  }))
    ? "ok"
    : "pulou";
}

Deno.serve(async (req: Request) => {
  if (!(await autenticado(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("redes_conexoes")
    .select("id, rede, access_expira_em, refresh_expira_em, renovado_em")
    .eq("status", "conectada")
    .order("access_expira_em", { ascending: true })
    .limit(MAX_POR_RODADA);
  if (error) {
    console.error("[redes-token-renovar] Falha ao listar conexões:", error.message);
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }

  const agora = Date.now();
  const contagem = { ok: 0, erro: 0, pulou: 0 };
  for (const c of (data ?? []) as Conexao[]) {
    const vence = precisaRenovarNoCron(
      {
        rede: c.rede,
        accessExpiraEm: c.access_expira_em,
        refreshExpiraEm: c.refresh_expira_em,
        renovadoEm: c.renovado_em,
      },
      agora,
    );
    if (!vence) continue;
    contagem[await renovar(c)]++;
  }
  return new Response(JSON.stringify({ ok: true, ...contagem }), {
    headers: { "Content-Type": "application/json" },
  });
});
