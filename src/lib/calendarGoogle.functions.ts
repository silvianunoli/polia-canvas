import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  montarUrlConsentimento,
  trocarCodigoPorTokens,
  renovarAccessToken,
  buscarEmailConectado,
  listarEventosGoogle,
  revogarToken,
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
    const conexao = await lerConexao(context.userId);
    return { conectado: !!conexao?.refresh_token, email: conexao?.email_conectado ?? null };
  });

export const iniciarConexaoGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const state = crypto.randomUUID();
    const { error: upsertError } = await supabaseAdmin
      .from("google_calendar_conexoes" as never)
      .upsert(
        { user_id: context.userId, state_pendente: state, updated_at: new Date().toISOString() } as never,
        { onConflict: "user_id" },
      );
    if (upsertError) return { url: null, error: "Não consegui iniciar a conexão. Tenta de novo." };
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
    if (error || !tokens) return { ok: false, error: error ?? "Não consegui confirmar com o Google." };

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
    if (saveError) return { ok: false, error: "Conectei com o Google mas não consegui salvar. Tenta de novo." };
    return { ok: true, error: null };
  });

const eventosInput = z.object({ inicioISO: z.string(), fimISO: z.string() });

export const listarEventosDoMes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => eventosInput.parse(input))
  .handler(async ({ data, context }): Promise<{ eventos: EventoGoogle[]; error: string | null; conectado: boolean }> => {
    const conexao = await lerConexao(context.userId);
    if (!conexao?.refresh_token) return { eventos: [], error: null, conectado: false };

    let accessToken = conexao.access_token ?? "";
    const expirado = !conexao.expires_at || new Date(conexao.expires_at) <= new Date();
    if (expirado || !accessToken) {
      const renovado = await renovarAccessToken(conexao.refresh_token);
      if (!renovado) {
        return { eventos: [], error: "Sua conexão com o Google expirou. Reconecte.", conectado: false };
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
    if (resultado.expirado) {
      return { eventos: [], error: "Sua conexão com o Google expirou. Reconecte.", conectado: false };
    }
    return { eventos: resultado.eventos ?? [], error: resultado.error, conectado: true };
  });

export const desconectarGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const conexao = await lerConexao(context.userId);
    if (conexao?.access_token) await revogarToken(conexao.access_token);
    await supabaseAdmin.from("google_calendar_conexoes" as never).delete().eq("user_id", context.userId);
    return { ok: true };
  });
