interface Marco {
  name: string;
  short: string;
  etapa: number;
}

interface Phase {
  label: string;
  color: string;
  marcos: Marco[];
}

const phases: Phase[] = [
  {
    label: "SONHO",
    color: "#C9407A",
    marcos: [
      { name: "Descoberta", short: "Descoberta", etapa: 1 },
      { name: "Identidade", short: "Identidade", etapa: 2 },
      { name: "Modelo", short: "Modelo", etapa: 3 },
    ],
  },
  {
    label: "CONSTRUÇÃO",
    color: "#1A7FAD",
    marcos: [
      { name: "Presença", short: "Presença", etapa: 4 },
      { name: "Conteúdo", short: "Conteúdo", etapa: 5 },
      { name: "Gestão", short: "Gestão", etapa: 6 },
    ],
  },
  {
    label: "VENDA",
    color: "#1A8F5C",
    marcos: [
      { name: "Suas vendas", short: "Vendas", etapa: 7 },
      { name: "Seus clientes", short: "Clientes", etapa: 8 },
      { name: "Sua audiência", short: "Audiência", etapa: 9 },
    ],
  },
  {
    label: "EVOLUÇÃO",
    color: "#6B50CC",
    marcos: [
      { name: "Seu futuro", short: "Futuro", etapa: 10 },
      { name: "Conexões", short: "Conexões", etapa: 11 },
    ],
  },
];

interface TrilhaMarcosProps {
  etapaAtual: number;
  onMarcoClick?: (etapa: number, state: "done" | "current" | "future") => void;
}

const COR_MARRO = "#3A2A1F";
const COR_TERRACOTA = "#C96B3E";
const COR_CINZA_AREIA = "#C9BFB2";
const COR_CREME = "#FDF8F5";

export function TrilhaMarcos({ etapaAtual, onMarcoClick }: TrilhaMarcosProps) {
  return (
    <div className="relative w-full overflow-hidden pb-2">
      <div className="grid w-full grid-cols-1 gap-10 sm:grid-cols-2 xl:grid-cols-4">
        {phases.map((phase) => (
          <div key={phase.label} className="relative min-w-0">
            {/* Phase label */}
            <div
              className="mb-6 inline-block rounded-full px-3 py-1 font-accent text-[10px] font-bold tracking-[1.5px] text-polia-creme"
              style={{ background: phase.color }}
            >
              {phase.label}
            </div>

            {/* Marcos com linha tracejada conectando */}
            <div
              className={`relative grid items-start gap-x-2 gap-y-5 ${
                phase.marcos.length === 2 ? "grid-cols-2" : "grid-cols-3"
              }`}
            >
              {/* Trilha tracejada de fundo */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-0 right-0"
                style={{
                  top: 56,
                  borderTop: `1.5px dashed ${COR_TERRACOTA}40`,
                }}
              />

              {phase.marcos.map((marco) => {
                const isDone = marco.etapa < etapaAtual;
                const isCurrent = marco.etapa === etapaAtual;
                const isFuture = marco.etapa > etapaAtual;
                const state: "done" | "current" | "future" = isDone
                  ? "done"
                  : isCurrent
                    ? "current"
                    : "future";

                const handleClick = onMarcoClick
                  ? () => {
                      if (isFuture) return;
                      onMarcoClick(marco.etapa, state);
                    }
                  : undefined;

                const title = isCurrent
                  ? `Continuar na Etapa ${marco.etapa}`
                  : isDone
                    ? `Etapa ${marco.etapa} — concluída`
                    : `Etapa ${marco.etapa} — no seu horizonte`;

                const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
                  if (
                    !["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"].includes(
                      e.key,
                    )
                  )
                    return;
                  e.preventDefault();
                  const total = 11;
                  let target = marco.etapa;
                  if (e.key === "ArrowRight" || e.key === "ArrowDown")
                    target = marco.etapa === total ? 1 : marco.etapa + 1;
                  else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
                    target = marco.etapa === 1 ? total : marco.etapa - 1;
                  else if (e.key === "Home") target = 1;
                  else if (e.key === "End") target = total;
                  const next = document.querySelector<HTMLButtonElement>(
                    `[data-mapa-marco="${target}"]`,
                  );
                  next?.focus();
                };

                return (
                  <button
                    key={marco.etapa}
                    type="button"
                    onClick={handleClick}
                    onKeyDown={handleKeyDown}
                    data-mapa-marco={marco.etapa}
                    title={title}
                    aria-label={title}
                    aria-disabled={isFuture ? true : undefined}
                    disabled={isFuture && !handleClick}
                    className={`relative z-10 flex min-w-0 flex-col items-center border-0 bg-transparent p-0 min-h-[44px] min-w-[44px] transition-transform ${
                      handleClick && !isFuture
                        ? "cursor-pointer hover:-translate-y-0.5"
                        : "cursor-default"
                    }`}
                  >
                    {/* Top label slot (fixed height to align all circles) */}
                    <div className="flex h-10 items-end justify-center">
                      {isCurrent && (
                        <span
                          className="max-w-[88px] text-center caveat-decorativo leading-[0.95] md:max-w-none md:whitespace-nowrap"
                          style={{ color: COR_TERRACOTA }}
                        >
                          você tá aqui agora
                        </span>
                      )}
                    </div>

                    {/* Marco — círculo numerado (56px), três estados */}
                    <div className="mt-2 flex h-16 w-16 items-center justify-center">
                      {isCurrent ? (
                        <div className="relative h-14 w-14">
                          {/* Anel pulsante respiração */}
                          <div
                            className="absolute -inset-2 rounded-full"
                            style={{
                              border: `2px solid ${COR_TERRACOTA}40`,
                              animation: "polia-respiracao 3s ease-in-out infinite",
                            }}
                          />
                          {/* Marco em curso: outline tracejado terracota, fundo creme */}
                          <div
                            className="relative flex h-full w-full items-center justify-center rounded-full"
                            style={{
                              background: COR_CREME,
                              border: `2px dashed ${COR_TERRACOTA}`,
                            }}
                          >
                            <span
                              className="font-serif text-[20px] font-medium"
                              style={{ color: COR_TERRACOTA }}
                            >
                              {marco.etapa}
                            </span>
                          </div>
                        </div>
                      ) : isDone ? (
                        <div className="relative h-12 w-12">
                          {/* Marco concluído: círculo preenchido marrom */}
                          <div
                            className="flex h-full w-full items-center justify-center rounded-full"
                            style={{ background: COR_MARRO }}
                          >
                            <span
                              className="font-serif text-[18px] font-medium"
                              style={{ color: COR_CREME }}
                            >
                              {marco.etapa}
                            </span>
                          </div>
                          {/* Check terracota no canto */}
                          <div
                            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full"
                            style={{ background: COR_TERRACOTA }}
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path
                                d="M2 5L4 7L8 3"
                                stroke={COR_CREME}
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-full"
                          style={{
                            background: "transparent",
                            border: `1.5px solid ${COR_CINZA_AREIA}`,
                          }}
                        >
                          <span
                            className="font-serif text-[15px]"
                            style={{ color: COR_CINZA_AREIA }}
                          >
                            {marco.etapa}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Nome do marco */}
                    <span
                      className={`mt-3 text-center font-sans text-[12px] font-semibold leading-tight ${
                        isFuture ? "opacity-50" : "opacity-100"
                      }`}
                      style={{ color: COR_MARRO }}
                    >
                      {marco.short}
                    </span>

                    {/* Bottom label slot */}
                    <div className="mt-1 flex min-h-6 items-start justify-center">
                      {isCurrent && (
                        <span
                          className="text-center caveat-decorativo leading-none"
                          style={{ color: COR_TERRACOTA }}
                        >
                          abrindo agora
                        </span>
                      )}
                      {isFuture && (
                        <span
                          className="text-center caveat-decorativo leading-none"
                          style={{ color: COR_CINZA_AREIA }}
                        >
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
