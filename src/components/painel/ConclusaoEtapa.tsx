import { TerritorioCanvas } from "./TerritorioCanvas";
import { SeloCarimbo } from "./SeloCarimbo";

interface FerramentaDesbloqueada {
  titulo: string;
  descricao: string;
}

interface ConclusaoEtapaProps {
  numero: number;                        // 1-11
  nomeEtapa: string;                     // Ex: "Identidade do seu negócio"
  palavraHighlight: string;              // Ex: "Identidade" (recebe highlight mostarda no titulo)
  palavraMarco: string;                  // Ex: "IDENTIDADE" (vai dentro do selo)
  subtituloIntimo?: string;              // Frase opcional íntima logo após o título (ex: "É o primeiro ponto do seu mapa.")
  ferramentaDesbloqueada?: FerramentaDesbloqueada;
  proximaEtapaLabel?: string;            // Ex: "Começar Etapa 3 →"
  onVerPainel: () => void;
  onProximaEtapa?: () => void;
}

/**
 * Tela ritual de Conclusao das etapas — virada terrena.
 * Fundo creme + selo de carimbo + mini-trilha de marcos + ferramenta desbloqueada.
 */
export function ConclusaoEtapa({
  numero,
  nomeEtapa,
  palavraHighlight,
  palavraMarco,
  subtituloIntimo,
  ferramentaDesbloqueada,
  proximaEtapaLabel,
  onVerPainel,
  onProximaEtapa,
}: ConclusaoEtapaProps) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <TerritorioCanvas />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1100px] flex-col items-center px-6 py-20 text-center">
        <p className="font-accent text-[11px] font-bold tracking-[2.5px] uppercase text-polia-mostarda-intenso">
          Etapa {numero} · {nomeEtapa} · conquistada
        </p>

        <p className="caveat-informacional text-polia-terracota mt-8">
          olha o que aconteceu agora.
        </p>

        <h1 className="mt-3 max-w-[820px] font-serif text-[40px] leading-[1.1] text-polia-marrom md:text-[56px]">
          Você marcou a{" "}
          <span
            className="relative inline-block"
            style={{
              background: "#D4A574",
              padding: "0 0.18em",
              borderRadius: 3,
              transform: "rotate(-2deg)",
              color: "#3A2A1F",
              fontWeight: 500,
            }}
          >
            {palavraHighlight}
          </span>{" "}
          no seu mapa.
        </h1>

        {subtituloIntimo && (
          <p className="mt-4 max-w-[480px] caveat-decorativo text-[20px] text-polia-terracota">
            {subtituloIntimo}
          </p>
        )}

        {/* Selo de carimbo */}
        <div className="mt-14">
          <SeloCarimbo numero={numero} palavraMarco={palavraMarco} />
        </div>

        {/* Mini-trilha de marcos */}
        <div className="mt-14 flex w-full justify-center gap-2 overflow-x-auto pb-4 sm:gap-3">
          {Array.from({ length: 11 }).map((_, i) => {
            const n = i + 1;
            const estado: "concluido" | "agora" | "futuro" =
              n < numero ? "concluido" : n === numero ? "agora" : "futuro";
            return (
              <div key={n} className="flex shrink-0 flex-col items-center">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full font-serif text-[14px] font-medium"
                  style={
                    estado === "concluido"
                      ? { background: "#3A2A1F", color: "#FDF8F5" }
                      : estado === "agora"
                        ? {
                            background: "#C96B3E",
                            color: "#FDF8F5",
                            animation:
                              "polia-respiracao 3s ease-in-out infinite",
                          }
                        : {
                            border: "1.5px solid #C9BFB2",
                            color: "#C9BFB2",
                          }
                  }
                  aria-label={
                    estado === "concluido"
                      ? `Marco ${n} conquistado`
                      : estado === "agora"
                        ? `Marco ${n} — agora`
                        : `Marco ${n} no horizonte`
                  }
                >
                  {n}
                </div>
              </div>
            );
          })}
        </div>

        {/* Card de ferramenta desbloqueada (opcional) */}
        {ferramentaDesbloqueada && (
          <div className="mt-12 w-full max-w-[560px] rounded-[20px] border border-polia-mostarda/40 bg-white p-7 text-left shadow-sm">
            <p className="font-accent text-[9px] font-bold uppercase tracking-[2px] text-polia-mostarda-intenso">
              ANDA COM VOCÊ AGORA
            </p>
            <p className="mt-2 font-serif text-[24px] text-polia-marrom">
              {ferramentaDesbloqueada.titulo}
            </p>
            <p className="mt-2 font-sans text-[15px] leading-[24px] text-polia-marrom/70">
              {ferramentaDesbloqueada.descricao}
            </p>
          </div>
        )}

        {/* Frase-ritual */}
        <p className="mt-14 max-w-[480px] caveat-decorativo text-[20px] text-polia-terracota">
          Cada marco aberto desenha um pedaço do seu mapa.
        </p>

        {/* Mantra */}
        <p className="mt-10 font-serif text-[24px] text-polia-terracota">
          A Pólia não acaba. Ela só fica mais sua.
        </p>
        <p className="mt-2 caveat-decorativo text-polia-marrom/60">
          cada vez que você volta, encontra mais de você aqui
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col gap-4 md:flex-row">
          <button
            onClick={onVerPainel}
            className="h-[54px] rounded-[12px] border border-polia-terracota bg-transparent px-6 font-sans text-[15px] font-semibold text-polia-terracota transition-colors hover:bg-polia-terracota/10"
          >
            Ver meu mapa
          </button>
          {onProximaEtapa && proximaEtapaLabel && (
            <button
              onClick={onProximaEtapa}
              className="h-[54px] rounded-[12px] bg-polia-terracota px-8 font-sans text-[15px] font-semibold text-polia-creme transition-colors hover:bg-[#B85A2D]"
              style={{ boxShadow: "0 4px 14px rgba(201,107,62,0.25)" }}
            >
              {proximaEtapaLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
