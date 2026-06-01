interface SeloCarimboProps {
  numero: number;
  palavraMarco: string;
}

const TERRACOTA = "#C96B3E";

const ROMANOS: Record<number, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
  6: "VI",
  7: "VII",
  8: "VIII",
  9: "IX",
  10: "X",
  11: "XI",
};

/**
 * Selo de carimbo cartográfico — estampa circular estilo carimbo real,
 * com contorno duplo, numeral romano, e rotação determinística.
 * Substitui visualmente a "estrela acendendo" das telas de Conclusao.
 */
export function SeloCarimbo({ numero, palavraMarco }: SeloCarimboProps) {
  const numeroRomano = ROMANOS[numero] ?? String(numero);
  // Rotação determinística por número (-6° a +6°) — sem Math.random pra evitar SSR mismatch
  const rotacao = ((numero * 7) % 13) - 6;

  return (
    <div
      className="relative"
      style={{
        width: 200,
        height: 200,
        animation: "polia-carimbo 0.6s ease-out",
        transform: `rotate(${rotacao}deg)`,
      }}
      aria-label={`Marco ${numero} conquistado`}
    >
      {/* Contorno externo sólido */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: `2.5px solid ${TERRACOTA}`,
          opacity: 0.92,
        }}
      />
      {/* Contorno interno tracejado */}
      <div
        className="absolute rounded-full"
        style={{
          top: 10,
          left: 10,
          right: 10,
          bottom: 10,
          border: `1px dashed ${TERRACOTA}`,
          opacity: 0.6,
        }}
      />

      {/* Texto topo: MARCO · NOME */}
      <div
        className="absolute left-0 right-0 text-center font-accent font-bold uppercase"
        style={{
          top: 22,
          color: TERRACOTA,
          fontSize: 9,
          letterSpacing: "2.5px",
        }}
      >
        MARCO · {palavraMarco}
      </div>

      {/* Numeral romano centralizado */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-serif"
          style={{
            fontSize: 64,
            color: TERRACOTA,
            fontWeight: 500,
            letterSpacing: "0.03em",
            lineHeight: 1,
          }}
        >
          {numeroRomano}
        </span>
      </div>

      {/* Texto bottom: CONQUISTADO */}
      <div
        className="absolute left-0 right-0 text-center font-accent font-bold uppercase"
        style={{
          bottom: 22,
          color: TERRACOTA,
          fontSize: 8,
          letterSpacing: "2px",
          opacity: 0.85,
        }}
      >
        CONQUISTADO
      </div>
    </div>
  );
}
