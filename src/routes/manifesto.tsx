import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/manifesto")({
  head: () => ({
    meta: [
      { title: "Manifesto · Pólia" },
      {
        name: "description",
        content:
          "O que a Pólia acredita: presença, não perfeição. Oportunidade, não culpa. Você é dona, nunca devedora.",
      },
      { property: "og:title", content: "Manifesto · Pólia" },
      { property: "og:description", content: "A gente acredita no seu ritmo, não na cobrança." },
    ],
  }),
  component: ManifestoPage,
});

const recusa = [
  "A sequência que pune quando quebra",
  "A meta no vermelho como cobrança",
  "O “você sumiu, não desista”",
  "Hype: “transforme”, “fature 6 dígitos”",
  "Tutorial bobo, mascote, professora de cima",
  "Jargão e feature de empresa grande",
];

const escolhe = [
  "Presença medida por avanço real",
  "Um convite: a etapa aberta te espera",
  "Você dona, nunca devedora",
  "O concreto: o preço que saiu da sua cabeça",
  "Respeitar a sua inteligência, do seu lado",
  "Do tamanho de uma pessoa só",
];

const credo = [
  {
    linha: "Presença vale mais que perfeição.",
    texto:
      "Não é sobre fazer tudo, todo dia, sem falhar. É sobre aparecer e andar um passo real. Aqui você é medida por avanço, não por dia impecável. Uma etapa fechada vale mais que uma lista inteira intimidando você.",
  },
  {
    linha: "A gente puxa pela oportunidade, nunca pela culpa.",
    texto:
      "“Tem uma etapa aberta, 4 minutos.” Isso é um convite. “Você sumiu, não desista” é uma cobrança disfarçada de incentivo, e a gente não usa. A etapa parada te espera sem cara feia, quanto tempo você precisar.",
  },
  {
    linha: "Você é dona, nunca devedora.",
    texto:
      "A sua marca não é uma dívida que se acumula quando você não mexe. É sua, e a Pólia trata assim. Sai de cada uso com uma coisa feita e a sensação de dona. Nunca com a régua na mão e a conta pra pagar.",
  },
  {
    linha: "A gente respeita a sua inteligência.",
    texto:
      "Sem tutorial bobo, sem explicar o óbvio, sem mascote fazendo graça. Você sabe o que faz. A Pólia foi feita por quem já viveu isso e senta do lado, não a professora que fala de cima nem o app que te acha ingênua.",
  },
  {
    linha: "Motiva o avanço real, não o hype.",
    texto:
      "Nada de “transforme seu negócio”, “fature 6 dígitos”, antes e depois de mentira. A Pólia comemora o concreto: o preço que saiu da sua cabeça, a bio que ficou pronta. Sobriedade é uma forma de respeito.",
  },
  {
    linha: "Do tamanho de uma pessoa só.",
    texto:
      "Você é o time inteiro. Então nada de feature de equipe, jargão corporativo ou complexidade de ERP. A Pólia cabe na sua rotina de uma pessoa que faz tudo, porque foi feita pra ela, não adaptada de uma ferramenta de empresa grande.",
  },
];

function ManifestoPage() {
  return (
    <div className="polia-v3 min-h-screen bg-white text-[var(--ink)]">
      <SiteHeader />

      <main>
        {/* HERO */}
        <section className="pb-12 pt-16 md:pb-16 md:pt-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              Manifesto
            </p>
            <h1 className="font-fraunces mt-4 max-w-[20ch] text-[40px] leading-[1.05] tracking-[-0.02em] text-[var(--ink)] md:text-[56px]">
              A gente acredita no seu ritmo, não na cobrança.
            </h1>
            <p className="mt-6 max-w-[60ch] text-[20px] leading-[1.5] text-[var(--ink-soft)] md:text-[22px]">
              A maioria das ferramentas te motiva com medo: a sequência que quebra, o vermelho da
              meta não batida, o “faz tempo que você não aparece”. A Pólia recusa isso por inteiro.
              Aqui vai o que a gente defende.
            </p>
          </div>
        </section>

        {/* RECUSA / ESCOLHE */}
        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
              <div className="rounded-xl border border-[var(--line)] bg-white p-6">
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                  A Pólia recusa
                </p>
                <ul className="mt-4 grid list-none gap-3 p-0">
                  {recusa.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-[15px] leading-[1.4] text-[var(--ink)]">
                      <X size={18} className="mt-0.5 flex-none text-[var(--muted)]" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-[var(--surface-pink)] bg-[var(--surface-pink)] p-6">
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                  A Pólia escolhe
                </p>
                <ul className="mt-4 grid list-none gap-3 p-0">
                  {escolhe.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-[15px] leading-[1.4] text-[var(--ink)]">
                      <Check size={18} className="mt-0.5 flex-none text-[var(--secondary-ink)]" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CREDO */}
        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[760px] px-6">
            {credo.map((item, i) => (
              <div key={item.linha} className={`py-12 ${i > 0 ? "border-t border-[var(--line)]" : ""}`}>
                <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="font-fraunces mt-3 max-w-[20ch] text-[30px] font-semibold leading-[1.12] tracking-[-0.02em] text-[var(--ink)] md:text-[44px]">
                  {item.linha}
                </p>
                <p className="mt-4 max-w-[54ch] text-[var(--ink-soft)]">{item.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ASSINATURA */}
        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="rounded-xl bg-[var(--secondary)] p-8 text-center md:p-12">
              <p className="font-fraunces mx-auto max-w-[24ch] text-[26px] italic leading-[1.3] text-[var(--secondary-ink)]">
                “Andei um passo real, e tem alguém do meu lado que percebe quando eu apareço.”
              </p>
              <p className="mt-4 text-[15px] text-[var(--secondary-ink)] opacity-75">
                O sentimento que toda tela da Pólia repete.
              </p>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[1120px] px-6 text-center">
            <h2 className="font-fraunces mx-auto max-w-[16ch] text-[32px] text-[var(--ink)] md:text-[40px]">
              Se isso é o seu jeito, a gente te espera.
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/auth/cadastro"
                className="rounded-lg bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] no-underline transition-[filter] hover:brightness-95"
              >
                Começar
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
