import { createFileRoute, useLocation } from "@tanstack/react-router";
import { linkCanonico } from "@/lib/seo";
import { lerFbclidDaQuery, lerUtmsDaQuery } from "@/lib/origemCampanha";
import { nichoDaCampanha } from "@/lib/nichosLanding";
import { HeaderCampanha, type BuscaCadastro } from "@/components/landing/BlocosLanding";
import { PaginaMarcaB } from "@/components/landing/PaginaMarcaB";

// Landing B de campanha (06/10/2026): a mesma página da home (Ângulo B, "a marca
// sustenta o preço"), mas com o topo de campanha, sem menu, e fora do índice.
// Recebe o mesmo tráfego pago da /landing-a, pra comparar qual ângulo vira mais conta.
// Anúncio de nicho (utm_content N07-confeiteira etc.) troca só o topo: mesma
// pergunta e foto da arte clicada (09/10/2026, ver src/lib/nichosLanding.ts).

export const Route = createFileRoute("/landing-b")({
  // Sem validateSearch de propósito: as UTMs são lidas da query crua (lerUtmsDaQuery),
  // porque o router faria JSON.parse e um ID de anúncio longo perderia dígito.
  head: () => ({
    meta: [
      { title: "Pólia One · Sua marca já vale mais do que você está cobrando" },
      {
        name: "description",
        content:
          "A Pólia One junta o que a sua marca é, quanto ela precisa render no mês e quanto custa cada produto. O preço sai dessa conta, não do chute.",
      },
      // Página de campanha: fora do índice e do sitemap, pra não competir com a home.
      { name: "robots", content: "noindex, follow" },
    ],
    links: [linkCanonico("/landing-b")],
  }),
  component: LandingB,
});

function LandingB() {
  const searchStr = useLocation({ select: (l) => l.searchStr });
  const fbclid = lerFbclidDaQuery(searchStr);
  const busca: BuscaCadastro = {
    origem: "landing-b",
    ...lerUtmsDaQuery(searchStr),
    ...(fbclid ? { fbclid } : {}),
  };

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <HeaderCampanha busca={busca} />
      <PaginaMarcaB busca={busca} nicho={nichoDaCampanha(busca.utm_content)} />
    </div>
  );
}
