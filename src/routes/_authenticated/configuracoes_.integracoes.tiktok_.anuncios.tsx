import { createFileRoute, redirect } from "@tanstack/react-router";

// "Ligar anúncios" do TikTok Shop mudou para Produtos > Anúncios nos canais
// (VND-39). Este endereço fica só para link antigo e favorito não quebrarem.

export const Route = createFileRoute("/_authenticated/configuracoes_/integracoes/tiktok_/anuncios")(
  {
    beforeLoad: () => {
      throw redirect({ to: "/produtos/anuncios/tiktok", replace: true });
    },
  },
);
