import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { registrarEventoSistema } from "@/lib/founder-eventos.server";
import { temProjete } from "@/lib/planos";
import {
  lojasAutorizadas,
  montarUrlAutorizacao,
  tiktokConfigurado,
  trocarCodigoPorTokens,
} from "./tiktokShopApi";

// Conexão com o TikTok Shop (Fase 3a, VND-05). Mesmo desenho do Google Agenda
// (state guardado e conferido na volta), com o token no Supabase Vault em vez de
// coluna: a tabela só tem o id do segredo, gravado pela RPC canal_token_salvar.

const CANAL = "tiktok_shop";

interface ConexaoRow {
  id: string;
  status: "pendente" | "conectada" | "erro";
  state_pendente: string | null;
  loja_nome: string | null;
  ultimo_sync: string | null;
  ultimo_erro: string | null;
  cuida_estoque: boolean;
}

async function lerConexao(userId: string): Promise<ConexaoRow | null> {
  const { data } = await supabaseAdmin
    .from("canal_conexoes" as never)
    .select("id, status, state_pendente, loja_nome, ultimo_sync, ultimo_erro, cuida_estoque")
    .eq("user_id", userId)
    .eq("canal", CANAL)
    .maybeSingle();
  return (data as unknown as ConexaoRow) ?? null;
}

async function temPro(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("plano")
    .eq("id", userId)
    .maybeSingle();
  return temProjete(data?.plano as string | null | undefined);
}

export const statusConexaoTiktok = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!tiktokConfigurado()) return { configurado: false as const };
    const [conexao, pro, vinculos] = await Promise.all([
      lerConexao(context.userId),
      temPro(context.userId),
      supabaseAdmin
        .from("anuncio_vinculos" as never)
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("canal", CANAL),
    ]);
    const conectada = conexao?.status === "conectada";
    return {
      configurado: true as const,
      liberado: pro,
      conectada,
      lojaNome: conectada ? conexao!.loja_nome : null,
      ultimoSync: conectada ? conexao!.ultimo_sync : null,
      erro: conexao?.status === "erro" ? conexao.ultimo_erro : null,
      cuidaEstoque: conexao?.cuida_estoque ?? false,
      anunciosLigados: vinculos.count ?? 0,
    };
  });

export const iniciarConexaoTiktok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await temPro(context.userId)))
      return { url: null, error: "A integração com o TikTok Shop é do plano Pro." };
    const atual = await lerConexao(context.userId);
    if (atual?.status === "conectada")
      return {
        url: null,
        error: "O TikTok Shop já está conectado. Desconecta antes de trocar de loja.",
      };

    const state = crypto.randomUUID();
    const { error } = await supabaseAdmin.from("canal_conexoes" as never).upsert(
      {
        user_id: context.userId,
        canal: CANAL,
        status: "pendente",
        state_pendente: state,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,canal" },
    );
    if (error)
      return { url: null, error: "A Pólia One não conseguiu iniciar a conexão. Tenta de novo." };
    return montarUrlAutorizacao(state);
  });

const finalizarInput = z.object({
  code: z.string().min(1).max(500),
  state: z.string().min(1).max(100),
});

export const finalizarConexaoTiktok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => finalizarInput.parse(input))
  .handler(async ({ data, context }) => {
    const conexao = await lerConexao(context.userId);
    if (!conexao || conexao.state_pendente !== data.state)
      return { ok: false, error: "Essa conexão expirou ou não é sua. Tenta conectar de novo." };
    if (!(await temPro(context.userId)))
      return { ok: false, error: "A integração com o TikTok Shop é do plano Pro." };

    const { tokens, error } = await trocarCodigoPorTokens(data.code);
    if (error || !tokens)
      return { ok: false, error: error ?? "O TikTok Shop não confirmou a autorização." };

    // A vendedora brasileira tem uma loja; com mais de uma, fica a do Brasil.
    const { lojas, error: erroLojas } = await lojasAutorizadas(tokens.accessToken);
    const loja = lojas.find((l) => l.region === "BR") ?? lojas[0];
    if (erroLojas || !loja) {
      registrarEventoSistema({
        tipo: "integration_failure",
        origem: "tiktokShop.functions",
        servico: "tiktok_shop",
        detalhes: { motivo: "sem_loja_autorizada", erro: erroLojas },
      });
      return {
        ok: false,
        error:
          "O TikTok Shop autorizou, mas não mostrou nenhuma loja. Confere se a loja está aprovada.",
      };
    }

    // Mesma loja já conectada em outra conta da Pólia: o webhook não saberia de quem é o pedido.
    const { data: outra } = await supabaseAdmin
      .from("canal_conexoes" as never)
      .select("id")
      .eq("canal", CANAL)
      .eq("shop_id", loja.id)
      .neq("user_id", context.userId)
      .maybeSingle();
    if (outra)
      return {
        ok: false,
        error: "Essa loja do TikTok Shop já está conectada em outra conta da Pólia One.",
      };

    const { error: erroTokens } = await supabaseAdmin.rpc(
      "canal_token_salvar" as never,
      {
        p_conexao_id: conexao.id,
        p_access: tokens.accessToken,
        p_refresh: tokens.refreshToken,
        p_access_expira: tokens.accessExpiraEm,
        p_refresh_expira: tokens.refreshExpiraEm,
      } as never,
    );
    if (erroTokens)
      return {
        ok: false,
        error: "A Pólia One conectou com o TikTok Shop, mas não conseguiu salvar. Tenta de novo.",
      };

    const { error: erroSalvar } = await supabaseAdmin
      .from("canal_conexoes" as never)
      .update({
        status: "conectada",
        state_pendente: null,
        shop_id: loja.id,
        shop_cipher: loja.cipher,
        loja_nome: loja.name,
        regiao: loja.region,
        ultimo_erro: null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", conexao.id);
    if (erroSalvar)
      return {
        ok: false,
        error: "A Pólia One conectou com o TikTok Shop, mas não conseguiu salvar. Tenta de novo.",
      };
    return { ok: true, error: null, lojaNome: loja.name };
  });

export const desconectarTiktok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // O TikTok não tem chamada de revogar: a Pólia apaga os tokens (gatilho leva
    // os segredos do Vault) e os vínculos. A vendedora pode tirar a autorização
    // também no Seller Center. Vendas já registradas ficam: são dela.
    const { error } = await supabaseAdmin
      .from("canal_conexoes" as never)
      .delete()
      .eq("user_id", context.userId)
      .eq("canal", CANAL);
    if (error)
      return { ok: false, error: "A Pólia One não conseguiu desconectar agora. Tenta de novo." };
    await supabaseAdmin
      .from("anuncio_vinculos" as never)
      .delete()
      .eq("user_id", context.userId)
      .eq("canal", CANAL);
    return { ok: true, error: null };
  });
