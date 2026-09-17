import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { BTN_PRIMARIO, BTN_CONTORNO } from "@/lib/botoes";
import { ERROR_COPY, type ErrorCode } from "@/lib/errorCopy";

export type { ErrorCode };
export type ErrorAction = { label: string; href: string } | { label: string; onClick: () => void };

export interface ErrorPageProps {
  code: ErrorCode;
  title?: string;
  subtitle?: string;
  /** ID curto pra usuária citar no suporte — só aparece quando fornecido (tipicamente em 500). */
  errorId?: string;
  primaryAction?: ErrorAction;
  secondaryAction?: ErrorAction;
}

function ActionButton({
  action,
  variant,
}: {
  action: ErrorAction;
  variant: "primary" | "secondary";
}) {
  const className = variant === "primary" ? BTN_PRIMARIO : BTN_CONTORNO;

  if ("href" in action) {
    return (
      <Link to={action.href} className={className}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}

export function ErrorPage({
  code,
  title,
  subtitle,
  errorId,
  primaryAction,
  secondaryAction,
}: ErrorPageProps) {
  const copy = ERROR_COPY[code];
  const Icon = copy.icon;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useDocumentTitle(copy.pageTitle);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const primary = primaryAction ?? copy.primaryAction;
  const secondary = secondaryAction ?? copy.secondaryAction;

  return (
    <div className="polia-v3 flex min-h-screen items-center justify-center bg-white px-6 py-16 text-center">
      <div className="max-w-[440px]">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--secondary-light)]">
          <Icon size={28} className="text-[var(--secondary-ink)]" aria-hidden="true" />
        </div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-cabinet text-[32px] leading-[1.15] text-[var(--ink)] outline-none md:text-[40px]"
        >
          {title ?? copy.title}
        </h1>
        <p className="mt-4 text-[17px] leading-[1.5] text-[var(--ink-soft)]">
          {subtitle ?? copy.subtitle}
        </p>
        {errorId && <p className="mt-3 text-[12px] text-[var(--muted)]">Código: {errorId}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ActionButton action={primary} variant="primary" />
          {secondary && <ActionButton action={secondary} variant="secondary" />}
        </div>
      </div>
    </div>
  );
}
