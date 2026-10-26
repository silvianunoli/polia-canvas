import { createFileRoute, redirect } from "@tanstack/react-router";

// "Ligar anúncios" do Mercado Livre mudou para Produtos > Anúncios nos canais
// (VND-39). Este endereço fica só para link antigo e favorito não quebrarem.

export const Route = createFileRoute(
  "/_authenticated/configuracoes_/integracoes/mercado-livre_/anuncios",
)({
  beforeLoad: () => {
    throw redirect({ to: "/produtos/anuncios/mercado-livre", replace: true });
  },
});
