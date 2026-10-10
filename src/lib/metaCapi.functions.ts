import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enviarEventosMeta, fbcDoFbclid, montarUserData } from "@/lib/metaCapi.server";
import { eventIdCadastro } from "@/lib/metaPixel";

// Cadastro concluído → API de Conversões do Meta (ver metaCapi.server.ts).
//
// Sem requireSupabaseAuth de propósito: no cadastro por e-mail a conta nasce
// sem sessão até confirmar o e-mail, e é justamente esse cadastro que o anúncio
// precisa contar. Em troca, o servidor não confia em nada do cliente além do id:
// busca a conta pelo id, exige que ela tenha nascido há poucos minutos e tira o
// e-mail do próprio banco. O pior que dá pra fazer chamando à toa é reenviar o
// cadastro de uma conta recém-criada, que o Meta descarta pelo event_id.

/** Conta criada há mais tempo que isso não gera cadastro (evita reuso). */
export const JANELA_CADASTRO_MS = 30 * 60 * 1000;

const entrada = z.object({
  userId: z.string().uuid(),
  metodo: z.enum(["email", "google"]),
  fbclid: z.string().max(500).optional(),
  fbp: z.string().max(100).optional(),
  url: z.string().url().max(500).optional(),
});

export const registrarCadastroMeta = createServerFn({ method: "POST" })
  .inputValidator((dados: unknown) => entrada.parse(dados))
  .handler(async ({ data }) => {
    try {
      const { data: resp, error } = await supabaseAdmin.auth.admin.getUserById(data.userId);
      const user = resp?.user;
      if (error || !user) return { enviado: false };
      const agora = Date.now();
      if (agora - new Date(user.created_at).getTime() > JANELA_CADASTRO_MS) {
        return { enviado: false };
      }

      const req = getRequest();
      const ip = req?.headers.get("cf-connecting-ip") ?? null;
      const userAgent = req?.headers.get("user-agent") ?? null;

      const userData = await montarUserData({
        email: user.email,
        userId: user.id,
        ip,
        userAgent,
        fbp: data.fbp,
        fbc: fbcDoFbclid(data.fbclid, agora),
      });
      const resultado = await enviarEventosMeta([
        {
          event_name: "CompleteRegistration",
          event_time: Math.floor(agora / 1000),
          event_id: eventIdCadastro(user.id),
          action_source: "website",
          ...(data.url ? { event_source_url: data.url } : {}),
          user_data: userData,
          custom_data: { content_name: data.metodo, status: true },
        },
      ]);
      return { enviado: resultado.enviado };
    } catch {
      // Medição nunca atrapalha o cadastro.
      return { enviado: false };
    }
  });
