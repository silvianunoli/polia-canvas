import { createClient } from "npm:@supabase/supabase-js@2";
import {
  custoEnvioDaVendedora,
  dataDoPedido,
  itensDoPedido,
  observacaoDoPedido,
  statusVendaDoPedido,
  tarifaDoPedido,
  alvoDoEstoque,
  anuncioNoFull,
  quantidadeParaCanal,
  type PedidoApiMl,
} from "../_shared/mercadoLivre.ts";
import { MSG_RECONECTAR_ML, tokenComTrava, type RpcBanco } from "../_shared/mercadoLivreAcesso.ts";
import {
  custosEnvioMl,
  pedidoMl,
  pedidosAlteradosMl,
  pedirTokenMl,
  atualizarEstoqueMl,
  estadoAnuncioMl,
  type CredenciaisMl,
} from "../_shared/mercadoLivreCliente.ts";

// Sincronização do Mercado Livre (Fase 3c, etapa 3c.3, VND-30). Chamada só pelo
// pg_cron (disparar_ml_sync(), migração 20261025100000) a cada minuto, e só
// quando há trabalho. verify_jwt desligado: o segredo do cron mora no Vault e é
// conferido por RPC, igual ao tiktok-sync.
//
// 1. Varredura: conta sem sincronizar há 15 minutos busca os pedidos alterados
//    desde a última vez e põe na fila (cobre aviso perdido).
// 2. Fila: busca cada pedido e registra a venda (pago) com a tarifa real e o
//    frete que a vendedora pagou, ou cancela (cancelado ou fraude).
// Token: _shared/mercadoLivreAcesso.ts, com a trava por conexão (o de renovação
// é de uso único; o Worker renova pela mesma trava).
// 3. Estoque (etapa 3c.4): variação ligada que mexeu na Pólia, com "A Pólia cuida
//    do estoque" ligado, manda o saldo para o anúncio (canal_fila_estoque). Roda
//    depois dos pedidos: a baixa da venda que acabou de entrar já vai junto.
//    Anúncio no Full fica de fora: o estoque é do galpão do Mercado Livre.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLIENT_ID = Deno.env.get("MERCADO_LIVRE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("MERCADO_LIVRE_CLIENT_SECRET") ?? "";
const CANAL = "mercado_livre";
const MAX_EVENTOS = 100;
const MAX_TENTATIVAS = 5;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const cred: CredenciaisMl = { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET };
const rpc: RpcBanco = (nome, args) => supabaseAdmin.rpc(nome, args);

type Conexao = {
  id: string;
  user_id: string;
  shop_id: string;
  ultimo_sync: string | null;
  varredura_tentada_em: string | null;
  cuida_estoque: boolean;
};
type Acesso = { accessToken: string; vendedoraId: string };

async function autenticado(req: Request): Promise<boolean> {
  const recebido = req.headers.get("x-ml-sync-secret") ?? "";
  if (!recebido) return false;
  const { data, error } = await supabaseAdmin.rpc("conferir_segredo_ml_sync", {
    p_segredo: recebido,
  });
  if (error) console.error("[ml-sync] Falha ao conferir o segredo:", error.message);
  return data === true;
}

async function marcarErroConexao(conexaoId: string, motivo: string) {
  console.warn("[ml-sync] Conexão em erro:", conexaoId, motivo);
  await supabaseAdmin
    .from("canal_conexoes")
    .update({
      status: "erro",
      ultimo_erro: MSG_RECONECTAR_ML,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conexaoId);
}

async function obterAcesso(c: Conexao): Promise<Acesso | null> {
  const { accessToken } = await tokenComTrava(c.id, {
    rpc,
    renovar: (refreshToken) => pedirTokenMl(cred, { grant: "refresh_token", refreshToken }),
    marcarErro: marcarErroConexao,
  });
  return accessToken ? { accessToken, vendedoraId: c.shop_id } : null;
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
  const desdeIso = new Date(ultimo - 5 * 60 * 1000).toISOString();
  let total = 0;
  for (let pagina = 0; pagina < 4; pagina++) {
    const r = await pedidosAlteradosMl({ ...acesso, desdeIso, offset: pagina * 50 });
    if (r.error) return -1;
    const linhas = r.ids.map((id) => ({
      canal: CANAL,
      shop_id: c.shop_id,
      id_externo: id,
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
    if (r.ids.length < 50 || (pagina + 1) * 50 >= r.total) break;
  }
  await supabaseAdmin
    .from("canal_conexoes")
    .update({ ultimo_sync: new Date().toISOString() })
    .eq("id", c.id);
  return total;
}

/** Frete que a vendedora pagou; null quando o Mercado Livre não respondeu. */
async function freteDaVendedora(acesso: Acesso, pedido: PedidoApiMl): Promise<number | null> {
  const envioId = pedido.shipping?.id;
  if (envioId == null || envioId === "") return 0; // sem envio do Mercado Livre (retirada, a combinar)
  const { custos, error } = await custosEnvioMl({ ...acesso, envioId: String(envioId) });
  if (error) return null;
  return custoEnvioDaVendedora(custos, acesso.vendedoraId);
}

async function processarPedido(
  c: Conexao,
  acesso: Acesso,
  pedido: PedidoApiMl,
  vinculos: Map<string, string>,
): Promise<string | null> {
  const pedidoId = String(pedido.id);
  const status = statusVendaDoPedido(pedido);
  if (status === null) return null; // pagamento pendente: quando pagar, o Mercado Livre avisa de novo
  if (status === "cancelada") {
    const { error } = await supabaseAdmin.rpc("cancelar_venda_canal", {
      p_user_id: c.user_id,
      p_canal: CANAL,
      p_id_externo: pedidoId,
    });
    return error ? error.message : null;
  }
  const itens = itensDoPedido(pedido, vinculos);
  if (!itens.length) return "pedido sem itens";
  // Frete não lido não segura a venda: entra com zero e a observação avisa.
  const frete = await freteDaVendedora(acesso, pedido);
  const { error } = await supabaseAdmin.rpc("registrar_venda_canal", {
    p_user_id: c.user_id,
    p_canal: CANAL,
    p_id_externo: pedidoId,
    p_data: dataDoPedido(pedido),
    p_itens: itens,
    p_taxa_canal: tarifaDoPedido(pedido),
    p_observacao: observacaoDoPedido(pedidoId, itens, frete === null),
    p_custo_envio: frete ?? 0,
  });
  return error ? error.message : null;
}

Deno.serve(async (req: Request) => {
  if (!(await autenticado(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return new Response(JSON.stringify({ ok: false, motivo: "sem_credenciais" }), { status: 500 });
  }
  // O cron dispara todo minuto e uma rodada pode passar disso. A trava vence
  // sozinha em 2 minutos. (A renovação de token tem trava própria por conexão.)
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
    .select("id, user_id, shop_id, ultimo_sync, varredura_tentada_em, cuida_estoque")
    .eq("canal", CANAL)
    .eq("status", "conectada");
  const conexoes = ((conexoesData as Conexao[] | null) ?? []).filter((c) => !!c.shop_id);
  const porVendedora = new Map(conexoes.map((c) => [c.shop_id, c]));
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
    // Marca a tentativa antes: sem Pro ou com erro do Mercado Livre, a próxima
    // espera 15 minutos (o ultimo_sync, "desde" da varredura, só anda se der certo).
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
  for (const [vendedoraId, lista] of grupos) {
    const c = porVendedora.get(vendedoraId);
    if (!c) {
      await marcarEventos(
        lista.map((e) => e.id),
        "conta do Mercado Livre não conectada na Pólia",
      );
      continue;
    }
    const acesso = await acessoDe(c);
    if (!acesso) {
      await marcarEventos(
        lista.map((e) => e.id),
        "sem acesso à conta (plano ou autorização)",
      );
      continue;
    }
    const { data: vinc } = await supabaseAdmin
      .from("anuncio_vinculos")
      .select("sku_externo_id, sku_id")
      .eq("user_id", c.user_id)
      .eq("canal", CANAL);
    const vinculos = new Map(
      ((vinc as { sku_externo_id: string; sku_id: string }[]) ?? []).map((v) => [
        v.sku_externo_id,
        v.sku_id,
      ]),
    );

    for (const e of lista) {
      const { pedido, status, error } = await pedidoMl({ ...acesso, pedidoId: e.id_externo });
      if (!pedido) {
        await marcarEventos([e.id], `pedido: ${error ?? `HTTP ${status}`}`);
        continue;
      }
      const erro = await processarPedido(c, acesso, pedido, vinculos);
      if (!erro && statusVendaDoPedido(pedido) === "a_receber") vendas++;
      await marcarEventos([e.id], erro);
    }
  }

  // 3. Estoque Pólia → Mercado Livre.
  const estoque = await enviarEstoque(conexoes, acessoDe);

  return { varridos, eventos: eventos.length, vendas, estoque };
}

async function marcarFilaEstoque(skuIds: string[], erro: string | null) {
  if (!skuIds.length) return;
  if (!erro) {
    await supabaseAdmin
      .from("canal_fila_estoque")
      .update({ pendente: false, enviado_em: new Date().toISOString(), erro: null })
      .eq("canal", CANAL)
      .in("sku_id", skuIds);
    return;
  }
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
    .select("user_id, sku_id")
    .eq("canal", CANAL)
    .eq("pendente", true)
    .lt("tentativas", MAX_TENTATIVAS)
    .order("pedido_em")
    .limit(200);
  const fila = (filaData as { user_id: string; sku_id: string }[] | null) ?? [];
  const porDona = new Map<string, string[]>();
  for (const f of fila) porDona.set(f.user_id, [...(porDona.get(f.user_id) ?? []), f.sku_id]);

  let enviados = 0;
  for (const [userId, skuIds] of porDona) {
    const c = conexoes.find((x) => x.user_id === userId);
    const acesso = c?.cuida_estoque ? await acessoDe(c) : null;
    if (!c || !acesso) {
      await marcarFilaEstoque(
        skuIds,
        "sem acesso à conta (plano, autorização ou estoque desligado)",
      );
      continue;
    }
    const [{ data: vinc }, { data: saldos }] = await Promise.all([
      supabaseAdmin
        .from("anuncio_vinculos")
        .select("sku_id, sku_externo_id")
        .eq("user_id", userId)
        .eq("canal", CANAL)
        .eq("sincroniza_estoque", true)
        .in("sku_id", skuIds),
      supabaseAdmin.from("estoque_saldos").select("sku_id, saldo").in("sku_id", skuIds),
    ]);
    const saldoDe = new Map(
      ((saldos as { sku_id: string; saldo: number }[]) ?? []).map((s) => [
        s.sku_id,
        Number(s.saldo),
      ]),
    );
    const vinculos = (vinc as { sku_id: string; sku_externo_id: string }[]) ?? [];
    const semVinculo = skuIds.filter((id) => !vinculos.some((v) => v.sku_id === id));
    await marcarFilaEstoque(semVinculo, null); // desligou ou apagou o vínculo: nada a mandar

    // Uma consulta por anúncio para saber se está no Full (cache na rodada).
    const noFull = new Map<string, boolean | null>();
    const estaNoFull = async (itemId: string) => {
      if (!noFull.has(itemId)) {
        const { anuncio } = await estadoAnuncioMl({ ...acesso, itemId });
        noFull.set(itemId, anuncio ? anuncioNoFull(anuncio) : null);
      }
      return noFull.get(itemId) ?? null;
    };

    // A mesma variação da Pólia pode estar ligada a mais de um anúncio: todos recebem.
    const porSku = new Map<string, string[]>();
    for (const v of vinculos)
      porSku.set(v.sku_id, [...(porSku.get(v.sku_id) ?? []), v.sku_externo_id]);
    for (const [skuId, externos] of porSku) {
      const quantidade = quantidadeParaCanal(saldoDe.get(skuId) ?? 0);
      let erro: string | null = null;
      for (const externo of externos) {
        const alvo = alvoDoEstoque(externo);
        if (!alvo) continue; // vínculo fora do formato: nada a mandar
        const full = await estaNoFull(alvo.itemId);
        if (full === null) {
          erro = "estoque: anúncio não encontrado no Mercado Livre";
          continue;
        }
        if (full) continue;
        const { error } = await atualizarEstoqueMl({ ...acesso, ...alvo, quantidade });
        if (error) erro = `estoque: ${error}`;
      }
      await marcarFilaEstoque([skuId], erro);
      if (!erro) enviados++;
    }
  }
  return enviados;
}
