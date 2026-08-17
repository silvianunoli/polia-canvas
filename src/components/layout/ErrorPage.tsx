import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  Compass,
  AlertTriangle,
  Lock,
  Wrench,
  WifiOff,
  Clock,
  Link2Off,
  type LucideIcon,
} from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export type ErrorCode =
  | "404"
  | "500"
  | "403"
  | "manutencao"
  | "offline"
  | "sessao-expirada"
  | "link-expirado";

export type ErrorAction = { label: string; href: string } | { label: string; onClick: () => void };

interface CopyMap {
  title: string;
  subtitle: string;
  pageTitle: string;
  icon: LucideIcon;
  primaryAction: ErrorAction;
  secondaryAction?: ErrorAction;
}

// Textos exatos da seção 3.1 do PRD de sistema de erros. Não reescrever solto
// em outro lugar — quem precisar da mesma copy (ex: banner de sessão expirada
// no login) importa ERROR_COPY em vez de duplicar a frase.
export const ERROR_COPY: Record<ErrorCode, CopyMap> = {
  "404": {
    title: "Essa página não existe.",
    subtitle: "O endereço está errado ou a página saiu do ar.",
    pageTitle: "Página não encontrada",
    icon: Compass,
    primaryAction: { label: "Ir pro início", href: "/painel" },
    secondaryAction: { label: "Falar com a gente", href: "/ajuda#contato" },
  },
  "500": {
    title: "Algo travou do nosso lado.",
    subtitle: "Não foi nada que você fez. O erro já chegou pra gente e os seus dados estão salvos.",
    pageTitle: "Erro interno",
    icon: AlertTriangle,
    // Recarregar de verdade: antes os dois botões iam pro mesmo lugar e o
    // "tentar de novo" não tentava nada.
    primaryAction: { label: "Recarregar a página", onClick: () => window.location.reload() },
    secondaryAction: { label: "Ir pro painel", href: "/painel" },
  },
  "403": {
    title: "Essa parte é de acesso restrito.",
    subtitle: "Se acha que deveria ter, fala com a gente.",
    pageTitle: "Acesso restrito",
    icon: Lock,
    primaryAction: { label: "Ir pro painel", href: "/painel" },
    secondaryAction: { label: "Falar com a gente", href: "/ajuda#contato" },
  },
  manutencao: {
    title: "A Pólia está em manutenção agora.",
    subtitle: "Os seus números estão salvos. Recarrega daqui a alguns minutos que já volta.",
    pageTitle: "Manutenção",
    icon: Wrench,
    primaryAction: { label: "Tentar de novo", href: "/painel" },
  },
  offline: {
    title: "Sem conexão com a internet agora.",
    subtitle: "Assim que a conexão voltar, tudo continua de onde parou.",
    pageTitle: "Sem conexão",
    icon: WifiOff,
    primaryAction: { label: "Tentar de novo", href: "/painel" },
  },
  "sessao-expirada": {
    title: "Sua sessão expirou.",
    subtitle:
      "Por segurança, a gente encerrou o acesso. Entra de novo pra continuar de onde parou.",
    pageTitle: "Sessão expirada",
    icon: Clock,
    primaryAction: { label: "Entrar", href: "/auth/login" },
  },
  "link-expirado": {
    title: "Esse link expirou.",
    subtitle: "Pede um link novo que a gente manda na hora.",
    pageTitle: "Link expirado",
    icon: Link2Off,
    primaryAction: { label: "Enviar novo link", href: "/auth/esqueci-senha" },
  },
};

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
  const className =
    variant === "primary"
      ? "rounded-lg bg-[var(--secondary)] px-8 py-4 text-[16px] font-semibold text-[var(--secondary-ink)] no-underline transition-[filter] hover:brightness-95"
      : "rounded-lg border border-[var(--ink)] px-8 py-4 text-[16px] font-semibold text-[var(--ink)] no-underline transition-colors hover:bg-[var(--ink)] hover:text-white";

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
