import { createFileRoute, useLocation } from "@tanstack/react-router";
import { linkCanonico } from "@/lib/seo";
import { jsonLdFaq, tagJsonLd } from "@/lib/jsonld";
import { lerUtmsDaQuery } from "@/lib/origemCampanha";
import { SiteHeader } from "@/components/site/SiteHeader";
import { useAppEntryGate } from "@/hooks/useAppEntryGate";
import type { BuscaCadastro } from "@/components/landing/BlocosLanding";
import { PERGUNTAS_HOME } from "@/components/landing/PaginaMarcaB";
import { PaginaHome } from "@/components/landing/PaginaHome";

// Home V6 (07/10/2026): a copy aprovada em 06/10 (Ângulo B, "a marca sustenta o
// preço"), a mesma página da /landing-b com o menu do site, o link pro Sobre e
// indexada. Substitui a V5 de 25/09, que ainda tinha o "66%" sem recalcular, a
// citação "girando dinheiro" como fala espontânea e o selo "Mais escolhido".
// Copy em COPY-SITE-HOME-SOBRE.md (Parte 1), na raiz do workspace.
//
// Nomes de plano visíveis (Grátis, Premium, Pro) moram em PaginaMarcaB.tsx.

// Topo "o escritório da sua marca" desde 27/10/2026 (COPY-34, POSICIONAMENTO-POLIA-ONE.md).
// Virou "o sistema da sua marca" em 31/10/2026 (decisão da Sil, junto com a
// saída do Planejamento): pedidos, estoque e lucro num lugar só, no celular.
const TITULO = "Pólia One · O sistema da sua marca";
const DESCRICAO =
  "A Pólia One é o sistema de gestão da sua marca: pedidos, estoque, vendas e lucro num lugar só, no celular. Comece no Grátis, sem cartão.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      {
        property: "og:title",
        content: TITULO,
      },
      { property: "og:description", content: DESCRICAO },
    ],
    links: [linkCanonico("/")],
    // Gerado do mesmo array que a página mostra, nunca copiado à mão: FAQ
    // estruturado que não bate com o texto visível vale menos que nenhum.
    scripts: [tagJsonLd(jsonLdFaq(PERGUNTAS_HOME))],
  }),
  component: HomePage,
});

function HomePage() {
  const { escondendoHome } = useAppEntryGate();
  // Sem validateSearch, como nas landings: UTM de link da bio ou de post chega
  // inteira ao cadastro, e quem vem da home fica marcado com origem "home".
  const searchStr = useLocation({ select: (l) => l.searchStr });
  const busca: BuscaCadastro = { origem: "home", ...lerUtmsDaQuery(searchStr) };

  // Dentro do app Android a Home de marketing não aparece: ela só existe ali
  // pelo tempo do redirect pra /app ou pra aba Hoje (AND-10).
  if (escondendoHome) return null;

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]" id="topo">
      <SiteHeader />
      {/* Desde 03/11/2026 (COPY-43) a home tem página própria, na ordem do bench do Pode
          Postar; a /landing-b segue no PaginaMarcaB. O VSL desceu pro "Por dentro". */}
      <PaginaHome busca={busca} />
    </div>
  );
}
