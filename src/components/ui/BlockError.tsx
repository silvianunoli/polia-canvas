import { RotateCw } from "lucide-react";

import { BTN_MIUDO } from "@/lib/botoes";

interface BlockErrorProps {
  message?: string;
  onRetry: () => void;
}

/** Cartão discreto pra quando só um bloco/lista falhou — o resto da tela continua útil. */
export function BlockError({
  message = "A Pólia One não conseguiu carregar essa parte. O resto da tela continua funcionando.",
  onRetry,
}: BlockErrorProps) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white p-6 text-center">
      <p className="text-[14px] text-[var(--ink-soft)]">{message}</p>
      <button type="button" onClick={onRetry} className={`${BTN_MIUDO} mt-3`}>
        <RotateCw size={14} aria-hidden="true" />
        Recarregar
      </button>
    </div>
  );
}
