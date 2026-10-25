import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  anunciosDoProduto,
  precisaDetalhe,
  type ProdutoApiTiktok,
} from "../../supabase/functions/_shared/tiktokShop.ts";
import { buscarProdutos, detalheProduto } from "./tiktokShopApi";
import { obterAcessoTiktok } from "./tiktokShopAcesso.server";
import {
  montarPrevia,
  salvarVinculos,
  salvarVinculosInput,
  temPro,
  type LinhaPrevia,
  type OpcaoSku,
} from "./canalVinculos.server";

// Ligar anúncios do TikTok Shop a produtos da Pólia (Fase 3a, etapa 3a.2, VND-05).
// Aqui só a busca no TikTok; sugestão, prévia e gravação moram em
// canalVinculos.server.ts, igual para todo canal.

const CANAL = "tiktok_shop";
const MAX_PAGINAS = 5; // 500 produtos
const MAX_DETALHES = 100;

export type { LinhaPrevia, OpcaoSku };

export const listarAnunciosTiktok = createServerFn({ method: "GET" })
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
        return { ok: false, error: "A integração com o TikTok Shop é do plano Pro." };
      const { acesso, error } = await obterAcessoTiktok(context.userId);
      if (!acesso) return { ok: false, error: error ?? "O TikTok Shop não está conectado." };

      // Anúncios ativos, página por página.
      const produtos: ProdutoApiTiktok[] = [];
      let pagina: string | undefined;
      let incompleto = false;
      for (let i = 0; i < MAX_PAGINAS; i++) {
        const r = await buscarProdutos({ ...acesso, pageToken: pagina });
        if (r.error)
          return {
            ok: false,
            error: "O TikTok Shop não devolveu os anúncios agora. Tenta de novo.",
          };
        produtos.push(...r.produtos);
        if (!r.proximaPagina) break;
        pagina = r.proximaPagina;
        if (i === MAX_PAGINAS - 1) incompleto = true;
      }

      // Nome das variações: o detalhe só de quem precisa, 5 por vez.
      const faltando = produtos.filter(precisaDetalhe).slice(0, MAX_DETALHES);
      for (let i = 0; i < faltando.length; i += 5) {
        const lote = faltando.slice(i, i + 5);
        const detalhes = await Promise.all(
          lote.map((p) => detalheProduto({ ...acesso, produtoId: p.id! })),
        );
        detalhes.forEach((d, k) => {
          if (d.produto?.skus) lote[k].skus = d.produto.skus;
        });
      }
      const anuncios = produtos.flatMap(anunciosDoProduto);
      return { ok: true, ...(await montarPrevia(context.userId, CANAL, anuncios)), incompleto };
    },
  );

export const salvarVinculosTiktok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => salvarVinculosInput.parse(input))
  .handler(async ({ data, context }) =>
    salvarVinculos({
      userId: context.userId,
      supabase: context.supabase,
      canal: CANAL,
      nomeCanal: "TikTok Shop",
      itens: data.itens,
    }),
  );
