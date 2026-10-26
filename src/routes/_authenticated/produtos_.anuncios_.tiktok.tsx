import { createFileRoute } from "@tanstack/react-router";
import { LigarAnunciosCanal } from "@/components/configuracoes/LigarAnunciosCanal";
import { CHAVE_STATUS_TIKTOK } from "@/hooks/useCanaisConectados";
import { listarAnunciosTiktok, salvarVinculosTiktok } from "@/lib/tiktokShopAnuncios.functions";

// Prévia de ligar anúncios do TikTok Shop aos produtos da Pólia (wireframe 6.3 do
// plano da Fase 3a). A tela é a mesma do Mercado Livre. Mora em Produtos >
// Anúncios nos canais desde o VND-39; o endereço antigo redireciona para cá.

export const Route = createFileRoute("/_authenticated/produtos_/anuncios_/tiktok")({
  head: () => ({ meta: [{ title: "Ligar anúncios do TikTok Shop · Pólia One" }] }),
  component: () => (
    <LigarAnunciosCanal
      nomeCanal="TikTok Shop"
      nomeCurto="TikTok"
      chaveAnuncios="tiktok-anuncios"
      chaveStatus={CHAVE_STATUS_TIKTOK}
      listar={() => listarAnunciosTiktok()}
      salvar={salvarVinculosTiktok}
    />
  ),
});
