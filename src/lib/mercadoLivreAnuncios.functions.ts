import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  anunciosDoItem,
  type AnuncioApiMl,
} from "../../supabase/functions/_shared/mercadoLivre.ts";
import { buscarIdsAnuncios, detalhesAnuncios } from "./mercadoLivreApi";
import { obterAcessoMercadoLivre } from "./mercadoLivreAcesso.server";
import {
  montarPrevia,
  salvarVinculos,
  salvarVinculosInput,
  temPro,
  type LinhaPrevia,
  type OpcaoSku,
} from "./canalVinculos.server";

// Ligar anúncios do Mercado Livre a produtos da Pólia (Fase 3c, etapa 3c.2,
// VND-30). Aqui só a busca no Mercado Livre; sugestão, prévia e gravação moram
// em canalVinculos.server.ts, as mesmas do TikTok Shop.

const CANAL = "mercado_livre";
const POR_PAGINA = 100;
const MAX_ANUNCIOS = 500;
const POR_MULTIGET = 20;

export type { LinhaPrevia, OpcaoSku };

export const listarAnunciosMercadoLivre = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<
      | { ok: false; error: string }
      | {
          ok: true;
          linhas: LinhaPrevia[];
          skus: OpcaoSku[];
          produtosSemEstoque: { produtoId: string; nome: string }[];
          incompleto: boolean;
        }
    > => {
      if (!(await temPro(context.userId)))
        return { ok: false, error: "A integração com o Mercado Livre é do plano Pro." };
      const { acesso, error } = await obterAcessoMercadoLivre(context.userId);
      if (!acesso) return { ok: false, error: error ?? "O Mercado Livre não está conectado." };
      const falhou = {
        ok: false as const,
        error: "O Mercado Livre não devolveu os anúncios agora. Tenta de novo.",
      };

      // Ids dos anúncios ativos e pausados (o que a Pólia pausou ao zerar o estoque
      // também precisa aparecer), página por página, até 500 no total.
      const ids: string[] = [];
      let total = 0;
      for (const status of ["active", "paused"] as const) {
        let lidos = 0;
        for (let offset = 0; ids.length < MAX_ANUNCIOS; offset += POR_PAGINA) {
          const r = await buscarIdsAnuncios({
            accessToken: acesso.accessToken,
            vendedoraId: acesso.vendedoraId,
            status,
            offset,
            limite: Math.min(POR_PAGINA, MAX_ANUNCIOS - ids.length),
          });
          if (r.error) return falhou;
          ids.push(...r.ids);
          lidos += r.ids.length;
          if (offset === 0) total += r.total;
          if (r.ids.length < POR_PAGINA || lidos >= r.total) break;
        }
      }

      // Detalhe com as variações, 20 por chamada, 5 chamadas por vez.
      const lotes: string[][] = [];
      for (let i = 0; i < ids.length; i += POR_MULTIGET) lotes.push(ids.slice(i, i + POR_MULTIGET));
      const anuncios: AnuncioApiMl[] = [];
      for (let i = 0; i < lotes.length; i += 5) {
        const respostas = await Promise.all(
          lotes
            .slice(i, i + 5)
            .map((lote) => detalhesAnuncios({ accessToken: acesso.accessToken, ids: lote })),
        );
        if (respostas.some((r) => r.error)) return falhou;
        for (const r of respostas) anuncios.push(...r.anuncios);
      }

      return {
        ok: true,
        ...(await montarPrevia(context.userId, CANAL, anuncios.flatMap(anunciosDoItem))),
        incompleto: total > ids.length,
      };
    },
  );

export const salvarVinculosMercadoLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => salvarVinculosInput.parse(input))
  .handler(async ({ data, context }) =>
    salvarVinculos({
      userId: context.userId,
      supabase: context.supabase,
      canal: CANAL,
      nomeCanal: "Mercado Livre",
      itens: data.itens,
    }),
  );
