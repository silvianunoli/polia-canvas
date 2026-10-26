import { createClient } from "npm:@supabase/supabase-js@2";
import {
  corpoAtualizarEstoque,
  dataDoPedido,
  depositosDoProduto,
  itensDoPedido,
  statusVendaDoPedido,
  type PedidoApiTiktok,
} from "../_shared/tiktokShop.ts";
import { taxaTiktokDaVenda } from "../_shared/taxaTiktokShop.ts";
import {
  atualizarEstoqueTiktok,
  buscarPedidosAlterados,
  detalhePedidos,
  detalheProdutoTiktok,
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
// 3. Estoque (etapa 3a.4): variação ligada que mexeu na Pólia, com "A Pólia cuida
//    do estoque" ligado, manda o saldo para o TikTok (canal_fila_estoque,
//    migração 20261024180000). Roda depois dos pedidos: a baixa da venda que
//    acabou de entrar já vai junto.
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
  varredura_tentada_em: string | null;
  cuida_estoque: boolean;
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
  freteGratis: boolean,
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
    // Tabela oficial do TikTok, por item e por faixa de preço (_shared/taxaTiktokShop.ts).
    p_taxa_canal: taxaTiktokDaVenda(itens, { freteGratis }),
    p_observacao: observacao,
  });
  return error ? error.message : null;
}

/**
 * Fecha a linha da fila só se ela não foi pedida de novo depois da leitura: uma
 * venda que entrou no meio do envio marca pedido_em mais novo, e o saldo dela
 * sobe na próxima rodada em vez de se perder (revisão 3c.5, mesmo caso do ML).
 */
async function concluirFilaEstoque(skuIds: string[], pedidoEmDe: Map<string, string>) {
  for (const skuId of skuIds)
    await supabaseAdmin
      .from("canal_fila_estoque")
      .update({ pendente: false, enviado_em: new Date().toISOString(), erro: null })
      .eq("canal", CANAL)
      .eq("sku_id", skuId)
      .lte("pedido_em", pedidoEmDe.get(skuId)!);
}

async function marcarFilaEstoque(skuIds: string[], erro: string) {
  if (!skuIds.length) return;
  const { data } = await supabaseAdmin
    .from("canal_fila_estoque")
    .select("sku_id, tentativas")
    .eq("canal", CANAL)
    .in("sku_id", skuIds);
  for (const f of (data as { sku_id: string; tentativas: number }[]) ?? []) {
    const tentativas = f.tentativas + 1;
    await supabaseAdmin
      .from("canal_fila_estoque")
      .update({ tentativas, erro: erro.slice(0, 500), pendente: tentativas < MAX_TENTATIVAS })
      .eq("canal", CANAL)
      .eq("sku_id", f.sku_id);
  }
}

/** Manda o saldo da Pólia de cada variação da fila; devolve quantas foram enviadas. */
async function enviarEstoque(
  conexoes: Conexao[],
  acessoDe: (c: Conexao) => Promise<Acesso | null>,
): Promise<number> {
  const { data: filaData } = await supabaseAdmin
    .from("canal_fila_estoque")
    .select("user_id, sku_id, pedido_em")
    .eq("canal", CANAL)
    .eq("pendente", true)
    .lt("tentativas", MAX_TENTATIVAS)
    .order("pedido_em")
    .limit(200);
  const fila = (filaData as { user_id: string; sku_id: string; pedido_em: string }[] | null) ?? [];
  const pedidoEmDe = new Map(fila.map((f) => [f.sku_id, f.pedido_em]));
  const porDona = new Map<string, string[]>();
  for (const f of fila) porDona.set(f.user_id, [...(porDona.get(f.user_id) ?? []), f.sku_id]);

  let enviados = 0;
  for (const [userId, skuIds] of porDona) {
    const c = conexoes.find((x) => x.user_id === userId);
    const acesso = c?.cuida_estoque ? await acessoDe(c) : null;
    if (!c || !acesso) {
      await marcarFilaEstoque(
        skuIds,
        "sem acesso à loja (plano, autorização ou estoque desligado)",
      );
      continue;
    }
    const [{ data: vinc, error: erroVinc }, { data: saldos, error: erroSaldos }] =
      await Promise.all([
        supabaseAdmin
          .from("anuncio_vinculos")
          .select("sku_id, produto_externo_id, sku_externo_id")
          .eq("user_id", userId)
          .eq("canal", CANAL)
          .eq("sincroniza_estoque", true)
          .in("sku_id", skuIds),
        supabaseAdmin.from("estoque_saldos").select("sku_id, saldo").in("sku_id", skuIds),
      ]);
    // Leitura que falha não pode virar quantidade zero (revisão 3c.5).
    const erroLeitura = erroVinc ?? erroSaldos;
    if (erroLeitura) {
      await marcarFilaEstoque(skuIds, `estoque: leitura da Pólia falhou (${erroLeitura.message})`);
      continue;
    }
    const saldoDe = new Map(
      ((saldos as { sku_id: string; saldo: number }[]) ?? []).map((s) => [
        s.sku_id,
        Number(s.saldo),
      ]),
    );
    // Variação sem saldo na Pólia (arquivada) não manda nada, nunca zero.
    const vinculos = (
      (vinc as { sku_id: string; produto_externo_id: string; sku_externo_id: string }[]) ?? []
    ).filter((v) => saldoDe.has(v.sku_id));
    const porProduto = new Map<string, typeof vinculos>();
    for (const v of vinculos)
      porProduto.set(v.produto_externo_id, [...(porProduto.get(v.produto_externo_id) ?? []), v]);

    const semVinculo = skuIds.filter((id) => !vinculos.some((v) => v.sku_id === id));
    await concluirFilaEstoque(semVinculo, pedidoEmDe); // sem vínculo ou sem saldo: nada a mandar

    for (const [produtoId, lista] of porProduto) {
      const { produto } = await detalheProdutoTiktok(cred, { ...acesso, produtoId });
      const corpo = corpoAtualizarEstoque(
        lista.map((v) => ({ skuExternoId: v.sku_externo_id, saldo: saldoDe.get(v.sku_id)! })),
        produto ? depositosDoProduto(produto) : new Map(),
      );
      const { error } = await atualizarEstoqueTiktok(cred, { ...acesso, produtoId, corpo });
      const ids = [...new Set(lista.map((v) => v.sku_id))];
      if (error) {
        await marcarFilaEstoque(ids, `estoque: ${error}`);
        continue;
      }
      await concluirFilaEstoque(ids, pedidoEmDe);
      enviados += ids.length;
    }
  }
  return enviados;
}

Deno.serve(async (req: Request) => {
  if (!(await autenticado(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  if (!APP_KEY || !APP_SECRET) {
    return new Response(JSON.stringify({ ok: false, motivo: "sem_credenciais" }), { status: 500 });
  }
  // O cron dispara todo minuto e uma rodada pode passar disso: duas ao mesmo
  // tempo renovariam o mesmo refresh_token. A trava vence sozinha em 2 minutos.
  const { data: pegou } = await supabaseAdmin.rpc("pegar_trava_sync", {
    p_canal: CANAL,
    p_segundos: 120,
  });
  if (pegou !== true) {
    return new Response(JSON.stringify({ ok: true, motivo: "em_andamento" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    return new Response(JSON.stringify({ ok: true, ...(await sincronizar()) }), {
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    await supabaseAdmin.rpc("soltar_trava_sync", { p_canal: CANAL });
  }
});

async function sincronizar() {
  const { data: conexoesData } = await supabaseAdmin
    .from("canal_conexoes")
    .select("id, user_id, shop_id, shop_cipher, ultimo_sync, varredura_tentada_em, cuida_estoque")
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
    const ultimaTentativa = Math.max(
      c.ultimo_sync ? Date.parse(c.ultimo_sync) : 0,
      c.varredura_tentada_em ? Date.parse(c.varredura_tentada_em) : 0,
    );
    if (ultimaTentativa > limite) continue;
    // Marca a tentativa antes: sem Pro ou com erro do TikTok, a próxima espera
    // 15 minutos (o ultimo_sync, que é o "desde" da varredura, só anda se der certo).
    await supabaseAdmin
      .from("canal_conexoes")
      .update({ varredura_tentada_em: new Date().toISOString() })
      .eq("id", c.id);
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
        .select("frete_gratis")
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
    const freteGratis = (taxa as { frete_gratis: boolean } | null)?.frete_gratis === true;

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
        const erro = await processarPedido(c, pedido, vinculos, freteGratis);
        if (!erro && statusVendaDoPedido(pedido.status) === "a_receber") vendas++;
        await marcarEventos([e.id], erro);
      }
    }
  }

  // 3. Estoque Pólia → TikTok.
  const estoque = await enviarEstoque(conexoes, acessoDe);

  return { varridos, eventos: eventos.length, vendas, estoque };
}
