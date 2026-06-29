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
 * Selo de carimbo cartográfico — estampa circular estilo carimbo real.
 * Texto curvado seguindo a circunferência (SVG textPath), numeral romano centralizado,
 * rotação determinística leve.
 */
export function SeloCarimbo({ numero, palavraMarco }: SeloCarimboProps) {
  const numeroRomano = ROMANOS[numero] ?? String(numero);
  const rotacao = ((numero * 7) % 13) - 6; // -6 a +6, determinístico
  const idTopo = `polia-selo-topo-${numero}`;
  const idBase = `polia-selo-base-${numero}`;

  return (
    <div
      className="relative"
      style={{
        width: 220,
        height: 220,
        animation: "polia-carimbo 0.6s ease-out",
        transform: `rotate(${rotacao}deg)`,
      }}
      aria-label={`Marco ${numero} (${palavraMarco}) conquistado`}
    >
      <svg width="220" height="220" viewBox="0 0 220 220" aria-hidden="true">
        <defs>
          {/* Caminho do texto no topo: arco superior do círculo */}
          <path id={idTopo} d="M 30,110 A 80,80 0 0 1 190,110" fill="none" />
          {/* Caminho do texto na base: arco inferior do círculo */}
          <path id={idBase} d="M 30,110 A 80,80 0 0 0 190,110" fill="none" />
        </defs>

        {/* Contorno externo sólido */}
        <circle
          cx="110"
          cy="110"
          r="98"
          fill="none"
          stroke={TERRACOTA}
          strokeWidth="2.5"
          opacity="0.92"
        />
        {/* Contorno interno tracejado */}
        <circle
          cx="110"
          cy="110"
          r="88"
          fill="none"
          stroke={TERRACOTA}
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.6"
        />

        {/* Texto curvado no topo */}
        <text
          fontSize="10"
          fontWeight="700"
          letterSpacing="3"
          fill={TERRACOTA}
          fontFamily="system-ui, sans-serif"
        >
          <textPath href={`#${idTopo}`} startOffset="50%" textAnchor="middle">
            MARCO · {palavraMarco}
          </textPath>
        </text>

        {/* Numeral romano centralizado */}
        <text
          x="110"
          y="128"
          textAnchor="middle"
          fontSize="68"
          fontWeight="500"
          fill={TERRACOTA}
          fontFamily="'DM Serif Display', Georgia, serif"
        >
          {numeroRomano}
        </text>

        {/* Texto curvado na base */}
        <text
          fontSize="9"
          fontWeight="700"
          letterSpacing="2.5"
          fill={TERRACOTA}
          fontFamily="system-ui, sans-serif"
          opacity="0.85"
        >
          <textPath href={`#${idBase}`} startOffset="50%" textAnchor="middle">
            CONQUISTADO
          </textPath>
        </text>
      </svg>
    </div>
  );
}
