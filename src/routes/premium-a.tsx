import { createFileRoute, useLocation } from "@tanstack/react-router";
import { linkCanonico } from "@/lib/seo";
import { lerFbclidDaQuery, lerUtmsDaQuery } from "@/lib/origemCampanha";
import type { BuscaCadastro } from "@/components/landing/BlocosLanding";
import { PaginaPremium } from "@/components/landing/PaginaPremium";

// Landing Premium A (15/10/2026): ângulo "o próximo orçamento", vendendo o Premium direto.
// Recebe a campanha de compra no Meta; a /landing-a segue na campanha de cadastro.

export const Route = createFileRoute("/premium-a")({
  // Sem validateSearch de propósito: as UTMs são lidas da query crua (lerUtmsDaQuery),
  // porque o router faria JSON.parse e um ID de anúncio longo perderia dígito.
  head: () => ({
    meta: [
      { title: "Pólia One Premium · A conta vem antes da resposta" },
      {
        name: "description",
        content:
          "Preço, pedidos e o dinheiro do mês num lugar só. No Premium, a Pólia One mostra quanto a marca lucra em cada venda e se o mês fechou.",
      },
      // Página de campanha: fora do índice e do sitemap.
      { name: "robots", content: "noindex, follow" },
    ],
    links: [linkCanonico("/premium-a")],
  }),
  component: PremiumA,
});

function PremiumA() {
  const searchStr = useLocation({ select: (l) => l.searchStr });
  const fbclid = lerFbclidDaQuery(searchStr);
  const busca: BuscaCadastro = {
    origem: "premium-a",
    ...lerUtmsDaQuery(searchStr),
    ...(fbclid ? { fbclid } : {}),
  };
  return <PaginaPremium busca={busca} angulo="a" />;
}
