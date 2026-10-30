import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { registrarEventoSistema } from "@/lib/founder-eventos.server";
import { temProjete } from "@/lib/planos";
import {
  NOME_REDE,
  REDES,
  contaInstagramProfissional,
  escoposInstagramCompletos,
  escoposTiktokCompletos,
  limparCodigoInstagram,
  type PerfilRede,
  type Rede,
} from "../../supabase/functions/_shared/redesSociais.ts";
import {
  montarUrlAutorizacao,
  perfilInstagram,
  perfilTiktok,
  redeConfigurada,
  redesAbertasParaClientes,
  revogarAutorizacaoTiktok,
  trocarCodigoDoInstagram,
  trocarCodigoTiktok,
} from "./redesSociaisApi";

// Conexão do TikTok e do Instagram da cliente (Agenda das redes, ONE-154). Mesmo
// desenho do TikTok Shop: state guardado e conferido na volta, token no Vault
// (RPC redes_token_salvar), tabela sem leitura pelo navegador. Diferente de lá,
// aqui a autorização só começa na Pólia: volta sem o state certo é recusada.
//
// Até as revisões do TikTok e da Meta aprovarem, só conta admin vê (sandbox).

const redeInput = z.object({ rede: z.enum(["tiktok", "instagram"]) });

interface ConexaoRow {
  id: string;
  rede: Rede;
  status: "pendente" | "conectada" | "erro";
  state_pendente: string | null;
  conta_usuario: string | null;
  conta_nome: string | null;
  conta_foto_url: string | null;
  ultimo_erro: string | null;
}

const COLUNAS =
  "id, rede, status, state_pendente, conta_usuario, conta_nome, conta_foto_url, ultimo_erro";

async function lerConexao(userId: string, rede: Rede): Promise<ConexaoRow | null> {
  const { data } = await supabaseAdmin
    .from("redes_conexoes" as never)
    .select(COLUNAS)
    .eq("user_id", userId)
    .eq("rede", rede)
    .maybeSingle();
  return (data as unknown as ConexaoRow) ?? null;
}

async function acessoDaConta(userId: string): Promise<{ visivel: boolean; pro: boolean }> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("plano, is_admin")
    .eq("id", userId)
    .maybeSingle();
  const perfil = data as { plano?: string | null; is_admin?: boolean | null } | null;
  return {
    visivel: redesAbertasParaClientes() || perfil?.is_admin === true,
    pro: temProjete(perfil?.plano),
  };
}

const SO_NO_PRO = "A Agenda das redes é do plano Pro.";

export type StatusRede = {
  rede: Rede;
  conectada: boolean;
  usuario: string | null;
  nome: string | null;
  fotoUrl: string | null;
  erro: string | null;
};

export const statusRedesSociais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { visivel, pro } = await acessoDaConta(context.userId);
    const configuradas = REDES.filter(redeConfigurada);
    if (!visivel || configuradas.length === 0)
      return { visivel: false as const, liberado: false, redes: [] as StatusRede[] };

    const redes = await Promise.all(
      configuradas.map(async (rede): Promise<StatusRede> => {
        const c = await lerConexao(context.userId, rede);
        const conectada = c?.status === "conectada";
        return {
          rede,
          conectada,
          usuario: conectada ? c!.conta_usuario : null,
          nome: conectada ? c!.conta_nome : null,
          fotoUrl: conectada ? c!.conta_foto_url : null,
          erro: c?.status === "erro" ? c.ultimo_erro : null,
        };
      }),
    );
    return { visivel: true as const, liberado: pro, redes };
  });

export const iniciarConexaoRede = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => redeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { visivel, pro } = await acessoDaConta(context.userId);
    if (!visivel || !redeConfigurada(data.rede))
      return { url: null, error: "A conexão com essa rede ainda não está disponível." };
    if (!pro) return { url: null, error: SO_NO_PRO };

    const atual = await lerConexao(context.userId, data.rede);
    if (atual?.status === "conectada")
      return {
        url: null,
        error: `O ${NOME_REDE[data.rede]} já está conectado. Desconecta antes de trocar de conta.`,
      };

    const state = crypto.randomUUID();
    const { error } = await supabaseAdmin.from("redes_conexoes" as never).upsert(
      {
        user_id: context.userId,
        rede: data.rede,
        status: atual?.status === "erro" ? "erro" : "pendente",
        state_pendente: state,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,rede" },
    );
    if (error)
      return { url: null, error: "A Pólia One não conseguiu iniciar a conexão. Tenta de novo." };
    return montarUrlAutorizacao(data.rede, state);
  });

const finalizarInput = z.object({
  rede: z.enum(["tiktok", "instagram"]),
  code: z.string().min(1).max(1000),
  state: z.string().min(1).max(100),
});

type Autorizacao = {
  accessToken: string;
  refreshToken: string | null;
  accessExpiraEm: string;
  refreshExpiraEm: string | null;
  contaId: string;
  escopos: string;
  perfil: PerfilRede;
};

async function autorizarTiktok(
  code: string,
): Promise<{ auth: Autorizacao | null; error: string | null }> {
  const r = await trocarCodigoTiktok(code);
  if (!r.valor) return { auth: null, error: r.error };
  if (!escoposTiktokCompletos(r.valor.escopos))
    return {
      auth: null,
      error:
        "O TikTok conectou sem a permissão de publicar. Conecta de novo e deixa as duas permissões marcadas.",
    };
  const perfil = await perfilTiktok(r.valor.accessToken);
  return {
    auth: {
      accessToken: r.valor.accessToken,
      refreshToken: r.valor.refreshToken,
      accessExpiraEm: r.valor.accessExpiraEm,
      refreshExpiraEm: r.valor.refreshExpiraEm,
      contaId: r.valor.openId,
      escopos: r.valor.escopos,
      perfil,
    },
    error: null,
  };
}

async function autorizarInstagram(
  code: string,
): Promise<{ auth: Autorizacao | null; error: string | null }> {
  const r = await trocarCodigoDoInstagram(limparCodigoInstagram(code));
  if (!r.valor) return { auth: null, error: r.error };
  if (!escoposInstagramCompletos(r.valor.escopos))
    return {
      auth: null,
      error:
        "O Instagram conectou sem a permissão de publicar. Conecta de novo e deixa as permissões marcadas.",
    };
  const perfil = await perfilInstagram(r.valor.accessToken);
  if (!contaInstagramProfissional(perfil.tipoConta))
    return {
      auth: null,
      error:
        "Essa conta do Instagram é pessoal. A publicação funciona em conta profissional (comercial ou de criador de conteúdo), que dá pra trocar nas configurações do Instagram.",
    };
  return {
    auth: {
      accessToken: r.valor.accessToken,
      refreshToken: null,
      accessExpiraEm: r.valor.accessExpiraEm,
      refreshExpiraEm: null,
      contaId: perfil.contaId ?? r.valor.userId,
      escopos: r.valor.escopos,
      perfil,
    },
    error: null,
  };
}

export const finalizarConexaoRede = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => finalizarInput.parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: boolean; error: string | null; usuario?: string | null }> => {
      const conexao = await lerConexao(context.userId, data.rede);
      if (!conexao || conexao.status === "conectada" || conexao.state_pendente !== data.state)
        return { ok: false, error: "Essa conexão expirou ou não é sua. Tenta conectar de novo." };
      const { visivel, pro } = await acessoDaConta(context.userId);
      if (!visivel)
        return { ok: false, error: "A conexão com essa rede ainda não está disponível." };
      if (!pro) return { ok: false, error: SO_NO_PRO };

      const { auth, error } =
        data.rede === "tiktok"
          ? await autorizarTiktok(data.code)
          : await autorizarInstagram(data.code);
      if (!auth) {
        registrarEventoSistema({
          tipo: "integration_failure",
          origem: "redesSociais.functions",
          servico: data.rede,
          detalhes: { motivo: "autorizacao_recusada" },
        });
        return {
          ok: false,
          error: error ?? `O ${NOME_REDE[data.rede]} não confirmou a autorização.`,
        };
      }

      const { error: erroTokens } = await supabaseAdmin.rpc(
        "redes_token_salvar" as never,
        {
          p_conexao_id: conexao.id,
          p_access: auth.accessToken,
          p_refresh: auth.refreshToken,
          p_access_expira: auth.accessExpiraEm,
          p_refresh_expira: auth.refreshExpiraEm,
        } as never,
      );
      const falhaSalvar = `A Pólia One conectou com o ${NOME_REDE[data.rede]}, mas não conseguiu salvar. Tenta de novo.`;
      if (erroTokens) return { ok: false, error: falhaSalvar };

      const { error: erroSalvar } = await supabaseAdmin
        .from("redes_conexoes" as never)
        .update({
          status: "conectada",
          state_pendente: null,
          conta_id: auth.contaId,
          conta_usuario: auth.perfil.usuario,
          conta_nome: auth.perfil.nome,
          conta_foto_url: auth.perfil.fotoUrl,
          escopos: auth.escopos || null,
          ultimo_erro: null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", conexao.id)
        .eq("state_pendente", data.state);
      if (erroSalvar) return { ok: false, error: falhaSalvar };
      return { ok: true, error: null, usuario: auth.perfil.usuario };
    },
  );

export const desconectarRede = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => redeInput.parse(input))
  .handler(async ({ data, context }) => {
    const conexao = await lerConexao(context.userId, data.rede);
    if (!conexao) return { ok: true, error: null };

    // TikTok tem chamada de revogar: a autorização sai de lá também. No Instagram
    // ela tira a Pólia em Configurações > Apps e sites; a Pólia apaga os tokens.
    if (data.rede === "tiktok" && conexao.status === "conectada") {
      const { data: linhas } = await supabaseAdmin.rpc(
        "redes_token_ler" as never,
        { p_conexao_id: conexao.id } as never,
      );
      const token = ((linhas as unknown as { access_token: string | null }[] | null) ?? [])[0];
      if (token?.access_token) await revogarAutorizacaoTiktok(token.access_token);
    }

    // Post agendado para essa rede não tem mais por onde sair.
    await supabaseAdmin
      .from("redes_post_destinos" as never)
      .update({
        status: "cancelado",
        erro: "A conta foi desconectada antes do horário.",
        updated_at: new Date().toISOString(),
      } as never)
      .eq("user_id", context.userId)
      .eq("rede", data.rede)
      .eq("status", "pendente");

    // O gatilho leva os segredos do Vault junto com a linha.
    const { error } = await supabaseAdmin
      .from("redes_conexoes" as never)
      .delete()
      .eq("id", conexao.id)
      .eq("user_id", context.userId);
    if (error)
      return { ok: false, error: "A Pólia One não conseguiu desconectar agora. Tenta de novo." };
    return { ok: true, error: null };
  });
