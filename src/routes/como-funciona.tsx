import { createFileRoute, Link } from "@tanstack/react-router";
import {
  User,
  Route as RouteIcon,
  Flag,
  Users,
  Banknote,
  CalendarCheck,
  Activity,
  Check,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/como-funciona")({
  head: () => ({
    meta: [
      { title: "Como funciona · Pólia" },
      {
        name: "description",
        content:
          "A Pólia pega a sua marca e quebra numa trilha de etapas curtas. Uma coisa de cada vez, no seu tempo, com a Aimer apontando o próximo passo.",
      },
      { property: "og:title", content: "Como funciona · Pólia" },
      {
        property: "og:description",
        content: "Uma coisa de cada vez. Do seu jeito.",
      },
    ],
  }),
  component: ComoFuncionaPage,
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
    icon: User,
    pill: "Identidade",
    titulo: "A marca conta quem ela é.",
    desc: "Sem formulário gigante. A Pólia pergunta uma coisa de cada vez: o que a marca vende, pra quem, e o que trava hoje. A partir daí ela monta a sua Trilha, do jeito dela, não um template genérico.",
  },
  {
    n: "02",
    icon: RouteIcon,
    pill: "Trilha e Tarefas",
    titulo: "A trilha vira etapas de poucos minutos.",
    desc: "Cada etapa é uma Tarefa concreta de 4 a 6 minutos: “definir o preço do carro-chefe”, “escrever a bio que explica o que a marca faz”. Nada de “organize seu negócio”. É pequeno o bastante pra caber num dia cheio.",
  },
  {
    n: "03",
    icon: Flag,
    pill: "Etapa e Presença",
    titulo: "Cada etapa fechada é um passo real.",
    desc: "Quando a etapa fecha, a marca andou de verdade. A Pólia registra a Presença sem confete e sem troféu. O que importa é o avanço.",
  },
];

const modulos = [
  {
    icon: User,
    titulo: "Identidade",
    desc: "Quem é a sua marca, pra quem ela fala e o que promete. A base de tudo que a Pólia sugere.",
  },
  {
    icon: RouteIcon,
    titulo: "Trilha e Tarefas",
    desc: "A sua marca virada em etapas curtas, na ordem que faz sentido. Uma coisa de cada vez.",
  },
  {
    icon: Users,
    titulo: "Clientes",
    desc: "Quem já comprou e quem está chegando, sem virar planilha nem cadastro de empresa grande.",
  },
  {
    icon: Banknote,
    titulo: "Números",
    desc: "Quanto entrou, quanto saiu, como o mês está indo. Simples, sem cara de planilha.",
  },
  {
    icon: CalendarCheck,
    titulo: "Trilha do dia",
    desc: "Ao abrir, a etapa de hoje já está ali. Sem decidir por onde começar do zero toda vez.",
  },
  {
    icon: Activity,
    titulo: "Presença",
    desc: "O registro de presença e avanço. Medido por avanço, nunca por dia perfeito.",
  },
];

function ComoFuncionaPage() {
  return (
    <div className="polia-v3 min-h-screen bg-white text-[var(--ink)]">
      <SiteHeader />

      <main>
        {/* HERO */}
        <section className="pb-12 pt-16 md:pb-16 md:pt-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              Como funciona
            </p>
            <h1 className="font-fraunces mt-4 max-w-[16ch] text-[40px] leading-[1.05] tracking-[-0.02em] text-[var(--ink)] md:text-[56px]">
              Uma coisa de cada vez. Do seu jeito.
            </h1>
            <p className="mt-6 max-w-[60ch] text-[20px] leading-[1.5] text-[var(--ink-soft)] md:text-[22px]">
              A Pólia pega a sua marca inteira e quebra numa trilha de etapas curtas. Uma etapa por
              dia, ou uma por semana. O ritmo é seu, e sempre tem alguém do lado mostrando
              o próximo passo.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/precos"
                className="rounded-lg bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] no-underline transition-[filter] hover:brightness-95"
              >
                Começar
              </Link>
            </div>
          </div>
        </section>

        {/* MOCK DA TRILHA */}
        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-16">
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                  A sua marca vira uma trilha
                </p>
                <h2 className="font-fraunces mt-3 text-[24px] text-[var(--ink)] md:text-[30px]">
                  Em vez de uma lista de 40 coisas, uma etapa por vez.
                </h2>
                <p className="mt-3 text-[var(--ink-soft)]">
                  Cada etapa é pequena e concreta, com um tempo do lado. A Aimer deixa uma aberta,
                  na ordem que faz sentido. Uma fecha, a próxima abre.
                </p>
              </div>

              <div
                role="img"
                aria-label="Exemplo de trilha da Pólia com etapas feitas, uma aberta e as próximas"
                className="max-w-[480px] rounded-xl border border-[var(--line)] bg-white p-6"
              >
                <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                  Sua trilha
                </p>
                {trilha.map((item, i) => (
                  <div
                    key={item.titulo}
                    className={`flex items-center gap-3 border-b border-[var(--line)] py-3 last:border-b-0 ${
                      item.status === "open" ? "-mx-4 rounded-lg border-b-transparent bg-[var(--secondary-light)] px-4" : ""
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
                    <span className={`flex-1 text-[15px] ${item.status === "done" ? "text-[var(--muted)]" : "text-[var(--ink)]"}`}>
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
                      <span className="whitespace-nowrap text-[13px] text-[var(--muted)]">{item.tempo}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 3 PASSOS */}
        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[1120px] px-6">
            <p className="mb-8 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              Como funciona, em 3 passos
            </p>
            {passos.map((p, i) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.n}
                  className={`grid grid-cols-1 gap-4 md:grid-cols-[120px_1fr] md:gap-8 ${
                    i > 0 ? "mt-12 border-t border-[var(--line)] pt-12" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-fraunces text-[40px] leading-none text-[var(--ink)]">{p.n}</span>
                    <Icon size={26} className="text-[var(--secondary-ink)]" aria-hidden="true" />
                  </div>
                  <div>
                    <span className="inline-flex rounded-[4px] bg-[var(--secondary-light)] px-3 py-1 text-[13px] font-semibold text-[var(--secondary-ink)]">
                      {p.pill}
                    </span>
                    <h2 className="font-fraunces mt-3 text-[24px] text-[var(--ink)] md:text-[30px]">{p.titulo}</h2>
                    <p className="mt-3 text-[var(--ink-soft)]">{p.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* NO SEU RITMO */}
        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="rounded-xl bg-[var(--accent)] p-8 md:p-12">
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-ink)] opacity-70">
                No seu ritmo
              </p>
              <h2 className="font-fraunces mt-3 max-w-[24ch] text-[24px] text-[var(--accent-ink)] md:text-[30px]">
                A sua trilha continua no seu ritmo.
              </h2>
              <p className="mt-4 max-w-[54ch] text-[var(--accent-ink)]">
                Faz tempo que não abre? Sem problema. A trilha continua de onde parou: a Pólia
                mostra a etapa aberta e o quanto falta. Sem recomeçar do zero, no seu tempo.
              </p>
            </div>
          </div>
        </section>

        {/* O QUE TEM DENTRO */}
        <section className="pb-16 md:pb-24">
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
                  <div key={m.titulo} className="rounded-xl border border-[var(--line)] bg-white p-8">
                    <Icon size={24} className="text-[var(--secondary-ink)]" aria-hidden="true" />
                    <h3 className="font-fraunces mt-3 text-[18px] text-[var(--ink)]">{m.titulo}</h3>
                    <p className="mt-2 text-[14px] leading-[1.6] text-[var(--ink-soft)]">{m.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[1120px] px-6 text-center">
            <h2 className="font-fraunces mx-auto max-w-[18ch] text-[32px] text-[var(--ink)] md:text-[40px]">
              Bora fechar a primeira etapa?
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
