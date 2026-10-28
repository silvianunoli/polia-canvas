import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { BotaoCadastro, CORPO, Rotulo, Secao } from "@/components/landing/BlocosLanding";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { PlayerTutorial } from "@/components/tutorial/PlayerTutorial";
import { linkCanonico } from "@/lib/seo";

const TITULO = "Tour completo · A Pólia One por dentro";
const DESCRICAO =
  "Um tour narrado de 5 minutos pela Pólia One: do Planejamento à Calculadora, ao Financeiro e a cada ferramenta do menu.";

// O tour de 5 minutos, público (pedido da Sil, 07/10/2026: dá pra mandar o link
// pra quem ainda não tem conta). Até 28/10/2026 morava em /tutorial, que agora
// lista um tutorial por ferramenta. Quem já está dentro assiste em /como-usar/tour.
export const Route = createFileRoute("/tutorial/tour")({
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: "A Pólia One por dentro" },
      { property: "og:description", content: DESCRICAO },
    ],
    links: [linkCanonico("/tutorial/tour")],
  }),
  component: TourPublicoPage,
});

function TourPublicoPage() {
  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader />
      <main id="conteudo">
        <Secao>
          <Link
            to="/tutorial"
            className="mb-6 inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-[var(--secondary-text)] no-underline hover:underline"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Todos os tutoriais
          </Link>
          <Rotulo>Tutorial</Rotulo>
          <h1 className="mt-3 max-w-[20ch] text-[clamp(34px,5vw,56px)] font-bold leading-[1.05] tracking-[-0.02em] text-balance text-[var(--ink)]">
            A Pólia One por dentro
          </h1>
          <p className={`mt-4 ${CORPO}`}>
            Um tour narrado de 5 minutos por cada ferramenta do menu. Os capítulos embaixo do vídeo
            levam direto pra parte que interessa.
          </p>
          <div className="mt-8">
            <PlayerTutorial origem="site" />
          </div>
          <div className="mt-10 flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
            <div>
              <BotaoCadastro
                busca={{ origem: "tutorial" }}
                contexto="tutorial_cta"
                className="max-md:w-full"
              />
            </div>
            <Link
              to="/planos"
              search={{ origem: "tutorial" }}
              className="inline-flex min-h-[44px] items-center text-[16px] font-semibold text-[var(--secondary-text)] underline decoration-1 underline-offset-4 hover:decoration-2 max-md:justify-center"
            >
              Ver os planos
            </Link>
          </div>
          <p className="mt-3 text-[13px] text-[var(--muted)]">Sem cartão no Grátis.</p>
        </Secao>
      </main>
      <SiteFooter semMargemTopo />
    </div>
  );
}
