import { type CSSProperties, type ReactNode } from "react";
import { Marginalia } from "./Marginalia";

interface CadernoCardProps {
  children: ReactNode;
  /** Renderiza dobrinha de orelha no canto superior direito (cards já visitados). */
  dobrada?: boolean;
  /** Texto manuscrito que aparece na margem. Use getMarginalia() pra gerar. */
  marginalia?: string | null;
  /**
   * Seed numérico pra gerar irregularidade determinística dos cantos.
   * Usa o mesmo valor sempre → mesmo card sempre tem mesma "forma".
   * Em geral: id do item, ou número da etapa.
   */
  seed?: number;
  /** Padding interno. Default 24px. */
  padding?: number | string;
  /** Background. Default branco-quase. */
  background?: string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  as?: "div" | "article" | "section";
}

/**
 * Card-folha do Caderno Vivido — marcador exclusivo nº3.
 *
 * Diferenças visuais vs Card padrão:
 * - Cantos com leve irregularidade determinística (NÃO border-radius uniforme)
 * - Sombra papel-sobre-papel em 3 camadas (mais suave que box-shadow padrão)
 * - Textura sutil de papel pautado no fundo
 * - Suporta dobrinha de orelha (cards visitados)
 * - Suporta marginalia (anotação manuscrita na margem)
 *
 * Cf. [polia-marcadores-exclusivos](.claude/memory) Marcador 3.
 */
export function CadernoCard({
  children,
  dobrada = false,
  marginalia = null,
  seed = 0,
  padding = 24,
  background = "#FDFCFA",
  className = "",
  style,
  onClick,
  as: Tag = "div",
}: CadernoCardProps) {
  // 4 raios determinísticos por seed — variação ±3px sobre base 18px
  const v = (n: number) => 16 + ((seed * 7 + n * 11) % 6);
  const borderRadius = `${v(0)}px ${v(1)}px ${v(2)}px ${v(3)}px`;

  const baseStyle: CSSProperties = {
    position: "relative",
    borderRadius,
    padding,
    background,
    border: "1px solid rgba(58, 42, 31, 0.07)",
    // sombra papel-sobre-papel — 3 camadas suaves em vez de 1 forte
    boxShadow: [
      "0 1px 1px rgba(58, 42, 31, 0.04)",
      "0 2px 6px rgba(58, 42, 31, 0.05)",
      "0 8px 16px rgba(58, 42, 31, 0.03)",
    ].join(", "),
    // textura papel pautado: linhas horizontais quase invisíveis a cada 26px
    backgroundImage: `repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 25px,
      rgba(58, 42, 31, 0.035) 25px,
      rgba(58, 42, 31, 0.035) 26px
    )`,
    cursor: onClick ? "pointer" : undefined,
    transition: "transform 180ms ease, box-shadow 180ms ease",
    ...style,
  };

  return (
    <Tag className={className} style={baseStyle} onClick={onClick}>
      {dobrada && <DobrinhaOrelha />}
      {children}
      {marginalia && <Marginalia texto={marginalia} />}
    </Tag>
  );
}

/**
 * Triângulo dobrado no canto superior direito — indica "página visitada".
 * 18x18px, mostra "verso" da página numa cor levemente mais escura.
 */
function DobrinhaOrelha() {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 22 22"
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        pointerEvents: "none",
      }}
    >
      {/* triângulo da dobra — sombra do verso */}
      <path d="M 22 0 L 22 22 L 0 0 Z" fill="rgba(58, 42, 31, 0.10)" />
      {/* triângulo da face dobrada — tom papel-verso (mais escuro que face) */}
      <path d="M 22 0 L 22 14 L 8 0 Z" fill="#EFE7DA" />
      {/* linha-vinco diagonal */}
      <path d="M 8 0 L 22 14" stroke="rgba(58, 42, 31, 0.18)" strokeWidth="0.6" fill="none" />
    </svg>
  );
}
