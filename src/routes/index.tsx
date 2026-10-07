import { createFileRoute, useLocation } from "@tanstack/react-router";
import { AnimatePresence } from "framer-motion";
import { linkCanonico } from "@/lib/seo";
import { jsonLdFaq, tagJsonLd } from "@/lib/jsonld";
import { lerUtmsDaQuery } from "@/lib/origemCampanha";
import { AppEntryGateModal } from "@/components/site/AppEntryGateModal";
import { SiteHeader } from "@/components/site/SiteHeader";
import { useAppEntryGate } from "@/hooks/useAppEntryGate";
import type { BuscaCadastro } from "@/components/landing/BlocosLanding";
import { PERGUNTAS_MARCA_B, PaginaMarcaB } from "@/components/landing/PaginaMarcaB";

// Home V6 (07/10/2026): a copy aprovada em 06/10 (Ângulo B, "a marca sustenta o
// preço"), a mesma página da /landing-b com o menu do site, o link pro Sobre e
// indexada. Substitui a V5 de 25/09, que ainda tinha o "66%" sem recalcular, a
// citação "girando dinheiro" como fala espontânea e o selo "Mais escolhido".
// Copy em COPY-SITE-HOME-SOBRE.md (Parte 1), na raiz do workspace.
//
// Nomes de plano visíveis (Grátis, Premium, Pro) moram em PaginaMarcaB.tsx.

const TITULO = "Pólia One · Preço, quanto sobra e o mês da sua marca";
const DESCRICAO =
  "A Pólia One junta o que a sua marca é, a meta do mês e o custo de cada produto. Na hora do orçamento, o preço sai da conta. Comece no Grátis, sem cartão.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      {
        property: "og:title",
        content: "Pólia One · Sua marca já vale mais do que você está cobrando",
      },
      { property: "og:description", content: DESCRICAO },
    ],
    links: [linkCanonico("/")],
    // Gerado do mesmo array que a página mostra, nunca copiado à mão: FAQ
    // estruturado que não bate com o texto visível vale menos que nenhum.
    scripts: [tagJsonLd(jsonLdFaq(PERGUNTAS_MARCA_B))],
  }),
  component: HomePage,
});

function HomePage() {
  const { mostrarModal, escondendoHome, explorar } = useAppEntryGate();
  // Sem validateSearch, como nas landings: UTM de link da bio ou de post chega
  // inteira ao cadastro, e quem vem da home fica marcado com origem "home".
  const searchStr = useLocation({ select: (l) => l.searchStr });
  const busca: BuscaCadastro = { origem: "home", ...lerUtmsDaQuery(searchStr) };

  // App Android/iOS com sessão ativa (ou sessão ainda carregando): a Home de
  // marketing não deve piscar antes do redirect automático pro painel.
  if (escondendoHome) return null;

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]" id="topo">
      <AnimatePresence>
        {mostrarModal && <AppEntryGateModal onExplorar={explorar} />}
      </AnimatePresence>
      <SiteHeader />
      <PaginaMarcaB busca={busca} linkSobre />
    </div>
  );
}
