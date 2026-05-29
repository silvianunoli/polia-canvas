import type { ReactNode } from "react";

/**
 * Sigla com tooltip nativo (title) — usa <abbr> pra acessibilidade.
 * Ex.: <Sigla termo="CTA">Call to Action — botão de ação</Sigla>
 */
export function Sigla({ termo, children }: { termo: string; children: ReactNode }) {
  return (
    <abbr
      title={typeof children === "string" ? children : undefined}
      className="cursor-help no-underline decoration-dotted decoration-from-font underline-offset-2 hover:underline"
    >
      {termo}
    </abbr>
  );
}
