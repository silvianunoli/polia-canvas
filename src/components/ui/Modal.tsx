import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { TOKEN_BRIDGE_V3 } from "@/lib/uiTokenBridge";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Vira o Dialog.Title — o Radix liga em aria-labelledby automaticamente. */
  title: string;
  /** Vira o Dialog.Description — o Radix liga em aria-describedby automaticamente. */
  description?: string;
  children?: ReactNode;
  /** Área de botões no rodapé (ex: BTN_ACAO_CONTORNO + BTN_ACAO de src/lib/botoes.ts). */
  footer?: ReactNode;
}

/**
 * Wrapper sobre o Dialog do Radix — pra parar de reescrever modal artesanal
 * (auditoria de set/2026 encontrou 6 duplicados, ex: ModalLancamento.tsx com
 * framer-motion + listener de Escape na mão, sem aria-labelledby). Foco preso
 * e devolvido ao gatilho, fechar com Esc e trava de scroll do body já vêm de
 * graça do Radix — nada disso é reimplementado aqui.
 */
export function Modal({ open, onOpenChange, title, description, children, footer }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="polia-v3 fixed inset-0 z-50 bg-[var(--ink)]/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:duration-[250ms] data-[state=closed]:duration-[150ms]" />
        <Dialog.Content
          className="polia-v3 fixed left-1/2 top-1/2 z-50 max-h-[85dvh] w-[calc(100vw-32px)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[var(--line)] bg-white p-6 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=open]:duration-[250ms] data-[state=closed]:duration-[150ms]"
          style={TOKEN_BRIDGE_V3}
        >
          <Dialog.Close
            type="button"
            aria-label="Fechar"
            className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--surface)] hover:text-[var(--ink)]"
          >
            <X size={18} aria-hidden="true" />
          </Dialog.Close>

          <Dialog.Title className="font-cabinet pr-8 text-[19px] leading-[1.25] text-[var(--ink)]">
            {title}
          </Dialog.Title>
          {description && (
            <Dialog.Description className="mt-1.5 text-[14px] leading-[1.5] text-[var(--ink-soft)]">
              {description}
            </Dialog.Description>
          )}

          {children && <div className="mt-4">{children}</div>}

          {footer && (
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
