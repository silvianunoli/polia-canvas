import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { registrarEventoSistema } from "@/lib/founder-eventos.server";
import { temProjete } from "@/lib/planos";
import { gerarVerificadorPkce } from "../../supabase/functions/_shared/mercadoLivre.ts";
import {
  lerVendedora,
  mercadoLivreConfigurado,
  montarUrlAutorizacao,
  revogarAutorizacao,
  trocarCodigoPorTokens,
} from "./mercadoLivreApi";
import { obterAcessoMercadoLivre } from "./mercadoLivreAcesso.server";

// Conexão com o Mercado Livre (Fase 3c, VND-30). Mesmo desenho do TikTok Shop
// (state guardado e conferido na volta, token no Supabase Vault), com PKCE: o
// verificador fica na conexão junto do state e vai na troca do code.
//
// Diferente do TikTok, a autorização sempre começa na Pólia: volta sem state ou
// com state que não bate é recusada, sem tela de confirmação.
//
// Aqui o token só é gravado ao conectar. Renovar fica com mercadoLivreAcesso.server.ts
// e o ml-sync, pela mesma trava (o de renovação é de uso único; ADR-003).

const CANAL = "mercado_livre";
const SO_PRO = "A integração com o Mercado Livre é do plano Pro.";

interface ConexaoRow {
  id: string;
  status: "pendente" | "aguardando_confirmacao" | "conectada" | "erro";
  state_pendente: string | null;
  verificador_pendente: string | null;
  shop_id: string | null;
  loja_nome: string | null;
  ultimo_sync: string | null;
  ultimo_erro: string | null;
  cuida_estoque: boolean;
}

async function lerConexao(userId: string): Promise<ConexaoRow | null> {
  const { data } = await supabaseAdmin
    .from("canal_conexoes" as never)
    .select(
      "id, status, state_pendente, verificador_pendente, shop_id, loja_nome, ultimo_sync, ultimo_erro, cuida_estoque",
    )
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

export const statusConexaoMercadoLivre = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!mercadoLivreConfigurado()) return { configurado: false as const };
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

export const iniciarConexaoMercadoLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await temPro(context.userId))) return { url: null, error: SO_PRO };
    const atual = await lerConexao(context.userId);
    if (atual?.status === "conectada")
      return {
        url: null,
        error: "O Mercado Livre já está conectado. Desconecta antes de trocar de conta.",
      };

    const state = crypto.randomUUID();
    const verificador = gerarVerificadorPkce();
    const { error } = await supabaseAdmin.from("canal_conexoes" as never).upsert(
      {
        user_id: context.userId,
        canal: CANAL,
        status: "pendente",
        state_pendente: state,
        verificador_pendente: verificador,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,canal" },
    );
    if (error)
      return { url: null, error: "A Pólia One não conseguiu iniciar a conexão. Tenta de novo." };
    return montarUrlAutorizacao(state, verificador);
  });

const finalizarInput = z.object({
  code: z.string().min(1).max(500),
  state: z.string().min(1).max(100),
});

export const finalizarConexaoMercadoLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => finalizarInput.parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: boolean; error: string | null; lojaNome?: string }> => {
      const conexao = await lerConexao(context.userId);
      if (!conexao || conexao.state_pendente !== data.state || !conexao.verificador_pendente)
        return { ok: false, error: "Essa conexão expirou ou não é sua. Tenta conectar de novo." };
      if (!(await temPro(context.userId))) return { ok: false, error: SO_PRO };

      // O state e o verificador valem uma vez: zera antes de trocar o code, para uma
      // segunda volta com o mesmo link não reaproveitar.
      await supabaseAdmin
        .from("canal_conexoes" as never)
        .update({ state_pendente: null, verificador_pendente: null } as never)
        .eq("id", conexao.id);

      const { tokens, error } = await trocarCodigoPorTokens(
        data.code,
        conexao.verificador_pendente,
      );
      if (error || !tokens)
        return { ok: false, error: error ?? "O Mercado Livre não confirmou a autorização." };

      // Mesma conta do Mercado Livre ligada em outra conta da Pólia: o aviso de
      // pedido não saberia de quem é a venda.
      const { data: outra } = await supabaseAdmin
        .from("canal_conexoes" as never)
        .select("id")
        .eq("canal", CANAL)
        .eq("shop_id", tokens.vendedoraId)
        .neq("user_id", context.userId)
        .maybeSingle();
      if (outra)
        return {
          ok: false,
          error: "Essa conta do Mercado Livre já está conectada em outra conta da Pólia One.",
        };

      const { vendedora, error: erroConta } = await lerVendedora(tokens.accessToken);
      if (erroConta || !vendedora || vendedora.id !== tokens.vendedoraId) {
        registrarEventoSistema({
          tipo: "integration_failure",
          origem: "mercadoLivre.functions",
          servico: "mercado_livre",
          detalhes: { motivo: "users_me", erro: erroConta },
        });
      }

      const { error: erroTokens } = await supabaseAdmin.rpc(
        "canal_token_salvar" as never,
        {
          p_conexao_id: conexao.id,
          p_access: tokens.accessToken,
          p_refresh: tokens.refreshToken,
          p_access_expira: tokens.accessExpiraEm,
          // O de renovação não tem validade fixa: vale até ser usado.
          p_refresh_expira: null,
        } as never,
      );
      if (erroTokens)
        return {
          ok: false,
          error:
            "A Pólia One conectou com o Mercado Livre, mas não conseguiu salvar. Tenta de novo.",
        };

      // Reconectou com OUTRA conta do Mercado Livre (a antiga tinha caído em erro):
      // as ligações eram de anúncios da conta antiga e não valem mais.
      if (conexao.shop_id && conexao.shop_id !== tokens.vendedoraId)
        await supabaseAdmin
          .from("anuncio_vinculos" as never)
          .delete()
          .eq("user_id", context.userId)
          .eq("canal", CANAL);

      const lojaNome = vendedora?.apelido ?? "Conta do Mercado Livre";
      const { error: erroSalvar } = await supabaseAdmin
        .from("canal_conexoes" as never)
        .update({
          status: "conectada",
          shop_id: tokens.vendedoraId,
          loja_nome: lojaNome,
          regiao: "BR",
          ultimo_erro: null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", conexao.id);
      if (erroSalvar)
        return {
          ok: false,
          error:
            "A Pólia One conectou com o Mercado Livre, mas não conseguiu salvar. Tenta de novo.",
        };
      return { ok: true, error: null, lojaNome };
    },
  );

export const desconectarMercadoLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Tenta tirar a autorização do lado do Mercado Livre (melhor esforço: falhou,
    // segue). Depois apaga a conexão (o gatilho leva os tokens do Vault) e os
    // vínculos. Vendas já registradas ficam: são dela.
    const { acesso } = await obterAcessoMercadoLivre(context.userId);
    if (acesso) await revogarAutorizacao(acesso.accessToken, acesso.vendedoraId);
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

const cuidaEstoqueInput = z.object({ ligar: z.boolean() });

/**
 * "A Pólia cuida do estoque" (etapa 3c.4): ligado, todo movimento de estoque de
 * variação ligada manda o saldo para o Mercado Livre (o ml-sync manda; anúncio no
 * Full fica de fora). Ao ligar, enfileira todas as variações ligadas, para o
 * Mercado Livre começar igual à Pólia.
 */
export const alternarCuidaEstoqueMercadoLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cuidaEstoqueInput.parse(input))
  .handler(async ({ data, context }) => {
    if (data.ligar && !(await temPro(context.userId))) return { ok: false, error: SO_PRO };
    const conexao = await lerConexao(context.userId);
    if (conexao?.status !== "conectada")
      return { ok: false, error: "O Mercado Livre não está conectado." };
    const { error } = await supabaseAdmin
      .from("canal_conexoes" as never)
      .update({ cuida_estoque: data.ligar, updated_at: new Date().toISOString() } as never)
      .eq("id", conexao.id);
    if (error)
      return { ok: false, error: "A Pólia One não conseguiu salvar agora. Tenta de novo." };
    if (!data.ligar) return { ok: true, error: null };

    const { data: vinculos } = await supabaseAdmin
      .from("anuncio_vinculos" as never)
      .select("sku_id")
      .eq("user_id", context.userId)
      .eq("canal", CANAL);
    const skuIds = [
      ...new Set(((vinculos as unknown as { sku_id: string }[]) ?? []).map((v) => v.sku_id)),
    ];
    if (skuIds.length)
      await supabaseAdmin.rpc("enfileirar_estoque_canal" as never, { p_sku_ids: skuIds } as never);
    return { ok: true, error: null };
  });
