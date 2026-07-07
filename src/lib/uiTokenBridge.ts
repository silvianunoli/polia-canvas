import type { CSSProperties } from "react";

// Bridge de tokens pra componentes shadcn (Popover/Select/AlertDialog) que são
// portalados pro document.body — saem da árvore .polia-v3 e perdem os tokens por
// herança de CSS. Reaplique a classe .polia-v3 no Content portalado + este style,
// que remapeia --primary/--accent (usados internamente pelos componentes shadcn)
// pros equivalentes do vocabulário v3.
export const TOKEN_BRIDGE_V3 = {
  ["--primary" as string]: "var(--secondary)",
  ["--primary-foreground" as string]: "var(--secondary-ink)",
  ["--accent" as string]: "var(--surface)",
  ["--accent-foreground" as string]: "var(--ink)",
  ["--background" as string]: "#ffffff",
  ["--popover" as string]: "#ffffff",
  ["--popover-foreground" as string]: "var(--ink)",
  ["--border" as string]: "var(--line)",
  ["--input" as string]: "var(--line)",
  ["--ring" as string]: "var(--secondary)",
  ["--muted-foreground" as string]: "var(--muted)",
} as CSSProperties;
