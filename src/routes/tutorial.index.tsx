import { createFileRoute } from "@tanstack/react-router";

import { BotaoCadastro, CORPO, Rotulo, Secao } from "@/components/landing/BlocosLanding";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ChamadaTour } from "@/components/tutorial/ChamadaTour";
import { ListaTutoriais } from "@/components/tutorial/ListaTutoriais";
import { linkCanonico } from "@/lib/seo";

const TITULO = "Tutoriais · Pólia One";
const DESCRICAO =
  "Um tutorial curto pra cada ferramenta da Pólia One: Planejamento, Calculadora, Produtos, Vendas, Financeiro, Metas, Pedidos e as outras telas, com clipe narrado e passo a passo.";

// Tutoriais públicos, um por ferramenta (28/10/2026). Dá pra mandar o link pra
// quem ainda não tem conta; quem já está dentro vê a mesma lista em /como-usar.
// O tour de 5 minutos, que morava aqui até 28/10, foi pra /tutorial/tour.
export const Route = createFileRoute("/tutorial/")({
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: "Tutoriais da Pólia One" },
      { property: "og:description", content: DESCRICAO },
    ],
    links: [linkCanonico("/tutorial")],
  }),
  component: TutoriaisPublicoPage,
});

function TutoriaisPublicoPage() {
  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader />
      <main id="conteudo">
        <Secao>
          <Rotulo>Tutoriais</Rotulo>
          <h1 className="mt-3 max-w-[20ch] text-[clamp(34px,5vw,56px)] font-bold leading-[1.05] tracking-[-0.02em] text-balance text-[var(--ink)]">
            Cada ferramenta da Pólia One, passo a passo
          </h1>
          <p className={`mt-4 ${CORPO}`}>
            Um tutorial curto pra cada tela: o clipe narrado e o passo a passo pra seguir junto. Dá
            pra ler antes de criar a conta.
          </p>
          <div className="mt-10">
            <ListaTutoriais base="/tutorial" />
          </div>
          <ChamadaTour base="/tutorial" />
          <div className="mt-12">
            <BotaoCadastro
              busca={{ origem: "tutorial" }}
              contexto="tutorial_cta"
              className="max-md:w-full"
            />
            <p className="mt-3 text-[13px] text-[var(--muted)]">Sem cartão no Grátis.</p>
          </div>
        </Secao>
      </main>
      <SiteFooter semMargemTopo />
    </div>
  );
}
