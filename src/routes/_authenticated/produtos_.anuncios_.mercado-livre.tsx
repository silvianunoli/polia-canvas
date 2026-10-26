import { createFileRoute } from "@tanstack/react-router";
import { LigarAnunciosCanal } from "@/components/configuracoes/LigarAnunciosCanal";
import { CHAVE_STATUS_ML } from "@/hooks/useCanaisConectados";
import {
  listarAnunciosMercadoLivre,
  salvarVinculosMercadoLivre,
} from "@/lib/mercadoLivreAnuncios.functions";

// Prévia de ligar anúncios do Mercado Livre aos produtos da Pólia (plano da Fase
// 3c, §6.3). Mesma tela do TikTok Shop, com a marca "Full" nos anúncios cujo
// estoque o Mercado Livre cuida. Mora em Produtos > Anúncios nos canais desde o
// VND-39; o endereço antigo em Configurações redireciona para cá.

export const Route = createFileRoute("/_authenticated/produtos_/anuncios_/mercado-livre")({
  head: () => ({ meta: [{ title: "Ligar anúncios do Mercado Livre · Pólia One" }] }),
  component: () => (
    <LigarAnunciosCanal
      nomeCanal="Mercado Livre"
      nomeCurto="Mercado Livre"
      chaveAnuncios="mercado-livre-anuncios"
      chaveStatus={CHAVE_STATUS_ML}
      listar={() => listarAnunciosMercadoLivre()}
      salvar={salvarVinculosMercadoLivre}
    />
  ),
});
