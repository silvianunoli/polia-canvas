import { useEffect, useState, type ReactNode } from "react";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";

export function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

interface AuthShellProps {
  children: ReactNode;
  maxWidth?: number;
}

/**
 * Auth é a porta, não o show: card compacto, sem reveal de scroll, sem
 * ilustração. A única camada de movimento é a entrada suave do card ao trocar
 * de tela (fade + translateY curto), respeitando prefers-reduced-motion.
 */
export function AuthShell({ children, maxWidth = 420 }: AuthShellProps) {
  const reduce = usePrefersReducedMotion();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);

  return (
    <div className="polia-v3 flex min-h-screen w-full flex-col items-center justify-center bg-[var(--bg)] px-5 py-6">
      <div className="w-full" style={{ maxWidth }}>
        <div
          className="rounded-2xl bg-white px-5 py-6 sm:px-8 sm:py-7"
          style={
            reduce
              ? undefined
              : {
                  opacity: shown ? 1 : 0,
                  transform: shown ? "none" : "translateY(10px)",
                  transition: "opacity 220ms cubic-bezier(0.22,1,0.36,1), transform 220ms cubic-bezier(0.22,1,0.36,1)",
                }
          }
        >
          <div className="mb-3 flex justify-center text-[var(--ink)]">
            <PoliaWordmark className="h-[22px] w-auto" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function CaveatEyebrow({ children }: { children: ReactNode; size?: number }) {
  return <p className="mb-2 text-center text-[15px] italic text-[var(--ink-soft)]">{children}</p>;
}

export function SerifHeadline({ children, size = 40 }: { children: ReactNode; size?: number }) {
  return (
    <h1
      className="text-center font-cabinet leading-[1.1] text-[var(--ink)]"
      style={{ fontSize: `clamp(${Math.round(size * 0.65)}px, 6vw, ${size}px)` }}
    >
      {children}
    </h1>
  );
}

export function SubText({ children }: { children: ReactNode }) {
  return (
    <p className="text-center text-[15px] leading-relaxed text-[var(--ink-soft)]">{children}</p>
  );
}

export function Divider({ label = "ou" }: { label?: string }) {
  return (
    <div className="my-4 flex items-center gap-3" aria-hidden="true">
      <div className="h-px flex-1 bg-[var(--line)]" />
      <span className="text-[13px] text-[var(--muted)]">{label}</span>
      <div className="h-px flex-1 bg-[var(--line)]" />
    </div>
  );
}

/**
 * Botão primário das telas de auth (v3). Não reaproveita o PoliaButton porque
 * ele é compartilhado com a landing — aqui o estilo é o turquesa do v3.
 * Radius 8px (DESIGN-3 proíbe pill em elemento de conteúdo). `loading` mostra
 * spinner de 14px, some se prefers-reduced-motion (o texto já muda pro
 * chamador, então nunca fica um botão mudo durante a espera).
 */
export function AuthButton({
  children,
  fullWidth,
  disabled,
  loading,
  type = "button",
  onClick,
}: {
  children: ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  const reduce = usePrefersReducedMotion();
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex h-[48px] items-center justify-center gap-2 rounded-lg bg-[var(--secondary)] px-6 font-medium text-[var(--secondary-ink)] transition-[transform,opacity] duration-180 hover:-translate-y-px hover:opacity-90 disabled:opacity-60 disabled:hover:translate-y-0 ${
        fullWidth ? "w-full" : ""
      }`}
    >
      {loading && !reduce && (
        <span
          aria-hidden="true"
          className="h-[14px] w-[14px] shrink-0 animate-spin rounded-full border-2 border-[var(--secondary-ink)] border-r-transparent"
        />
      )}
      {children}
    </button>
  );
}
