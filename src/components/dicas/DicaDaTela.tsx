import { Lightbulb } from "lucide-react";

import { useDicasVistas } from "@/hooks/useDicasVistas";
import { TEXTO_DICA, type ChaveDicaTela } from "@/lib/dicas";

/**
 * Faixa discreta no topo da tela, só na primeira visita. "Entendi" marca
 * como vista na conta (não volta em outro aparelho). Enquanto a lista de
 * dicas vistas carrega, não aparece, pra não piscar pra quem já viu.
 */
export function DicaDaTela({
  chave,
  className = "",
}: {
  chave: ChaveDicaTela;
  className?: string;
}) {
  const { mostrar, marcar } = useDicasVistas();
  if (!mostrar(chave)) return null;
  return (
    <div
      role="note"
      className={`flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 ${className}`}
    >
      <Lightbulb
        size={18}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-[var(--secondary-text)]"
      />
      <p className="flex-1 text-[14px] leading-relaxed text-[var(--ink-soft)]">
        {TEXTO_DICA[chave]}
      </p>
      <button
        type="button"
        onClick={() => marcar(chave)}
        className="-my-2.5 min-h-11 shrink-0 rounded-lg px-3 text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
      >
        Entendi
      </button>
    </div>
  );
}
