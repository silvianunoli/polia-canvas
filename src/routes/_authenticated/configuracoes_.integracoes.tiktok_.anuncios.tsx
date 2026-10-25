import { createFileRoute } from "@tanstack/react-router";
import { LigarAnunciosCanal } from "@/components/configuracoes/LigarAnunciosCanal";
import { listarAnunciosTiktok, salvarVinculosTiktok } from "@/lib/tiktokShopAnuncios.functions";

// Prévia de ligar anúncios do TikTok Shop aos produtos da Pólia (wireframe 6.3 do
// plano da Fase 3a, aprovado em 24/10). A tela é a mesma do Mercado Livre.

export const Route = createFileRoute("/_authenticated/configuracoes_/integracoes/tiktok_/anuncios")(
  {
    head: () => ({ meta: [{ title: "Ligar anúncios do TikTok Shop · Pólia One" }] }),
    component: () => (
      <LigarAnunciosCanal
        nomeCanal="TikTok Shop"
        nomeCurto="TikTok"
        chaveAnuncios="tiktok-anuncios"
        chaveStatus="tiktok-status"
        listar={() => listarAnunciosTiktok()}
        salvar={salvarVinculosTiktok}
      />
    ),
  },
);
