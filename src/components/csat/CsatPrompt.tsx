import { useState } from "react";
import { Frown, Meh, Smile, X } from "lucide-react";
import { toastSucesso } from "@/lib/toast";
import type { CsatScore } from "@/lib/csat";

const OPCOES: { score: CsatScore; label: string; Icon: typeof Frown }[] = [
  { score: 1, label: "Difícil", Icon: Frown },
  { score: 2, label: "Ok", Icon: Meh },
  { score: 3, label: "Boa", Icon: Smile },
];

export function CsatPrompt({
  pergunta,
  onFechar,
  onEnviar,
}: {
  pergunta: string;
  onFechar: () => void;
  onEnviar: (score: CsatScore, comment?: string) => Promise<void>;
}) {
  const [escolha, setEscolha] = useState<CsatScore | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  const escolher = async (score: CsatScore) => {
    setEscolha(score);
    if (score < 3) return; // difícil/ok: dá espaço pro comentário antes de enviar
    await enviar(score);
  };

  const enviar = async (score: CsatScore) => {
    setEnviando(true);
    try {
      await onEnviar(score, comentario);
      toastSucesso("Obrigada pelo feedback");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="polia-v3 fixed bottom-6 right-6 z-40 w-[min(340px,calc(100vw-2rem))] rounded-[var(--radius-xl)] border border-[var(--line)] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.08)] relative">
      <button
        type="button"
        onClick={onFechar}
        aria-label="Fechar"
        className="absolute right-3 top-3 rounded-full p-1 text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--secondary)]"
      >
        <X size={16} aria-hidden="true" />
      </button>

      <p className="pr-6 text-[0.9rem] leading-snug text-[var(--ink)]">{pergunta}</p>

      {escolha === null && (
        <div className="mt-4 flex gap-2">
          {OPCOES.map(({ score, label, Icon }) => (
            <button
              key={score}
              type="button"
              onClick={() => void escolher(score)}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--line)] py-3 text-[var(--ink-soft)] transition-colors hover:border-[var(--secondary)] hover:bg-[var(--bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--secondary)]"
            >
              <Icon size={20} aria-hidden="true" />
              <span className="text-[0.75rem]">{label}</span>
            </button>
          ))}
        </div>
      )}

      {escolha !== null && escolha < 3 && (
        <div className="mt-4">
          <label className="block">
            <span className="mb-1.5 block text-[0.8rem] text-[var(--muted)]">
              O que travou? (opcional)
            </span>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Escreva aqui…"
              disabled={enviando}
              className="min-h-[64px] w-full resize-y rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-3 py-2 text-[0.85rem] leading-relaxed text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[inset_0_0_0_1px_var(--secondary)] focus:outline-none disabled:opacity-60"
            />
          </label>
          <button
            type="button"
            onClick={() => void enviar(escolha)}
            disabled={enviando}
            className="mt-3 w-full rounded-full bg-[var(--secondary)] px-4 py-2.5 text-[0.85rem] font-medium text-[var(--secondary-ink)] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {enviando ? "Enviando…" : "Enviar"}
          </button>
        </div>
      )}
    </div>
  );
}
