interface Star {
  name: string;
  short: string;
  etapa: number;
}

interface Phase {
  label: string;
  color: string;
  stars: Star[];
}

const phases: Phase[] = [
  {
    label: "SONHO",
    color: "#C9407A",
    stars: [
      { name: "Descoberta", short: "Descoberta", etapa: 1 },
      { name: "Identidade", short: "Identidade", etapa: 2 },
      { name: "Modelo", short: "Modelo", etapa: 3 },
    ],
  },
  {
    label: "CONSTRUÇÃO",
    color: "#1A7FAD",
    stars: [
      { name: "Presença", short: "Presença", etapa: 4 },
      { name: "Conteúdo", short: "Conteúdo", etapa: 5 },
      { name: "Gestão", short: "Gestão", etapa: 6 },
    ],
  },
  {
    label: "VENDA",
    color: "#1A8F5C",
    stars: [
      { name: "Suas vendas", short: "Vendas", etapa: 7 },
      { name: "Seus clientes", short: "Clientes", etapa: 8 },
      { name: "Sua audiência", short: "Audiência", etapa: 9 },
    ],
  },
  {
    label: "EVOLUÇÃO",
    color: "#6B50CC",
    stars: [
      { name: "Seu futuro", short: "Futuro", etapa: 10 },
      { name: "Conexões", short: "Conexões", etapa: 11 },
    ],
  },
];

interface ConstelacaoVisualProps {
  etapaAtual: number;
  onStarClick?: (etapa: number, state: "done" | "current" | "future") => void;
}

export function ConstelacaoVisual({
  etapaAtual,
  onStarClick,
}: ConstelacaoVisualProps) {
  return (
    <div className="relative w-full overflow-x-auto pb-4">
      <div className="flex min-w-[900px] items-start justify-between gap-6">
        {phases.map((phase) => (
          <div key={phase.label} className="flex-1">
            {/* Phase label */}
            <div
              className="mb-8 inline-block rounded-full px-3 py-1 font-accent text-[10px] font-bold tracking-[1.5px] text-polia-creme"
              style={{ background: phase.color }}
            >
              {phase.label}
            </div>

            {/* Stars row */}
            <div className="flex items-start justify-around gap-2">
              {phase.stars.map((star) => {
                const isDone = star.etapa < etapaAtual;
                const isCurrent = star.etapa === etapaAtual;
                const isFuture = star.etapa > etapaAtual;
                const state: "done" | "current" | "future" = isDone
                  ? "done"
                  : isCurrent
                    ? "current"
                    : "future";

                const handleClick = onStarClick
                  ? () => onStarClick(star.etapa, state)
                  : undefined;

                const title = isCurrent
                  ? `Continuar na Etapa ${star.etapa}`
                  : isDone
                    ? `Etapa ${star.etapa} — concluída`
                    : `Etapa ${star.etapa} — ainda vai brilhar`;

                return (
                  <button
                    key={star.etapa}
                    type="button"
                    onClick={handleClick}
                    title={title}
                    aria-label={title}
                    className={`relative flex w-[110px] flex-col items-center bg-transparent border-0 p-0 transition-transform ${
                      handleClick
                        ? "cursor-pointer hover:-translate-y-0.5"
                        : "cursor-default"
                    }`}
                  >
                    {/* Top label slot (fixed height to align all circles) */}
                    <div className="flex h-6 items-end justify-center">
                      {isCurrent && (
                        <span className="whitespace-nowrap font-handwritten text-[17px] leading-none text-polia-terracota">
                          você tá aqui agora
                        </span>
                      )}
                    </div>

                    {/* Star slot (fixed 64px so circles share a baseline) */}
                    <div className="mt-2 flex h-16 w-16 items-center justify-center">
                      {isCurrent ? (
                        <div className="relative h-14 w-14">
                          <div
                            className="absolute inset-0 animate-ping rounded-full bg-polia-terracota opacity-30"
                            style={{ animationDuration: "2.4s" }}
                          />
                          <div
                            className="relative h-full w-full rounded-full bg-polia-terracota"
                            style={{ boxShadow: "0 0 24px rgba(232,151,112,0.7)" }}
                          />
                        </div>
                      ) : isDone ? (
                        <div
                          className="h-12 w-12 rounded-full bg-polia-dourado"
                          style={{ boxShadow: "0 0 16px rgba(200,169,110,0.5)" }}
                        />
                      ) : (
                        <div
                          className="h-10 w-10 rounded-full"
                          style={{
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(255,255,255,0.15)",
                          }}
                        />
                      )}
                    </div>

                    {/* Name */}
                    <span
                      className={`mt-3 text-center font-sans text-[12px] text-polia-creme ${
                        isFuture ? "opacity-40" : "opacity-100"
                      }`}
                    >
                      {star.short}
                    </span>

                    {/* Bottom label slot */}
                    <div className="mt-1 flex h-5 items-start justify-center">
                      {isCurrent && (
                        <span className="whitespace-nowrap font-handwritten text-[16px] leading-none text-polia-terracota">
                          acendendo agora
                        </span>
                      )}
                      {isFuture && (
                        <span className="whitespace-nowrap font-handwritten text-[16px] leading-none text-polia-creme opacity-50">
                          ainda vai brilhar
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
