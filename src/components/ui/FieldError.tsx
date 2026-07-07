import type { ReactNode } from "react";

interface FieldErrorProps {
  id: string;
  children?: ReactNode;
  /** Reserva a altura da linha mesmo sem erro, pra layout não pular. */
  reserveSpace?: boolean;
}

/** Mensagem de erro de campo — sempre ligada ao input via aria-describedby={id}. */
export function FieldError({ id, children, reserveSpace }: FieldErrorProps) {
  if (!children && !reserveSpace) return null;
  return (
    <p id={id} className="mt-1.5 min-h-[18px] text-[12.5px] text-[var(--danger)]">
      {children}
    </p>
  );
}
