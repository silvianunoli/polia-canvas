import { createFileRoute, useLocation } from "@tanstack/react-router";
import { linkCanonico } from "@/lib/seo";
import { lerFbclidDaQuery, lerUtmsDaQuery } from "@/lib/origemCampanha";
import type { BuscaCadastro } from "@/components/landing/BlocosLanding";
import { PaginaPremium } from "@/components/landing/PaginaPremium";

// Landing Premium B (15/10/2026): ângulo "a marca vale mais", vendendo o Premium direto.
// Recebe a campanha de compra no Meta; a /landing-b segue na campanha de cadastro.

export const Route = createFileRoute("/premium-b")({
  // Sem validateSearch de propósito: as UTMs são lidas da query crua (lerUtmsDaQuery),
  // porque o router faria JSON.parse e um ID de anúncio longo perderia dígito.
  head: () => ({
    meta: [
      { title: "Pólia One Premium · Sua marca já vale mais do que você está cobrando" },
      {
        name: "description",
        content:
          "No Premium, a Pólia One junta a marca, o preço, os pedidos e o dinheiro do mês. O preço sai da conta, e o mês mostra se fechou.",
      },
      // Página de campanha: fora do índice e do sitemap.
      { name: "robots", content: "noindex, follow" },
    ],
    links: [linkCanonico("/premium-b")],
  }),
  component: PremiumB,
});

function PremiumB() {
  const searchStr = useLocation({ select: (l) => l.searchStr });
  const fbclid = lerFbclidDaQuery(searchStr);
  const busca: BuscaCadastro = {
    origem: "premium-b",
    ...lerUtmsDaQuery(searchStr),
    ...(fbclid ? { fbclid } : {}),
  };
  return <PaginaPremium busca={busca} angulo="b" />;
}
