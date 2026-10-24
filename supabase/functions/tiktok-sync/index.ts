import { createClient } from "npm:@supabase/supabase-js@2";
import {
  dataDoPedido,
  itensDoPedido,
  statusVendaDoPedido,
  taxaEstimada,
  type PedidoApiTiktok,
} from "../_shared/tiktokShop.ts";
import {
  buscarPedidosAlterados,
  detalhePedidos,
  pedirTokenTiktok,
  type CredenciaisTiktok,
} from "../_shared/tiktokShopCliente.ts";

// Sincronização do TikTok Shop (Fase 3a, etapa 3a.3, VND-05). Chamada só pelo
// pg_cron (disparar_tiktok_sync(), migração 20261024140000) a cada minuto, e só
// quando há trabalho. verify_jwt desligado: o segredo do cron mora no Vault e é
// conferido por RPC, igual ao lembretes-conta.
//
// 1. Varredura: loja sem sincronizar há 15 minutos busca os pedidos alterados
//    desde a última vez e põe na fila (cobre webhook perdido).
// 2. Fila: busca cada pedido completo e registra a venda (pago) ou cancela
//    (cancelado). Não pago não entra; quando pagar, o TikTok avisa de novo.
// Token renovado aqui quando falta menos de 5 minutos para vencer.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_KEY = Deno.env.get("TIKTOK_SHOP_APP_KEY") ?? "";
const APP_SECRET = Deno.env.get("TIKTOK_SHOP_APP_SECRET") ?? "";
const CANAL = "tiktok_shop";
const MAX_EVENTOS = 100;
const MAX_TENTATIVAS = 5;
const MARGEM_TOKEN_MS = 5 * 60 * 1000;
const MSG_RECONECTAR = "A autorização do TikTok Shop venceu. Conecta de novo.";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const cred: CredenciaisTiktok = { appKey: APP_KEY, appSecret: APP_SECRET };

type Conexao = {
  id: string;
  user_id: string;
  shop_id: string;
  shop_cipher: string | null;
  ultimo_sync: string | null;
};
type Acesso = { accessToken: string; shopCipher: string };

async function autenticado(req: Request): Promise<boolean> {
  const recebido = req.headers.get("x-tiktok-sync-secret") ?? "";
  if (!recebido) return false;
  const { data, error } = await supabaseAdmin.rpc("conferir_segredo_tiktok_sync", {
    p_segredo: recebido,
  });
  if (error) console.error("[tiktok-sync] Falha ao conferir o segredo:", error.message);
  return data === true;
}

async function obterAcesso(c: Conexao): Promise<Acesso | null> {
  if (!c.shop_cipher) return null;
  const { data } = await supabaseAdmin.rpc("canal_token_ler", { p_conexao_id: c.id });
  const t = (
    data as
      | {
          access_token: string | null;
          refresh_token: string | null;
          access_expira_em: string | null;
        }[]
      | null
  )?.[0];
  if (!t?.access_token || !t.refresh_token) return null;
  const venceEm = t.access_expira_em ? Date.parse(t.access_expira_em) : 0;
  if (venceEm - Date.now() > MARGEM_TOKEN_MS)
    return { accessToken: t.access_token, shopCipher: c.shop_cipher };

  const { tokens } = await pedirTokenTiktok(cred, "refresh_token", t.refresh_token);
  if (!tokens) {
    await supabaseAdmin
      .from("canal_conexoes")
      .update({ status: "erro", ultimo_erro: MSG_RECONECTAR, updated_at: new Date().toISOString() })
      .eq("id", c.id);
    return null;
  }
  const { error } = await supabaseAdmin.rpc("canal_token_salvar", {
    p_conexao_id: c.id,
    p_access: tokens.accessToken,
    p_refresh: tokens.refreshToken,
    p_access_expira: tokens.accessExpiraEm,
    p_refresh_expira: tokens.refreshExpiraEm,
  });
  if (error) return null;
  return { accessToken: tokens.accessToken, shopCipher: c.shop_cipher };
}

async function temPro(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("plano")
    .eq("id", userId)
    .maybeSingle();
  const plano = (data as { plano?: string } | null)?.plano;
  return plano === "projete" || plano === "beta";
}

async function marcarEventos(ids: number[], erro: string | null) {
  if (!ids.length) return;
  if (!erro) {
    await supabaseAdmin
      .from("canal_eventos")
      .update({ processado_em: new Date().toISOString(), erro: null })
      .in("id", ids);
    return;
  }
  // Erro: conta a tentativa; na quinta, desiste (processado com o erro guardado).
  const { data } = await supabaseAdmin.from("canal_eventos").select("id, tentativas").in("id", ids);
  for (const e of (data as { id: number; tentativas: number }[]) ?? []) {
    const tentativas = e.tentativas + 1;
    await supabaseAdmin
      .from("canal_eventos")
      .update({
        tentativas,
        erro: erro.slice(0, 500),
        processado_em: tentativas >= MAX_TENTATIVAS ? new Date().toISOString() : null,
      })
      .eq("id", e.id);
  }
}

async function varrer(c: Conexao, acesso: Acesso): Promise<number> {
  const ultimo = c.ultimo_sync ? Date.parse(c.ultimo_sync) : Date.now() - 24 * 60 * 60 * 1000;
  const desdeSegundos = Math.floor(ultimo / 1000) - 5 * 60;
  let pagina: string | undefined;
  let total = 0;
  for (let i = 0; i < 4; i++) {
    const r = await buscarPedidosAlterados(cred, { ...acesso, desdeSegundos, pageToken: pagina });
    if (r.error) return -1;
    const linhas = r.pedidos
      .filter((p) => p.id)
      .map((p) => ({
        canal: CANAL,
        shop_id: c.shop_id,
        id_externo: String(p.id),
        recebido_em: new Date().toISOString(),
        processado_em: null,
        tentativas: 0,
        erro: null,
      }));
    if (linhas.length)
      await supabaseAdmin
        .from("canal_eventos")
        .upsert(linhas, { onConflict: "canal,shop_id,id_externo" });
    total += linhas.length;
    if (!r.proximaPagina) break;
    pagina = r.proximaPagina;
  }
  await supabaseAdmin
    .from("canal_conexoes")
    .update({ ultimo_sync: new Date().toISOString() })
    .eq("id", c.id);
  return total;
}

async function processarPedido(
  c: Conexao,
  pedido: PedidoApiTiktok,
  vinculos: Map<string, string>,
  regra: { percentual: number; fixo: number } | null,
): Promise<string | null> {
  const status = statusVendaDoPedido(pedido.status);
  if (status === null) return null; // ainda não pago: quando pagar, o TikTok avisa de novo
  if (status === "cancelada") {
    const { error } = await supabaseAdmin.rpc("cancelar_venda_canal", {
      p_user_id: c.user_id,
      p_canal: CANAL,
      p_id_externo: String(pedido.id),
    });
    return error ? error.message : null;
  }
  const itens = itensDoPedido(pedido, vinculos);
  if (!itens.length) return "pedido sem itens";
  const total = itens.reduce((t, i) => t + i.quantidade * i.preco_unitario, 0);
  const semVinculo = itens.filter((i) => !i.sku_id).map((i) => i.nome);
  const observacao = [
    `Pedido ${pedido.id} do TikTok Shop`,
    semVinculo.length ? `sem produto ligado: ${[...new Set(semVinculo)].join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const { error } = await supabaseAdmin.rpc("registrar_venda_canal", {
    p_user_id: c.user_id,
    p_canal: CANAL,
    p_id_externo: String(pedido.id),
    p_data: dataDoPedido(pedido.paid_time ?? pedido.create_time),
    p_itens: itens,
    p_taxa_canal: taxaEstimada(total, regra),
    p_observacao: observacao,
  });
  return error ? error.message : null;
}

Deno.serve(async (req: Request) => {
  if (!(await autenticado(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  if (!APP_KEY || !APP_SECRET) {
    return new Response(JSON.stringify({ ok: false, motivo: "sem_credenciais" }), { status: 500 });
  }

  const { data: conexoesData } = await supabaseAdmin
    .from("canal_conexoes")
    .select("id, user_id, shop_id, shop_cipher, ultimo_sync")
    .eq("canal", CANAL)
    .eq("status", "conectada");
  const conexoes = (conexoesData as Conexao[] | null) ?? [];
  const porLoja = new Map(conexoes.map((c) => [c.shop_id, c]));
  const acessos = new Map<string, Acesso | null>();
  const acessoDe = async (c: Conexao) => {
    if (!acessos.has(c.id))
      acessos.set(c.id, (await temPro(c.user_id)) ? await obterAcesso(c) : null);
    return acessos.get(c.id) ?? null;
  };

  // 1. Varredura de quem está há 15 minutos sem sincronizar.
  let varridos = 0;
  const limite = Date.now() - 15 * 60 * 1000;
  for (const c of conexoes) {
    if (c.ultimo_sync && Date.parse(c.ultimo_sync) > limite) continue;
    const acesso = await acessoDe(c);
    if (acesso) varridos += Math.max(0, await varrer(c, acesso));
  }

  // 2. Fila de pedidos.
  const { data: eventosData } = await supabaseAdmin
    .from("canal_eventos")
    .select("id, shop_id, id_externo")
    .eq("canal", CANAL)
    .is("processado_em", null)
    .lt("tentativas", MAX_TENTATIVAS)
    .order("recebido_em")
    .limit(MAX_EVENTOS);
  const eventos =
    (eventosData as { id: number; shop_id: string; id_externo: string }[] | null) ?? [];
  const grupos = new Map<string, typeof eventos>();
  for (const e of eventos) grupos.set(e.shop_id, [...(grupos.get(e.shop_id) ?? []), e]);

  let vendas = 0;
  for (const [shopId, lista] of grupos) {
    const c = porLoja.get(shopId);
    if (!c) {
      await marcarEventos(
        lista.map((e) => e.id),
        "loja não conectada na Pólia",
      );
      continue;
    }
    const acesso = await acessoDe(c);
    if (!acesso) {
      await marcarEventos(
        lista.map((e) => e.id),
        "sem acesso à loja (plano ou autorização)",
      );
      continue;
    }
    const [{ data: vinc }, { data: taxa }] = await Promise.all([
      supabaseAdmin
        .from("anuncio_vinculos")
        .select("sku_externo_id, sku_id")
        .eq("user_id", c.user_id)
        .eq("canal", CANAL),
      supabaseAdmin
        .from("taxas_recebimento")
        .select("percentual, fixo")
        .eq("user_id", c.user_id)
        .eq("chave", CANAL)
        .maybeSingle(),
    ]);
    const vinculos = new Map(
      ((vinc as { sku_externo_id: string; sku_id: string }[]) ?? []).map((v) => [
        v.sku_externo_id,
        v.sku_id,
      ]),
    );
    const regra = taxa
      ? {
          percentual: Number((taxa as { percentual: number }).percentual),
          fixo: Number((taxa as { fixo: number }).fixo),
        }
      : null;

    for (let i = 0; i < lista.length; i += 50) {
      const lote = lista.slice(i, i + 50);
      const { pedidos, error } = await detalhePedidos(cred, {
        ...acesso,
        ids: lote.map((e) => e.id_externo),
      });
      if (error) {
        await marcarEventos(
          lote.map((e) => e.id),
          `detalhe do pedido: ${error}`,
        );
        continue;
      }
      const porId = new Map(pedidos.map((p) => [String(p.id), p]));
      for (const e of lote) {
        const pedido = porId.get(e.id_externo);
        if (!pedido) {
          await marcarEventos([e.id], "pedido não veio no detalhe");
          continue;
        }
        const erro = await processarPedido(c, pedido, vinculos, regra);
        if (!erro && statusVendaDoPedido(pedido.status) === "a_receber") vendas++;
        await marcarEventos([e.id], erro);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, varridos, eventos: eventos.length, vendas }), {
    headers: { "Content-Type": "application/json" },
  });
});
