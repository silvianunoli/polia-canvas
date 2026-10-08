import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { registrarEventoSistema } from "@/lib/founder-eventos.server";
import {
  googleConfigurado,
  montarUrlConsentimento,
  trocarCodigoPorTokens,
  renovarAccessToken,
  buscarEmailConectado,
  listarEventosGoogle,
  revogarToken,
  concedeuAgenda,
  MSG_SEM_PERMISSAO_AGENDA,
  type EventoGoogle,
} from "./googleCalendarApi";

interface ConexaoRow {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  email_conectado: string | null;
  state_pendente: string | null;
}

async function lerConexao(userId: string): Promise<ConexaoRow | null> {
  const { data } = await supabaseAdmin
    .from("google_calendar_conexoes" as never)
    .select("access_token, refresh_token, expires_at, email_conectado, state_pendente")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as unknown as ConexaoRow) ?? null;
}

export const statusConexaoGoogle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Sem as credenciais do OAuth no ambiente nada do Google funciona (nem a
    // renovação do token), então a tela esconde a integração inteira. Volta só
    // o booleano, nunca o valor das variáveis.
    if (!googleConfigurado()) return { configurado: false, conectado: false, email: null };
    const conexao = await lerConexao(context.userId);
    return {
      configurado: true,
      conectado: !!conexao?.refresh_token,
      email: conexao?.email_conectado ?? null,
    };
  });

export const iniciarConexaoGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const state = crypto.randomUUID();
    const { error: upsertError } = await supabaseAdmin
      .from("google_calendar_conexoes" as never)
      .upsert(
        {
          user_id: context.userId,
          state_pendente: state,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "user_id" },
      );
    if (upsertError)
      return { url: null, error: "A Pólia One não conseguiu iniciar a conexão. Tenta de novo." };
    return montarUrlConsentimento(state);
  });

const finalizarInput = z.object({ code: z.string().min(1), state: z.string().min(1) });

export const finalizarConexaoGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => finalizarInput.parse(input))
  .handler(async ({ data, context }) => {
    const conexao = await lerConexao(context.userId);
    if (!conexao || conexao.state_pendente !== data.state) {
      return { ok: false, error: "Essa conexão expirou ou não é sua. Tenta conectar de novo." };
    }
    const { tokens, error } = await trocarCodigoPorTokens(data.code);
    if (error || !tokens)
      return { ok: false, error: error ?? "A Pólia One não conseguiu confirmar com o Google." };

    // Caixa da agenda desmarcada na tela do Google: não grava uma conexão que
    // nunca vai ler evento. Devolve o acesso e explica o que marcar.
    if (!concedeuAgenda(tokens.scope)) {
      await revogarToken(tokens.access_token);
      await supabaseAdmin
        .from("google_calendar_conexoes" as never)
        .delete()
        .eq("user_id", context.userId);
      return { ok: false, error: MSG_SEM_PERMISSAO_AGENDA };
    }

    const email = await buscarEmailConectado(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const payload: Record<string, unknown> = {
      access_token: tokens.access_token,
      expires_at: expiresAt,
      email_conectado: email,
      state_pendente: null,
      updated_at: new Date().toISOString(),
    };
    // O Google só reenvia refresh_token no 1º consentimento — se não vier, mantém o salvo.
    if (tokens.refresh_token) payload.refresh_token = tokens.refresh_token;

    const { error: saveError } = await supabaseAdmin
      .from("google_calendar_conexoes" as never)
      .update(payload as never)
      .eq("user_id", context.userId);
    if (saveError)
      return {
        ok: false,
        error: "A Pólia One conectou com o Google, mas não conseguiu salvar. Tenta de novo.",
      };
    return { ok: true, error: null };
  });

const eventosInput = z.object({ inicioISO: z.string(), fimISO: z.string() });

export const listarEventosDoMes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => eventosInput.parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ eventos: EventoGoogle[]; error: string | null; conectado: boolean }> => {
      const conexao = await lerConexao(context.userId);
      if (!conexao?.refresh_token) return { eventos: [], error: null, conectado: false };

      let accessToken = conexao.access_token ?? "";
      const expirado = !conexao.expires_at || new Date(conexao.expires_at) <= new Date();
      if (expirado || !accessToken) {
        const renovado = await renovarAccessToken(conexao.refresh_token);
        if (!renovado) {
          registrarEventoSistema({
            tipo: "integration_failure",
            origem: "calendarGoogle.functions",
            servico: "google_calendar",
            detalhes: { motivo: "refresh_token_recusado" },
          });
          return {
            eventos: [],
            error: "Sua conexão com o Google expirou. Reconecte.",
            conectado: false,
          };
        }
        accessToken = renovado.access_token;
        await supabaseAdmin
          .from("google_calendar_conexoes" as never)
          .update({
            access_token: accessToken,
            expires_at: new Date(Date.now() + renovado.expires_in * 1000).toISOString(),
          } as never)
          .eq("user_id", context.userId);
      }

      const resultado = await listarEventosGoogle(accessToken, data.inicioISO, data.fimISO);
      // Conectada sem a permissão da agenda (caixa desmarcada antes desta
      // correção): desfaz a conexão pra tela voltar a oferecer "Conectar".
      if (resultado.error === MSG_SEM_PERMISSAO_AGENDA) {
        await revogarToken(accessToken);
        await supabaseAdmin
          .from("google_calendar_conexoes" as never)
          .delete()
          .eq("user_id", context.userId);
        return { eventos: [], error: MSG_SEM_PERMISSAO_AGENDA, conectado: false };
      }
      if (resultado.expirado) {
        return {
          eventos: [],
          error: "Sua conexão com o Google expirou. Reconecte.",
          conectado: false,
        };
      }
      return { eventos: resultado.eventos ?? [], error: resultado.error, conectado: true };
    },
  );

export const desconectarGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const conexao = await lerConexao(context.userId);
    if (conexao?.access_token) await revogarToken(conexao.access_token);
    await supabaseAdmin
      .from("google_calendar_conexoes" as never)
      .delete()
      .eq("user_id", context.userId);
    return { ok: true };
  });
