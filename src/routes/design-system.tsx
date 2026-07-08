import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/design-system")({
  head: () => ({
    meta: [
      { title: "Design System · Pólia" },
      {
        name: "description",
        content: "O sistema visual da Pólia: cores, tipografia, componentes e voz.",
      },
    ],
  }),
  // Ferramenta interna (guia de voz + tokens) — mesma checagem de admin.tsx.
  // Fica fora do layout /admin/* de propósito: essa página tem chrome próprio
  // (header cheio, sem sidebar de 220px) pra funcionar como vitrine standalone.
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth/login" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!profile?.is_admin) throw redirect({ to: "/painel" });
  },
  component: DesignSystemPage,
});

const CORES = [
  { nome: "Terracota", hex: "#C96B3E", uso: "primária · ações" },
  { nome: "Creme", hex: "#FDF8F5", uso: "fundo", borda: true },
  { nome: "Noite", hex: "#1A1A2E", uso: "texto" },
  { nome: "Musgo", hex: "#2D6A4F", uso: "sucesso · concluído" },
  { nome: "Dourado", hex: "#C8A96E", uso: "destaque" },
  { nome: "Mostarda", hex: "#B8862E", uso: "atenção · selos" },
  { nome: "Marrom", hex: "#3A2A1F", uso: "papel · caderno" },
  { nome: "Construção", hex: "#1A7FAD", uso: "em progresso" },
  { nome: "Evolução", hex: "#6B50CC", uso: "planejado" },
  { nome: "Sonho", hex: "#C9407A", uso: "alerta · remover" },
];

const TIPOS = [
  {
    fam: "DM Serif Display",
    classe: "font-serif",
    amostra: "Cada estrela acesa marca um ponto no seu mapa.",
    uso: "títulos",
  },
  {
    fam: "Inter",
    classe: "font-sans",
    amostra: "O dia a dia da sua marca, num lugar só: sem jargão, sem ruído.",
    uso: "texto corrido",
  },
  {
    fam: "DM Sans",
    classe: "font-accent",
    amostra: "RÓTULOS E ETIQUETAS",
    uso: "labels (caixa alta)",
  },
  {
    fam: "Caveat",
    classe: "caveat-informacional",
    amostra: "feito com carinho, do seu jeito.",
    uso: "toques manuscritos",
  },
];

function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <header className="border-b border-[rgba(26,26,46,0.08)] px-6 py-5 md:px-12">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between">
          <a href="/" className="font-serif text-[20px] text-[#1A1A2E]">
            Pólia
          </a>
          <span className="font-accent text-[10px] font-bold uppercase tracking-[2px] text-[#C96B3E]">
            Design System
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-6 py-12 md:px-12">
        <div className="mb-14 max-w-[640px]">
          <h1 className="mb-3 font-serif text-[44px] leading-tight text-[#1A1A2E] md:text-[56px]">
            O mundo visual da Pólia
          </h1>
          <p className="font-sans text-[17px] leading-relaxed text-[#1A1A2E] opacity-65">
            Territorial diurno: creme, terracota e mostarda. Quente, humano e claro, feito pra
            mulher que toca o próprio negócio.
          </p>
        </div>

        {/* CORES */}
        <Secao titulo="Cores">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {CORES.map((c) => (
              <div
                key={c.nome}
                className="overflow-hidden rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white"
              >
                <div
                  className="h-24 w-full"
                  style={{
                    background: c.hex,
                    borderBottom: c.borda ? "1px solid rgba(26,26,46,0.08)" : "none",
                  }}
                />
                <div className="p-3">
                  <p className="font-sans text-[14px] font-medium text-[#1A1A2E]">{c.nome}</p>
                  <p className="font-mono text-[11px] uppercase tracking-[1px] text-[#1A1A2E] opacity-45">
                    {c.hex}
                  </p>
                  <p className="mt-1 font-sans text-[12px] text-[#1A1A2E] opacity-50">{c.uso}</p>
                </div>
              </div>
            ))}
          </div>
        </Secao>

        {/* TIPOGRAFIA */}
        <Secao titulo="Tipografia">
          <div className="space-y-5">
            {TIPOS.map((t) => (
              <div
                key={t.fam}
                className="flex flex-col gap-2 rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-5 md:flex-row md:items-center md:justify-between"
              >
                <p className={`${t.classe} text-[24px] text-[#1A1A2E]`}>{t.amostra}</p>
                <div className="shrink-0 text-right">
                  <p className="font-sans text-[13px] font-medium text-[#1A1A2E]">{t.fam}</p>
                  <p className="font-sans text-[12px] text-[#1A1A2E] opacity-50">{t.uso}</p>
                </div>
              </div>
            ))}
          </div>
        </Secao>

        {/* COMPONENTES */}
        <Secao titulo="Componentes">
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Botões */}
            <Bloco titulo="Botões">
              <div className="flex flex-wrap items-center gap-3">
                <button className="rounded-xl bg-polia-terracota px-5 py-2.5 font-sans text-[14px] font-semibold text-polia-creme">
                  Primário
                </button>
                <button className="rounded-xl border border-[rgba(201,107,62,0.4)] px-5 py-2.5 font-sans text-[14px] font-medium text-[#C96B3E]">
                  Secundário
                </button>
                <button className="rounded-xl border border-[rgba(26,26,46,0.12)] px-5 py-2.5 font-sans text-[14px] text-[#1A1A2E]">
                  Neutro
                </button>
              </div>
            </Bloco>

            {/* Pills/badges */}
            <Bloco titulo="Etiquetas">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[rgba(45,106,79,0.1)] px-2.5 py-1 font-sans text-[12px] font-medium text-[#2D6A4F]">
                  Concluído
                </span>
                <span className="rounded-full bg-[rgba(184,134,46,0.14)] px-2.5 py-1 font-sans text-[12px] font-medium text-[#B8862E]">
                  Atenção
                </span>
                <span className="rounded-full bg-[rgba(201,107,62,0.1)] px-2.5 py-1 font-sans text-[12px] font-medium text-[#C96B3E]">
                  Em foco
                </span>
              </div>
            </Bloco>

            {/* Input */}
            <Bloco titulo="Campo de texto">
              <input
                type="text"
                placeholder="digite aqui…"
                className="h-[46px] w-full rounded-xl border border-[rgba(26,26,46,0.12)] px-4 font-sans text-[15px] text-[#1A1A2E] placeholder:opacity-30 focus:border-[#C96B3E] focus:shadow-[0_0_0_3px_rgba(201,107,62,0.08)] focus:outline-none"
              />
            </Bloco>

            {/* Card */}
            <Bloco titulo="Card">
              <div className="rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-4 shadow-[0_1px_2px_rgba(26,26,46,0.04)]">
                <p className="font-serif text-[17px] text-[#1A1A2E]">Uma etapa no seu mapa</p>
                <p className="mt-1 font-sans text-[13px] text-[#1A1A2E] opacity-55">
                  superfície branca, cantos suaves, sombra discreta.
                </p>
              </div>
            </Bloco>
          </div>
        </Secao>

        {/* VOZ */}
        <Secao titulo="Voz · Linguagem Aimer">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[rgba(45,106,79,0.2)] bg-[rgba(45,106,79,0.04)] p-5">
              <p className="mb-3 font-accent text-[10px] font-bold uppercase tracking-[1.5px] text-[#2D6A4F]">
                A gente fala assim
              </p>
              <ul className="space-y-1.5 font-sans text-[14px] text-[#1A1A2E]">
                <li>“seus números”, “quanto você entrega por semana”</li>
                <li>“o dia a dia da sua marca”</li>
                <li>caloroso, direto, adulto</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-[rgba(201,64,122,0.2)] bg-[rgba(201,64,122,0.04)] p-5">
              <p className="mb-3 font-accent text-[10px] font-bold uppercase tracking-[1.5px] text-[#C9407A]">
                A gente não fala
              </p>
              <ul className="space-y-1.5 font-sans text-[14px] text-[#1A1A2E]">
                <li>KPI, dashboard, pipeline, brand board</li>
                <li>jargão corporativo em inglês</li>
                <li>tom infantilizado ou cheerleader</li>
              </ul>
            </div>
          </div>
        </Secao>
      </main>

      <footer className="border-t border-[rgba(26,26,46,0.08)] px-6 py-8 text-center md:px-12">
        <p className="caveat-decorativo text-[#C96B3E]">um sistema vivo, cresce com a Pólia.</p>
      </footer>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-14">
      <h2 className="mb-5 font-accent text-[11px] font-bold uppercase tracking-[2px] text-[#1A1A2E] opacity-50">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-5">
      <p className="mb-3 font-sans text-[13px] font-medium text-[#1A1A2E] opacity-70">{titulo}</p>
      {children}
    </div>
  );
}
