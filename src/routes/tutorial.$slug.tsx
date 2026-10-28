import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { BotaoCadastro, CORPO, Rotulo, Secao } from "@/components/landing/BlocosLanding";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ConteudoTutorial } from "@/components/tutorial/ConteudoTutorial";
import { jsonLdFaq, tagJsonLd } from "@/lib/jsonld";
import { linkCanonico } from "@/lib/seo";
import { planoDoTutorial, tutorialPorSlug } from "@/lib/tutoriais";

// Tutorial público de uma ferramenta (28/10/2026). Mesmo conteúdo de
// /como-usar/$slug; aqui o botão leva ao cadastro em vez de abrir a tela.
// As dúvidas comuns saem também como FAQ em JSON-LD, geradas do mesmo array.
export const Route = createFileRoute("/tutorial/$slug")({
  loader: ({ params }) => {
    const tutorial = tutorialPorSlug(params.slug);
    if (!tutorial) throw notFound();
    return { tutorial };
  },
  head: ({ params }) => {
    const t = tutorialPorSlug(params.slug);
    if (!t) return { meta: [{ title: "Tutorial · Pólia One" }] };
    const titulo = `${t.nome}: como usar · Tutorial · Pólia One`;
    return {
      meta: [
        { title: titulo },
        { name: "description", content: t.resumo },
        { property: "og:title", content: `${t.nome} na Pólia One` },
        { property: "og:description", content: t.resumo },
      ],
      links: [linkCanonico(`/tutorial/${t.slug}`)],
      scripts: t.duvidas.length > 0 ? [tagJsonLd(jsonLdFaq(t.duvidas))] : [],
    };
  },
  notFoundComponent: TutorialNaoEncontrado,
  component: TutorialPublicoPage,
});

function TutorialPublicoPage() {
  const { tutorial: t } = Route.useLoaderData();
  const plano = planoDoTutorial(t);
  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader />
      <main id="conteudo">
        <Secao>
          <Rotulo>
            {plano === "Grátis" ? "Tutorial · todos os planos" : `Tutorial · ${plano}`}
          </Rotulo>
          <h1 className="mt-3 max-w-[20ch] text-[clamp(34px,5vw,56px)] font-bold leading-[1.05] tracking-[-0.02em] text-balance text-[var(--ink)]">
            {t.nome}
          </h1>
          <p className={`mt-4 ${CORPO}`}>{t.resumo}</p>
          <div className="mt-8">
            <ConteudoTutorial tutorial={t} base="/tutorial" />
          </div>
          <div className="mt-12 flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
            <div>
              <BotaoCadastro
                busca={{ origem: "tutorial" }}
                contexto={`tutorial_${t.slug}`}
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

function TutorialNaoEncontrado() {
  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader />
      <main id="conteudo">
        <Secao>
          <Rotulo>Tutorial</Rotulo>
          <h1 className="mt-3 text-[clamp(30px,4vw,44px)] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--ink)]">
            Esse tutorial não existe.
          </h1>
          <p className={`mt-4 ${CORPO}`}>
            O link pode ter mudado. A lista tem um tutorial pra cada ferramenta.
          </p>
          <Link
            to="/tutorial"
            className="mt-6 inline-flex min-h-[44px] items-center text-[16px] font-semibold text-[var(--secondary-text)] underline decoration-1 underline-offset-4 hover:decoration-2"
          >
            Ver todos os tutoriais
          </Link>
        </Secao>
      </main>
      <SiteFooter semMargemTopo />
    </div>
  );
}
