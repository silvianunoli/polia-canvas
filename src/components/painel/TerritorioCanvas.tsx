/**
 * Fundo creme com textura sutil de papel + curvas de nível decorativas.
 * Substituto territorial do CosmicBackground (que era noite estrelado).
 * Usado em telas rituais (Conclusao das etapas).
 */
export function TerritorioCanvas() {
  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden bg-polia-papel-creme"
      aria-hidden="true"
    >
      {/* Textura de papel — pontos minúsculos marrom */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(58,42,31,0.06) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Curvas de nível topográficas — bordas e cantos */}
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        style={{ opacity: 0.05 }}
      >
        <defs>
          <pattern id="polia-topografia" x="0" y="0" width="240" height="240" patternUnits="userSpaceOnUse">
            <path
              d="M0 60 Q60 40 120 60 T240 60"
              fill="none"
              stroke="#3A2A1F"
              strokeWidth="0.8"
            />
            <path
              d="M0 120 Q60 100 120 120 T240 120"
              fill="none"
              stroke="#3A2A1F"
              strokeWidth="0.8"
            />
            <path
              d="M0 180 Q60 160 120 180 T240 180"
              fill="none"
              stroke="#3A2A1F"
              strokeWidth="0.8"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#polia-topografia)" />
      </svg>

      {/* Rosa-dos-ventos decorativa — canto superior direito */}
      <svg
        className="absolute opacity-20"
        width="80"
        height="80"
        viewBox="0 0 80 80"
        style={{ top: 24, right: 24 }}
        aria-hidden="true"
      >
        <circle cx="40" cy="40" r="36" fill="none" stroke="#C96B3E" strokeWidth="0.6" />
        <circle cx="40" cy="40" r="24" fill="none" stroke="#C96B3E" strokeWidth="0.4" />
        {/* 8 pontas */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <line
            key={deg}
            x1="40"
            y1="40"
            x2="40"
            y2="8"
            stroke="#C96B3E"
            strokeWidth="0.8"
            transform={`rotate(${deg} 40 40)`}
          />
        ))}
        {/* N */}
        <text x="40" y="6" textAnchor="middle" fontSize="8" fill="#C96B3E" fontFamily="serif">
          N
        </text>
      </svg>
    </div>
  );
}
