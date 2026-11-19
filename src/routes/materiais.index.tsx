import { createFileRoute, Link } from "@tanstack/react-router";
import { linkCanonico } from "@/lib/seo";
import { track } from "@/lib/analytics";
import { CascaMaterial } from "@/components/site/CascaMaterial";
import { HighlightWord } from "@/components/site/HighlightWord";
import { CONTAINER, BTN_PRIMARIO, BTN_CONTORNO, Eyebrow } from "@/components/site/Editorial";
import { hojeEmBrasilia, iscasNaVitrine, type Isca } from "@/lib/iscas/catalogo";
import { INSTAGRAM_URL } from "@/lib/manual/conteudo";

// Vitrine dos materiais gratuitos: one.usepolia.com.br/materiais (19/11/2026,
// E11 da consultoria da Pólia One, SERV-132). Um cartão por isca do catálogo
// (src/lib/iscas/catalogo.ts); isca nova aparece aqui sem mexer nesta tela.
// A ação é uma só: escolher o material e ir pra página dele, onde fica o
// formulário. Isca com prazo (`ate`) sai da lista sozinha depois do dia.

const ORIGEM = "pagina_materiais";

const TITULO = "Materiais gratuitos pra colocar a casa em ordem";
const DESTAQUE = "a casa em ordem";
const DESCRICAO =
  "Checklists e calendários gratuitos da Pólia em PDF, pra quem vende por encomenda: Black Friday, Natal e a marca pronta pra crescer.";

export const Route = createFileRoute("/materiais/")({
  // A data sai daqui, a cada pedido, nunca de uma constante de módulo.
  loader: () => ({ iscas: iscasNaVitrine(hojeEmBrasilia(new Date())) }),
  head: () => ({
    meta: [
      { title: "Materiais gratuitos · Pólia" },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESCRICAO },
    ],
    links: [linkCanonico("/materiais")],
  }),
  component: MateriaisPage,
});

/** "2026-11-27" vira "27/11". */
function diaMes(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function CartaoMaterial({ isca }: { isca: Isca }) {
  const tituloId = `material-${isca.slug}`;
  return (
    <article
      aria-labelledby={tituloId}
      className="flex h-full flex-col rounded-2xl border border-[var(--line)] bg-white p-6 md:p-8"
    >
      <Eyebrow>{isca.rotulo}</Eyebrow>
      <h2
        id={tituloId}
        className="mt-3 text-[clamp(1.35rem,3vw,1.6rem)] font-bold leading-[1.15] tracking-[-0.02em] text-balance"
      >
        {isca.titulo}
      </h2>
      <p className="mt-3 flex-1 text-[16px] leading-[1.55] text-[var(--ink-soft)]">
        {isca.subtitulo}
      </p>
      {isca.ate && (
        <p className="mt-4 text-[14px] font-semibold leading-[1.5] text-[var(--ink)]">
          Disponível até {diaMes(isca.ate)}
        </p>
      )}
      <Link
        to="/materiais/$slug"
        params={{ slug: isca.slug }}
        search={{ origem: ORIGEM, aviso: undefined }}
        className={`${BTN_PRIMARIO} mt-6 min-h-[52px] w-full`}
        onClick={() => track("materiais_cartao_clicado", { isca: isca.slug })}
      >
        {isca.cta}
        <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

function MateriaisPage() {
  const { iscas } = Route.useLoaderData();
  const i = TITULO.indexOf(DESTAQUE);

  return (
    <CascaMaterial>
      <section className={`${CONTAINER} py-[clamp(32px,7vw,96px)]`}>
        <Eyebrow>Materiais gratuitos</Eyebrow>
        {/* h1 fora do Reveal de propósito (LCP), como na Home. */}
        <h1 className="mt-4 max-w-[22ch] text-[clamp(2rem,6vw,3.6rem)] font-bold leading-[1.04] tracking-[-0.02em] text-balance">
          {TITULO.slice(0, i)}
          <HighlightWord delay={0.3}>{DESTAQUE}</HighlightWord>
          {TITULO.slice(i + DESTAQUE.length)}
        </h1>
        <p className="mt-4 max-w-[52ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
          Checklists e calendários em PDF, pra abrir no celular ou imprimir. Escolhe um, deixa o
          e-mail e o WhatsApp, e o download começa na hora.
        </p>

        {iscas.length > 0 ? (
          // Sem Reveal nos cartões: são a ação da página e precisam estar
          // visíveis mesmo sem a animação de rolagem rodar.
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {iscas.map((isca) => (
              <CartaoMaterial key={isca.slug} isca={isca} />
            ))}
          </div>
        ) : (
          <div className="mt-12 rounded-2xl border border-[var(--line)] bg-white p-6 md:p-8">
            <p className="text-[16px] leading-[1.6] text-[var(--ink-soft)]">
              Nenhum material no ar neste momento. Os próximos aparecem primeiro no Instagram da
              Pólia.
            </p>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${BTN_CONTORNO} mt-6 min-h-[52px] w-full sm:w-auto`}
            >
              Ir pro @polialab
              <span aria-hidden="true">→</span>
            </a>
          </div>
        )}
      </section>
    </CascaMaterial>
  );
}
