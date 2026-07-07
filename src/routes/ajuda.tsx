import { createFileRoute, Link } from "@tanstack/react-router";
import { PlayCircle, User, GitMerge, Users, Wallet, CreditCard } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/ajuda")({
  head: () => ({
    meta: [
      { title: "Ajuda · Pólia" },
      {
        name: "description",
        content: "Central de ajuda da Pólia. Respostas curtas e diretas pra você voltar pra sua etapa rápido.",
      },
      { property: "og:title", content: "Ajuda · Pólia" },
      { property: "og:description", content: "Como a gente pode ajudar?" },
    ],
  }),
  component: AjudaPage,
});

const CATEGORIAS = [
  {
    icon: PlayCircle,
    titulo: "Primeiros passos",
    itens: [
      "Como a Pólia monta as minhas etapas",
      "O que fazer no primeiro dia",
      "Usando no celular",
    ],
  },
  {
    icon: User,
    titulo: "Identidade",
    itens: [
      "Definir quem é a minha marca",
      "Mudar o que vendo depois",
      "Por que a Pólia me pergunta isso",
    ],
  },
  {
    icon: GitMerge,
    titulo: "Etapas e Tarefas",
    itens: ["Fechar uma etapa", "Reordenar as tarefas do dia", "Voltar e continuar de onde parei"],
  },
  {
    icon: Users,
    titulo: "Clientes",
    itens: ["Adicionar um cliente", "Acompanhar quem está chegando", "Exportar a minha lista"],
  },
  {
    icon: Wallet,
    titulo: "Números",
    itens: ["Registrar uma venda", "Entender o resumo do mês", "De onde vêm esses valores"],
  },
  {
    icon: CreditCard,
    titulo: "Conta e plano",
    itens: ["Trocar de e-mail ou senha", "Como cancelar", "Como funciona a cobrança"],
  },
];

function AjudaPage() {
  return (
    <div className="polia-v3 min-h-screen bg-white text-[var(--ink)]">
      <SiteHeader />

      <main>
        {/* HERO + BUSCA */}
        <section className="pb-12 pt-16 md:pb-16 md:pt-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              Ajuda
            </p>
            <h1 className="font-fraunces mt-4 text-[40px] leading-[1.05] tracking-[-0.02em] text-[var(--ink)] md:text-[56px]">
              Como a gente pode ajudar?
            </h1>
            <p className="mt-6 max-w-[60ch] text-[20px] leading-[1.5] text-[var(--ink-soft)] md:text-[22px]">
              Respostas curtas e diretas, pra você voltar pra sua etapa rápido. Sem tutorial de dez
              minutos pra uma coisa de um clique.
            </p>
            <form
              role="search"
              onSubmit={(e) => e.preventDefault()}
              className="mt-8 flex max-w-[620px] flex-col gap-3 sm:flex-row"
            >
              <label htmlFor="q" className="sr-only">
                Buscar na ajuda
              </label>
              <input
                id="q"
                type="search"
                placeholder="Buscar: preço, cancelar, etapa..."
                className="w-full flex-1 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-[15px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--secondary)]"
              />
              <button
                type="submit"
                className="whitespace-nowrap rounded-lg bg-[var(--secondary)] px-6 py-3 text-[15px] font-semibold text-[var(--secondary-ink)] transition-[filter] hover:brightness-95"
              >
                Buscar
              </button>
            </form>
          </div>
        </section>

        {/* CATEGORIAS */}
        <section className="pb-12 md:pb-16">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {CATEGORIAS.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div key={cat.titulo} className="rounded-xl border border-[var(--line)] bg-white p-6">
                    <Icon size={24} className="mb-3 text-[var(--secondary-ink)]" aria-hidden="true" />
                    <h3 className="font-fraunces text-[18px] text-[var(--ink)]">{cat.titulo}</h3>
                    <ul className="mt-4 grid list-none gap-0 p-0">
                      {cat.itens.map((item, i) => (
                        <li key={item} className={i > 0 ? "border-t border-[var(--line)]" : ""}>
                          <a
                            href="#"
                            onClick={(e) => e.preventDefault()}
                            className="block py-3 text-[15px] text-[var(--ink)] no-underline hover:underline hover:decoration-[var(--secondary)] hover:decoration-2 hover:underline-offset-[3px]"
                          >
                            {item}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* NÃO ACHOU */}
        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="flex flex-wrap items-center justify-between gap-5 rounded-xl bg-[var(--secondary)] p-8">
              <div>
                <h2 className="font-fraunces max-w-[22ch] text-[24px] text-[var(--secondary-ink)] md:text-[28px]">
                  Não achou o que precisava?
                </h2>
                <p className="mt-3 max-w-[44ch] text-[var(--secondary-ink)]">
                  Escreve pra gente. Quem responde é gente de verdade, do tamanho de uma pessoa só.
                </p>
              </div>
              <Link
                to="/contato"
                className="rounded-lg border border-[var(--secondary-ink)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] no-underline transition-colors hover:bg-[var(--secondary-ink)] hover:text-white"
              >
                Falar com a gente
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
