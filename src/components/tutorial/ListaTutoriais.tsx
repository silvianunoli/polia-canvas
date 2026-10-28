import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, PlayCircle } from "lucide-react";

import { ICONE_TUTORIAL } from "@/components/tutorial/iconesTutorial";
import {
  buscarTutoriais,
  duracaoDoTrecho,
  GRUPOS_TUTORIAL,
  planoDoTutorial,
  type SlugTutorial,
  type Tutorial,
} from "@/lib/tutoriais";

/**
 * Lista dos tutoriais por ferramenta, agrupada como o menu (28/10/2026). A
 * mesma lista serve o app (/como-usar) e o site (/tutorial): `base` diz pra
 * onde cada linha leva. Linha com ícone e borda de 1px, não grade de cartões
 * iguais (CLAUDE.md).
 */
export function ListaTutoriais({ base }: { base: "/como-usar" | "/tutorial" }) {
  const [busca, setBusca] = useState("");
  const achados = buscarTutoriais(busca);
  const buscando = busca.trim().length >= 2;

  return (
    <div>
      <label htmlFor="busca-tutorial" className="sr-only">
        Buscar tutorial
      </label>
      <input
        id="busca-tutorial"
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar ferramenta ou dúvida: venda, meta, Google..."
        className="w-full max-w-[560px] rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[15px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
      />
      {buscando && (
        <p aria-live="polite" className="mt-3 text-[13px] text-[var(--muted)]">
          {achados.length === 0
            ? "Nenhum tutorial com esse termo. Tenta o nome da tela, como Financeiro ou Planner."
            : `${achados.length} ${achados.length === 1 ? "tutorial" : "tutoriais"}`}
        </p>
      )}

      <div className="mt-8 grid gap-10">
        {GRUPOS_TUTORIAL.map((grupo) => {
          const itens = achados.filter((t) => t.grupo === grupo);
          if (itens.length === 0) return null;
          return (
            <section key={grupo} aria-labelledby={`grupo-${grupo}`}>
              <h2
                id={`grupo-${grupo}`}
                className="font-accent text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]"
              >
                {grupo}
              </h2>
              <ul className="mt-3 grid list-none grid-cols-1 gap-x-8 p-0 md:grid-cols-2">
                {itens.map((t) => (
                  <li key={t.slug} className="border-t border-[var(--line)]">
                    <LinhaTutorial tutorial={t} base={base} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function LinhaTutorial({
  tutorial: t,
  base,
}: {
  tutorial: Tutorial;
  base: "/como-usar" | "/tutorial";
}) {
  const Icone = ICONE_TUTORIAL[t.slug as SlugTutorial] ?? PlayCircle;
  const plano = planoDoTutorial(t);
  const duracao = duracaoDoTrecho(t.trecho);
  return (
    <Link
      to={base === "/como-usar" ? "/como-usar/$slug" : "/tutorial/$slug"}
      params={{ slug: t.slug }}
      data-track="tutorial_aberto"
      data-track-props={JSON.stringify({ slug: t.slug, base })}
      className="group flex min-h-11 items-start gap-4 rounded-lg py-4 text-[var(--ink)] no-underline transition-colors hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] md:px-2"
    >
      <span className="grid h-10 w-10 flex-none place-items-center rounded-md bg-[var(--surface-pink)]">
        <Icone aria-hidden="true" className="h-5 w-5 text-[var(--ink)]" strokeWidth={1.5} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[16px] font-semibold">{t.nome}</span>
          {plano !== "Grátis" && (
            <span className="font-accent rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--ink-soft)]">
              {plano}
            </span>
          )}
        </span>
        <span className="mt-1 block text-[14px] leading-[1.55] text-[var(--ink-soft)]">
          {t.resumo}
        </span>
        <span className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
          {duracao ? (
            <>
              <PlayCircle size={14} aria-hidden="true" />
              Clipe de {duracao} e passo a passo
            </>
          ) : (
            "Passo a passo"
          )}
        </span>
      </span>
      <ArrowRight
        size={18}
        aria-hidden="true"
        className="mt-2.5 flex-none text-[var(--muted)] transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
