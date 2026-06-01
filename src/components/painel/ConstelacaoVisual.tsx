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
    <div className="relative w-full overflow-hidden pb-2">
      <div className="grid w-full grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4">
        {phases.map((phase) => (
          <div key={phase.label} className="min-w-0">
            {/* Phase label */}
            <div
              className="mb-6 inline-block rounded-full px-3 py-1 font-accent text-[10px] font-bold tracking-[1.5px] text-polia-creme"
              style={{ background: phase.color }}
            >
              {phase.label}
            </div>

            {/* Stars row */}
            <div
              className={`grid items-start gap-x-2 gap-y-5 ${
                phase.stars.length === 2 ? "grid-cols-2" : "grid-cols-3"
              }`}
            >
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
                  ? () => {
                      if (isFuture) return;
                      onStarClick(star.etapa, state);
                    }
                  : undefined;


                const title = isCurrent
                  ? `Continuar na Etapa ${star.etapa}`
                  : isDone
                    ? `Etapa ${star.etapa} — concluída`
                    : `Etapa ${star.etapa} — no seu horizonte`;

                const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
                  if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
                  e.preventDefault();
                  const total = 11;
                  let target = star.etapa;
                  if (e.key === "ArrowRight" || e.key === "ArrowDown") target = star.etapa === total ? 1 : star.etapa + 1;
                  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") target = star.etapa === 1 ? total : star.etapa - 1;
                  else if (e.key === "Home") target = 1;
                  else if (e.key === "End") target = total;
                  const next = document.querySelector<HTMLButtonElement>(`[data-constelacao-star="${target}"]`);
                  next?.focus();
                };
                return (
                  <button
                    key={star.etapa}
                    type="button"
                    onClick={handleClick}
                    onKeyDown={handleKeyDown}
                    data-constelacao-star={star.etapa}
                    title={title}
                    aria-label={title}
                    aria-disabled={isFuture ? true : undefined}
                    disabled={isFuture && !handleClick}
                    className={`relative flex min-w-0 flex-col items-center border-0 bg-transparent p-0 min-h-[44px] min-w-[44px] transition-transform ${
                      handleClick && !isFuture
                        ? "cursor-pointer hover:-translate-y-0.5"
                        : "cursor-default"
                    }`}
                  >


                    {/* Top label slot (fixed height to align all circles) */}
                    <div className="flex h-10 items-end justify-center">
                      {isCurrent && (
                        <span className="max-w-[88px] text-center caveat-decorativo leading-[0.95] text-polia-terracota md:max-w-none md:whitespace-nowrap">
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
                      className={`mt-3 text-center font-sans text-[12px] font-semibold leading-tight text-polia-creme ${
                        isFuture ? "opacity-40" : "opacity-100"
                      }`}
                    >
                      {star.short}
                    </span>

                    {/* Bottom label slot */}
                    <div className="mt-1 flex min-h-6 items-start justify-center">
                      {isCurrent && (
                        <span className="text-center caveat-decorativo leading-none text-polia-terracota">
                          abrindo agora
                        </span>
                      )}
                      {isFuture && (
                        <span className="text-center caveat-decorativo leading-none text-polia-creme">
                          no seu horizonte
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
