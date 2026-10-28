import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { PlayerTutorial } from "@/components/tutorial/PlayerTutorial";
import { vizinhosDoTutorial, type Tutorial } from "@/lib/tutoriais";

/**
 * Corpo da página de um tutorial (28/10/2026): o clipe narrado da ferramenta
 * (recorte do tour de 5 minutos), o passo a passo, o que é bom saber e as
 * dúvidas comuns. O cabeçalho e o botão principal ficam com a rota, porque no
 * app o botão abre a tela e no site leva ao cadastro.
 */
export function ConteudoTutorial({
  tutorial: t,
  base,
}: {
  tutorial: Tutorial;
  base: "/como-usar" | "/tutorial";
}) {
  const { anterior, proximo } = vizinhosDoTutorial(t.slug);
  const rotaSlug = base === "/como-usar" ? "/como-usar/$slug" : "/tutorial/$slug";
  return (
    <div>
      <Link
        to={base}
        className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-[var(--secondary-text)] no-underline hover:underline"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Todos os tutoriais
      </Link>

      <div className="mt-4">
        {t.trecho ? (
          <PlayerTutorial
            key={t.slug}
            origem={base === "/como-usar" ? "app" : "site"}
            trecho={t.trecho}
            titulo={`Clipe narrado: ${t.nome}`}
          />
        ) : (
          <p className="rounded-xl border border-[var(--line)] bg-white p-5 text-[15px] leading-[1.6] text-[var(--ink-soft)]">
            O clipe narrado desta ferramenta ainda está sendo gravado. O passo a passo abaixo já
            mostra tudo o que a tela faz.
          </p>
        )}
      </div>

      <div className="mt-12 grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:gap-12">
        <section aria-labelledby="passo-a-passo">
          <h2
            id="passo-a-passo"
            className="font-cabinet text-[26px] leading-[1.15] tracking-[-0.02em] text-[var(--ink)]"
          >
            Passo a passo
          </h2>
          <div className="mt-6 grid gap-8">
            {t.passos.map((bloco) => (
              <div key={bloco.titulo}>
                <h3 className="text-[17px] font-semibold text-[var(--ink)]">{bloco.titulo}</h3>
                <ol className="mt-3 grid list-none gap-0 p-0">
                  {bloco.itens.map((item, i) => (
                    <li
                      key={item}
                      className="flex gap-4 border-t border-[var(--line)] py-3 text-[15px] leading-[1.6] text-[var(--ink-soft)]"
                    >
                      <span
                        aria-hidden="true"
                        className="font-accent mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-[var(--secondary-light)] text-[12px] font-bold text-[var(--ink)]"
                      >
                        {i + 1}
                      </span>
                      <span className="sr-only">{`Passo ${i + 1}: `}</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        <aside className="grid content-start gap-8">
          {t.bomSaber.length > 0 && (
            <section aria-labelledby="bom-saber" className="rounded-2xl bg-[var(--surface)] p-6">
              <h2
                id="bom-saber"
                className="font-accent text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]"
              >
                Bom saber
              </h2>
              <ul className="mt-3 grid list-disc gap-2 pl-5 text-[14px] leading-[1.6] text-[var(--ink-soft)] marker:text-[var(--muted)]">
                {t.bomSaber.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {t.duvidas.length > 0 && (
            <section aria-labelledby="duvidas">
              <h2
                id="duvidas"
                className="font-accent text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]"
              >
                Dúvidas comuns
              </h2>
              <ul className="mt-2 grid list-none gap-0 p-0">
                {t.duvidas.map((d, i) => (
                  <li key={d.pergunta} className={i > 0 ? "border-t border-[var(--line)]" : ""}>
                    <details className="group">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 text-[15px] leading-[1.5] text-[var(--ink)] transition-colors hover:text-[var(--secondary-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] [&::-webkit-details-marker]:hidden">
                        {d.pergunta}
                        <span
                          aria-hidden="true"
                          className="flex-none text-[var(--muted)] transition-transform group-open:rotate-90"
                        >
                          →
                        </span>
                      </summary>
                      <p className="pb-4 text-[14px] leading-[1.7] text-[var(--ink-soft)]">
                        {d.resposta}
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      <nav
        aria-label="Outros tutoriais"
        className="mt-16 flex flex-col gap-3 border-t border-[var(--line)] pt-6 sm:flex-row sm:justify-between"
      >
        {anterior ? (
          <Link
            to={rotaSlug}
            params={{ slug: anterior.slug }}
            className="inline-flex min-h-11 items-center gap-2 text-[15px] text-[var(--ink-soft)] no-underline hover:text-[var(--ink)]"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>
              <span className="block text-[12px] text-[var(--muted)]">Anterior</span>
              {anterior.nome}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {proximo && (
          <Link
            to={rotaSlug}
            params={{ slug: proximo.slug }}
            className="inline-flex min-h-11 items-center gap-2 text-[15px] font-medium text-[var(--ink)] no-underline hover:text-[var(--secondary-text)] sm:text-right"
          >
            <span>
              <span className="block text-[12px] font-normal text-[var(--muted)]">Próximo</span>
              {proximo.nome}
            </span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </nav>
    </div>
  );
}
