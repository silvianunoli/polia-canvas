import type { ReactNode } from "react";

/**
 * Peças de layout compartilhadas pelas páginas públicas. Moram aqui pra home e
 * páginas internas não divergirem em container, ritmo de seção e botão.
 */

export const CONTAINER = "mx-auto w-full max-w-[1200px] px-[clamp(20px,4vw,48px)]";
export const SECAO = "py-[clamp(72px,9vw,128px)]";

// A forma do botão mora em `lib/botoes.ts`, compartilhada com a área logada —
// era aqui que ela vivia, e por isso o app inteiro divergiu dela. Re-exportado
// pra não quebrar quem já importa de Editorial.
export { BTN_PRIMARIO, BTN_CONTORNO } from "@/lib/botoes";

/** Rótulo de seção: traço turquesa curto + texto em caixa alta. */
export function Eyebrow({ children, claro = false }: { children: ReactNode; claro?: boolean }) {
  return (
    <p
      className={`font-accent flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] ${
        claro ? "text-[var(--secondary)]" : "text-[var(--ink-soft)]"
      }`}
    >
      <span aria-hidden="true" className="h-[3px] w-5 flex-none rounded-sm bg-[var(--secondary)]" />
      {children}
    </p>
  );
}

/** Frase de virada, em caixa colorida. Usada pra quebrar blocos longos de leitura. */
export function Pullquote({
  children,
  tom = "turquesa",
}: {
  children: ReactNode;
  tom?: "turquesa" | "pessego";
}) {
  return (
    <p
      className={`rounded-2xl p-8 text-[clamp(1.6rem,3vw,2.4rem)] font-bold leading-[1.15] tracking-[-0.02em] text-balance md:p-12 ${
        tom === "turquesa"
          ? "bg-[var(--secondary)] text-[var(--secondary-ink)]"
          : "bg-[var(--surface-pink)] text-[var(--ink)]"
      }`}
    >
      {children}
    </p>
  );
}
