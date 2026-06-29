import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/case-de-ux")({
  head: () => ({
    meta: [
      { title: "Case de UX · Pólia" },
      {
        name: "description",
        content: "Como a Pólia foi desenhada: o desafio, a persona e as decisões de design.",
      },
    ],
  }),
  component: CaseUxPage,
});

function CaseUxPage() {
  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <header className="border-b border-[rgba(26,26,46,0.08)] px-6 py-5 md:px-12">
        <div className="mx-auto flex max-w-[860px] items-center justify-between">
          <a href="/" className="font-serif text-[20px] text-[#1A1A2E]">
            Pólia
          </a>
          <span className="font-accent text-[10px] font-bold uppercase tracking-[2px] text-[#C96B3E]">
            Case de UX
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[860px] px-6 py-14 md:px-12">
        {/* Hero */}
        <div className="mb-16">
          <p className="mb-3 caveat-informacional text-[#C96B3E]">um estudo de caso</p>
          <h1 className="mb-4 font-serif text-[44px] leading-[1.1] text-[#1A1A2E] md:text-[60px]">
            Uma plataforma que cuida de quem cuida do próprio negócio.
          </h1>
          <p className="max-w-[620px] font-sans text-[18px] leading-relaxed text-[#1A1A2E] opacity-65">
            A Pólia nasceu pra mulher que toca a marca sozinha — e se afoga em ferramentas,
            planilhas e jargão. O desafio de design foi transformar caos em um lugar que acolhe.
          </p>
        </div>

        <Tela label="HOME / PAINEL — visão geral" altura={420} />

        {/* Desafio */}
        <Bloco numero="01" titulo="O desafio">
          <p>
            Empreendedoras solo vivem entre dez abas abertas: uma pro financeiro, uma pras tarefas,
            uma pro conteúdo, uma pro estoque. Nenhuma fala a língua delas — todas falam
            “dashboard”, “pipeline”, “KPI”.
          </p>
          <p>
            O problema não era falta de ferramenta. Era falta de <strong>um lugar só</strong>,
            calmo, que entendesse o dia a dia real de quem faz tudo.
          </p>
        </Bloco>

        {/* Persona */}
        <Bloco numero="02" titulo="A persona — a Aimer">
          <p>
            Aimer, 32, já tem um negócio de método próprio (ateliê, marca, serviço). Não está
            começando do zero — está buscando profissionalizar a operação. É adulta, capaz e
            ocupada. Quer clareza, não mais um curso.
          </p>
          <p className="caveat-informacional text-[#C96B3E]">
            “me dá um lugar que me entenda, sem me tratar como criança nem como executiva.”
          </p>
        </Bloco>

        {/* Virada terrena */}
        <Bloco numero="03" titulo="A virada terrena">
          <p>
            A primeira metáfora era cósmica — céu, estrelas, constelações. Bonita, mas distante (e,
            em PT-BR, “céu” carrega um peso funéreo). Viramos pra algo <strong>terreno</strong>:
            território, mapa, trilha, marco, bússola.
          </p>
          <p>
            Mais perto do chão, mais perto dela. O mantra virou:{" "}
            <em>“cada estrela acesa marca um ponto no seu mapa.”</em>
          </p>
        </Bloco>

        <Tela label="MAPA / JORNADA — território tomando forma" altura={360} />

        {/* Arquitetura */}
        <Bloco numero="04" titulo="Núcleo + Órbita">
          <p>
            A arquitetura é um sistema vivo: <strong>11 etapas no centro</strong> (a jornada que
            estrutura o negócio) e <strong>ferramentas-companheiras orbitando</strong> (vendas,
            vitrine, financeiro, marca viva). Você nunca “termina” a Pólia — aprende a voar nela.
          </p>
          <p>
            Por cima, a camada <strong>“Seu dia”</strong>: diário de bem-estar, hábitos, metas,
            foco, caderno, quadros, sua guia. A operação diária da marca.
          </p>
        </Bloco>

        {/* Marcadores */}
        <Bloco numero="05" titulo="Marcadores que ninguém copia">
          <p>Três decisões deixam a Pólia inconfundível — “filha da Sil, não gêmea de ninguém”:</p>
          <ul className="ml-1 mt-2 space-y-2">
            <li>
              <strong>A Raposa-Companheira</strong> — uma guia em vários estados que caminha do lado
              dela, não na frente. Hoje também conversa (IA) e dá pequenos insights.
            </li>
            <li>
              <strong>O Carimbo de Cartógrafa</strong> — cada conquista vira um selo datado, marca
              de quem percorreu o território.
            </li>
            <li>
              <strong>O Caderno Vivido</strong> — papel pautado, cantos com orelha dobrada e
              anotações manuscritas que reaparecem quando você volta.
            </li>
          </ul>
        </Bloco>

        <Tela label="SUA GUIA + CADERNO — marcadores exclusivos" altura={360} />

        {/* Resultado */}
        <Bloco numero="06" titulo="O resultado">
          <p>
            Um produto que junta produtividade e bem-estar numa voz só — a Linguagem Aimer, sem
            jargão. Da jornada de 11 etapas ao check-in do dia, tudo conversa.
          </p>
          <p>
            E uma regra que sustenta cada decisão: <strong>imersivo nos momentos</strong>{" "}
            (onboarding, conquistas, entregáveis), <strong>limpo nos fluxos de trabalho</strong>.
          </p>
        </Bloco>

        <div className="mt-16 rounded-2xl border border-[rgba(201,107,62,0.2)] bg-[rgba(201,107,62,0.05)] p-8 text-center">
          <p className="mb-1 font-serif text-[24px] text-[#1A1A2E]">
            Você não chega ao fim da Pólia.
          </p>
          <p className="caveat-informacional text-[#C96B3E]">Você aprende a voar nela.</p>
        </div>
      </main>

      <footer className="border-t border-[rgba(26,26,46,0.08)] px-6 py-8 text-center md:px-12">
        <a href="/" className="font-sans text-[14px] text-[#C96B3E] hover:underline">
          ← voltar pra Pólia
        </a>
      </footer>
    </div>
  );
}

function Bloco({
  numero,
  titulo,
  children,
}: {
  numero: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14">
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-serif text-[18px] text-[#C96B3E]">{numero}</span>
        <h2 className="font-serif text-[28px] text-[#1A1A2E] md:text-[34px]">{titulo}</h2>
      </div>
      <div className="space-y-4 font-sans text-[16px] leading-relaxed text-[#1A1A2E] opacity-80 [&_em]:text-[#C96B3E] [&_strong]:font-semibold [&_strong]:text-[#1A1A2E]">
        {children}
      </div>
    </section>
  );
}

function Tela({ label, altura }: { label: string; altura: number }) {
  return (
    <div
      className="mb-16 flex items-center justify-center rounded-2xl border border-dashed border-[rgba(26,26,46,0.15)] bg-white/50"
      style={{ height: altura }}
    >
      <span className="font-accent text-[11px] font-bold uppercase tracking-[2px] text-[#1A1A2E] opacity-30">
        {label}
      </span>
    </div>
  );
}
