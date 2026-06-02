import { type CSSProperties } from "react";

interface MarginaliaProps {
  texto: string;
  /**
   * Posição relativa ao container pai (precisa ser position: relative).
   * Default: canto inferior direito, leve overflow pra fora pra parecer "anotado depois".
   */
  posicao?: "bottom-right" | "bottom-left" | "top-right" | "side-right";
  /** Rotação em graus. Default -2 (papel cai natural). */
  rotacao?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Anotação manuscrita que vive na margem de um CadernoCard.
 * Marcador exclusivo nº3 — só renderiza quando há contexto de retorno
 * (use junto com [getMarginalia()](src/lib/marginaliaText.ts)).
 *
 * Voz Aimer: coloquial, curto. Ex: "voltei aqui 3x esse mês", "última vez: terça".
 */
export function Marginalia({
  texto,
  posicao = "bottom-right",
  rotacao = -2,
  className = "",
  style,
}: MarginaliaProps) {
  const posicaoStyle: CSSProperties =
    posicao === "bottom-right"
      ? { bottom: -6, right: 12 }
      : posicao === "bottom-left"
        ? { bottom: -6, left: 12 }
        : posicao === "top-right"
          ? { top: -10, right: 16 }
          : { top: "50%", right: -8, transform: `translateY(-50%) rotate(${rotacao}deg)` };

  const baseStyle: CSSProperties = {
    position: "absolute",
    fontFamily: "Caveat, cursive",
    fontSize: 15,
    color: "rgba(58, 42, 31, 0.55)",
    lineHeight: 1,
    whiteSpace: "nowrap",
    pointerEvents: "none",
    userSelect: "none",
    transform: posicao === "side-right" ? undefined : `rotate(${rotacao}deg)`,
    ...posicaoStyle,
    ...style,
  };

  return (
    <span aria-hidden="true" className={className} style={baseStyle}>
      {texto}
    </span>
  );
}
