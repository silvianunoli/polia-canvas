import { RotateCw } from "lucide-react";

interface BlockErrorProps {
  message?: string;
  onRetry: () => void;
}

/** Cartão discreto pra quando só um bloco/lista falhou — o resto da tela continua útil. */
export function BlockError({ message = "Não deu pra carregar isto.", onRetry }: BlockErrorProps) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white p-6 text-center">
      <p className="text-[14px] text-[var(--ink-soft)]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--ink)] hover:text-white"
      >
        <RotateCw size={14} aria-hidden="true" />
        Recarregar
      </button>
    </div>
  );
}
