import { createFileRoute, Link } from "@tanstack/react-router";
import { User, GitMerge, Users, Banknote, CalendarCheck, Activity, Check } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pólia · Construa a sua marca, uma etapa por vez" },
      {
        name: "description",
        content:
          "A Pólia quebra a sua marca em etapas de poucos minutos e te mostra a próxima. Uma coisa de cada vez, no seu tempo. Feita pra quem toca a marca sozinha.",
      },
      { property: "og:title", content: "Pólia · Construa a sua marca, uma etapa por vez" },
      {
        property: "og:description",
        content: "Uma coisa de cada vez, no seu tempo. Feita pra quem toca a marca sozinha.",
      },
    ],
  }),
  component: HomePage,
});

const trilha = [
  { titulo: "Definir quem é a sua marca", status: "done" as const },
  { titulo: "Preço do carro-chefe", status: "done" as const, tempo: "6 min" },
  { titulo: "Bio que explica o que a marca faz", status: "open" as const, tempo: "5 min" },
  { titulo: "Primeira publicação da semana", status: "next" as const, tempo: "4 min" },
  { titulo: "Organizar os primeiros clientes", status: "next" as const, tempo: "7 min" },
];

const passos = [
  {
    n: "01",
    titulo: "A marca conta quem ela é",
    desc: "Uma coisa de cada vez: o que a marca vende, pra quem, o que trava. A Pólia monta as etapas do jeito dela.",
  },
  {
    n: "02",
    titulo: "Ela vira etapas de poucos minutos",
    desc: "Nada de “organize seu negócio”. Cada etapa é concreta e curta, tipo “escrever a bio”. Uma por vez.",
  },
  {
    n: "03",
    titulo: "Cada etapa fechada é um passo real",
    desc: "Quando a etapa fecha, a marca andou de verdade. A Pólia marca a Presença, sem confete.",
  },
];

const modulos = [
  {
    icon: User,
    titulo: "Identidade",
    desc: "Quem é a sua marca, pra quem ela fala e o que promete.",
  },
  {
    icon: GitMerge,
    titulo: "Etapas e Tarefas",
    desc: "A sua marca virada em passos curtos, na ordem que faz sentido.",
  },
  {
    icon: Users,
    titulo: "Clientes",
    desc: "Quem já comprou e quem está chegando, sem virar planilha.",
  },
  {
    icon: Banknote,
    titulo: "Números",
    desc: "Quanto entrou, quanto saiu, como o mês vai. Sem cara de planilha.",
  },
  {
    icon: CalendarCheck,
    titulo: "Etapa do dia",
    desc: "Ao abrir, a etapa de hoje já está ali. Sem decidir do zero toda vez.",
  },
  {
    icon: Activity,
    titulo: "Presença",
    desc: "O registro de presença e avanço. Medido por avanço.",
  },
];

function HomePage() {
  return (
    <div className="polia-v3 min-h-screen bg-white text-[var(--ink)]">
      <SiteHeader />

      <main>
        {/* HERO */}
        <section className="pb-12 pt-16 md:pb-16 md:pt-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[1.05fr_0.95fr] md:gap-16">
              <div>
                <h1 className="font-fraunces max-w-[16ch] text-[40px] leading-[1.05] tracking-[-0.02em] text-[var(--ink)] md:text-[56px]">
                  A sua marca inteira, uma etapa por vez.
                </h1>
                <p className="mt-6 max-w-[60ch] text-[20px] leading-[1.5] text-[var(--ink-soft)] md:text-[22px]">
                  Em vez de uma lista de 40 coisas que trava, a Pólia dá o próximo passo pequeno,
                  na ordem certa. A marca anda de verdade, sem se perder no meio.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    to="/precos"
                    className="rounded-lg bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] no-underline transition-[filter] hover:brightness-95"
                  >
                    Começar
                  </Link>
                  <Link
                    to="/como-funciona"
                    className="rounded-lg border border-[var(--ink)] px-8 py-4 text-[18px] font-semibold text-[var(--ink)] no-underline transition-colors hover:bg-[var(--ink)] hover:text-white"
                  >
                    Ver como funciona
                  </Link>
                </div>
              </div>

              <div
                role="img"
                aria-label="Exemplo das etapas da Pólia: algumas feitas, uma aberta e as próximas"
                className="max-w-[460px] rounded-xl border border-[var(--line)] bg-white p-6"
              >
                <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                  A trilha
                </p>
                {trilha.map((item) => (
                  <div
                    key={item.titulo}
                    className={`flex items-center gap-3 border-b border-[var(--line)] py-3 last:border-b-0 ${
                      item.status === "open"
                        ? "-mx-4 rounded-lg border-b-transparent bg-[var(--secondary-light)] px-4"
                        : ""
                    }`}
                  >
                    <span
                      className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[6px] border-2 text-[var(--secondary-ink)] ${
                        item.status === "done"
                          ? "border-[var(--secondary)] bg-[var(--secondary)]"
                          : item.status === "open"
                            ? "border-[var(--secondary)]"
                            : "border-[var(--line)]"
                      }`}
                    >
                      {item.status === "done" && <Check size={14} aria-hidden="true" />}
                    </span>
                    <span
                      className={`flex-1 text-[15px] ${item.status === "done" ? "text-[var(--muted)]" : "text-[var(--ink)]"}`}
                    >
                      {item.status === "open" ? (
                        <>
                          <strong>{item.titulo}</strong>
                          <br />
                          <span className="text-[13px] text-[var(--muted)]">aberta agora</span>
                        </>
                      ) : (
                        item.titulo
                      )}
                    </span>
                    {item.tempo && (
                      <span className="whitespace-nowrap text-[13px] text-[var(--muted)]">
                        {item.tempo}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* COMO FUNCIONA (teaser) */}
        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[1120px] px-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              Como funciona
            </p>
            <h2 className="font-fraunces mt-3 max-w-[24ch] text-[24px] text-[var(--ink)] md:text-[30px]">
              Do "não sei por onde começar" pra "fechei mais uma".
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              {passos.map((p) => (
                <div key={p.n} className="rounded-xl border border-[var(--line)] bg-white p-8">
                  <span className="font-fraunces text-[32px] leading-none text-[var(--secondary-ink)]">
                    {p.n}
                  </span>
                  <h3 className="font-fraunces mt-3 text-[19px] text-[var(--ink)]">{p.titulo}</h3>
                  <p className="mt-2 text-[14px] leading-[1.6] text-[var(--ink-soft)]">{p.desc}</p>
                </div>
              ))}
            </div>
            <Link
              to="/como-funciona"
              className="mt-6 inline-block text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]"
            >
              Ver como funciona em detalhe
            </Link>
          </div>
        </section>

        {/* NO SEU RITMO */}
        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="rounded-xl bg-[var(--accent)] p-8 md:p-12">
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-ink)] opacity-70">
                No seu tempo
              </p>
              <h2 className="font-fraunces mt-3 max-w-[24ch] text-[24px] text-[var(--accent-ink)] md:text-[30px]">
                A sua marca continua no seu ritmo.
              </h2>
              <p className="mt-4 max-w-[54ch] text-[var(--accent-ink)]">
                Faz tempo que não abre? A trilha continua de onde parou. A Pólia mostra a etapa
                aberta e o quanto falta. Sem recomeçar do zero, no seu tempo.
              </p>
            </div>
          </div>
        </section>

        {/* O QUE TEM DENTRO */}
        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[1120px] px-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              O que tem dentro
            </p>
            <h2 className="font-fraunces mt-3 text-[24px] text-[var(--ink)] md:text-[30px]">
              Tudo que a sua marca precisa, num lugar só.
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              {modulos.map((m) => {
                const Icon = m.icon;
                return (
                  <div
                    key={m.titulo}
                    className="rounded-xl border border-[var(--line)] bg-white p-8"
                  >
                    <Icon size={24} className="text-[var(--secondary-ink)]" aria-hidden="true" />
                    <h3 className="font-fraunces mt-3 text-[18px] text-[var(--ink)]">{m.titulo}</h3>
                    <p className="mt-2 text-[14px] leading-[1.6] text-[var(--ink-soft)]">
                      {m.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FUNDADORA */}
        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="rounded-xl border border-[var(--line)] bg-white p-8 md:p-12">
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                Quem faz
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-6">
                <div className="font-fraunces flex h-14 w-14 flex-none items-center justify-center rounded-lg bg-[var(--accent)] text-[26px] text-[var(--accent-ink)]">
                  S
                </div>
                <div className="min-w-[260px] flex-1">
                  <h2 className="font-fraunces max-w-[26ch] text-[24px] text-[var(--ink)]">
                    Feita por quem já tocou a própria marca sozinha.
                  </h2>
                  <p className="mt-3 max-w-[54ch] text-[var(--ink-soft)]">
                    A Sil já teve o próprio negócio e sentiu na pele o que trava pra quem é o
                    time inteiro. A Pólia nasceu do método que faltava, do lado de quem faz tudo.{" "}
                    <Link
                      to="/sobre"
                      className="text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]"
                    >
                      Conhecer a história
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MANIFESTO (teaser) */}
        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="rounded-xl bg-[var(--secondary)] p-8 text-center md:p-12">
              <p className="font-fraunces mx-auto max-w-[26ch] text-[26px] italic leading-[1.3] text-[var(--secondary-ink)]">
                Presença, não perfeição. Oportunidade, não culpa. Dona da marca, nunca devedora dela.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  to="/manifesto"
                  className="rounded-lg border border-[var(--ink)] px-8 py-4 text-[18px] font-semibold text-[var(--ink)] no-underline transition-colors hover:bg-[var(--ink)] hover:text-white"
                >
                  Ler o manifesto
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[1120px] px-6 text-center">
            <h2 className="font-fraunces mx-auto max-w-[18ch] text-[32px] text-[var(--ink)] md:text-[40px]">
              Comece pela primeira etapa.
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/precos"
                className="rounded-lg bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] no-underline transition-[filter] hover:brightness-95"
              >
                Começar
              </Link>
              <Link
                to="/precos"
                className="rounded-lg border border-[var(--ink)] px-8 py-4 text-[18px] font-semibold text-[var(--ink)] no-underline transition-colors hover:bg-[var(--ink)] hover:text-white"
              >
                Ver preços
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
