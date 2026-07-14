import type { SVGProps } from "react";

type LogoProps = Omit<SVGProps<SVGSVGElement>, "viewBox" | "role">;

/**
 * Wordmark completa (símbolo + trilha de 3 pontos + palavra Pólia).
 * O traço principal herda a cor do texto via `currentColor` — quem usa
 * define a cor com `text-[var(--ink)]` (fundo claro) ou `text-[var(--bg)]`
 * (fundo escuro). Os 3 pontos da trilha usam sempre os tokens de acento
 * (--secondary/--accent/--highlight), fixos independente do fundo.
 * Precisa estar dentro do escopo `.polia-v3` pra esses tokens resolverem.
 */
export function PoliaWordmark({ className, ...props }: LogoProps) {
  return (
    <svg
      viewBox="0 -70 569 220"
      role="img"
      aria-label="Pólia"
      fill="currentColor"
      className={className}
      {...props}
    >
      <g>
        <rect x="0" y="0" width="26" height="140" rx="13" />
        <circle cx="58" cy="50" r="37" fill="none" stroke="currentColor" strokeWidth="26" />
      </g>
      <g transform="translate(122,0)">
        <circle cx="50" cy="50" r="37" fill="none" stroke="currentColor" strokeWidth="26" />
        <rect
          x="51"
          y="-37"
          width="10"
          height="28"
          rx="5"
          fill="var(--highlight)"
          transform="rotate(24 56 -23)"
        />
      </g>
      <g transform="translate(236,0)">
        <rect x="0" y="-40" width="26" height="140" rx="13" />
      </g>
      <g transform="translate(276,0)">
        <rect x="0" y="0" width="26" height="100" rx="13" />
        <circle cx="13" cy="-25" r="15" />
      </g>
      <g transform="translate(316,0)">
        <circle cx="50" cy="50" r="37" fill="none" stroke="currentColor" strokeWidth="26" />
        <rect x="76" y="0" width="26" height="100" rx="13" />
      </g>
      <circle cx="450" cy="104" r="8" fill="var(--secondary)" />
      <circle cx="490" cy="109" r="10" fill="var(--accent)" />
      <circle cx="540" cy="114" r="14" fill="var(--highlight)" />
    </svg>
  );
}

/**
 * Símbolo isolado (sem a palavra), pra espaços pequenos: sidebar colapsada,
 * avatar, favicon. Mesma regra de cor da wordmark.
 */
export function PoliaIcon({ className, ...props }: LogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label="Pólia"
      fill="currentColor"
      className={className}
      {...props}
    >
      <rect x="26" y="18" width="15" height="64" rx="7.5" />
      <circle cx="54" cy="34" r="16" fill="none" stroke="currentColor" strokeWidth="9" />
      <circle cx="60" cy="84" r="4" fill="var(--secondary)" />
      <circle cx="72" cy="86" r="5" fill="var(--accent)" />
      <circle cx="86" cy="88" r="7" fill="var(--highlight)" />
    </svg>
  );
}
