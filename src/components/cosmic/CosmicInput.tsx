import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Eye, EyeOff, Circle, CheckCircle2 } from "lucide-react";
import { FieldError } from "@/components/ui/FieldError";

interface CosmicInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  rightSlot?: ReactNode;
  /** Reserva altura fixa pra mensagem de erro, mesmo vazia, pra layout não pular. */
  reserveErrorSpace?: boolean;
  /** Borda --danger sem mensagem embaixo (ex: checklist externo já explica o que falta). */
  invalid?: boolean;
}

export const CosmicInput = forwardRef<HTMLInputElement, CosmicInputProps>(
  (
    { label, icon, error, hint, rightSlot, reserveErrorSpace, invalid, id, type = "text", ...rest },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? rest.name ?? generatedId;
    const errorId = `${inputId}-error`;
    const isPassword = type === "password";
    const [show, setShow] = useState(false);
    const effectiveType = isPassword ? (show ? "text" : "password") : type;
    const marcarErro = !!error || !!invalid;

    return (
      <div className="w-full">
        <div className="mb-1.5 flex items-end justify-between gap-2">
          <label
            htmlFor={inputId}
            className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]"
          >
            {label}
          </label>
          {hint}
        </div>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={effectiveType}
            aria-invalid={marcarErro || undefined}
            aria-describedby={error ? errorId : undefined}
            {...rest}
            className={`h-[48px] w-full rounded-lg bg-white px-4 ${
              icon || isPassword ? "pr-11" : ""
            } text-[15px] text-[var(--ink)] placeholder:text-[var(--muted)] outline-none transition-colors border ${
              marcarErro
                ? "border-[var(--danger)] focus:border-[var(--danger)]"
                : "border-[var(--line)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_1px_var(--secondary)]"
            } disabled:opacity-60`}
          />
          {(icon || isPassword || rightSlot) && (
            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2 text-[var(--muted)]">
              {rightSlot}
              {isPassword ? (
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--secondary)]"
                  aria-label={show ? "Esconder senha" : "Mostrar senha"}
                  title={show ? "Esconder senha" : "Mostrar senha"}
                  tabIndex={-1}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              ) : (
                icon
              )}
            </div>
          )}
        </div>
        <FieldError id={errorId} reserveSpace={reserveErrorSpace}>
          {error}
        </FieldError>
      </div>
    );
  },
);
CosmicInput.displayName = "CosmicInput";

// Aviso de Caps Lock: hint, não erro (--muted). Some sozinho quando desliga.
export function useCapsLockWarning() {
  const [ligado, setLigado] = useState(false);
  const onKeyUp = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) setLigado(e.getModifierState("CapsLock"));
  };
  return { ligado, onKeyUp };
}

export function CapsLockHint({ ligado }: { ligado: boolean }) {
  return (
    <p className="mt-1.5 min-h-[16px] text-[12px] text-[var(--muted)]">
      {ligado ? "Caps Lock está ligado." : ""}
    </p>
  );
}

// Guia de senha da criação de conta: requisitos visíveis desde o início (não
// é erro até o submit), barra de 3 segmentos sem vermelho (pendente = --muted).
const REQUISITOS = [
  { id: "len", label: "Pelo menos 8 caracteres", teste: (v: string) => v.length >= 8 },
  { id: "num", label: "Pelo menos 1 número", teste: (v: string) => /\d/.test(v) },
  { id: "up", label: "Pelo menos 1 letra maiúscula", teste: (v: string) => /[A-Z]/.test(v) },
];

export function senhaCumpreRequisitos(password: string): boolean {
  return REQUISITOS.every((r) => r.teste(password));
}

export function PasswordRequirements({ password }: { password: string }) {
  const oks = REQUISITOS.map((r) => r.teste(password));
  const score = oks.filter(Boolean).length;
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-colors duration-[250ms]"
            style={{
              background:
                i < score ? (score >= 3 ? "var(--secondary)" : "var(--accent)") : "var(--line)",
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-col gap-[3px]">
        {REQUISITOS.map((r, i) => {
          const ok = oks[i];
          return (
            <span
              key={r.id}
              className={`flex items-center gap-2 text-[12.5px] transition-colors duration-200 ${
                ok ? "text-[var(--ink-soft)]" : "text-[var(--muted)]"
              }`}
            >
              {ok ? (
                <CheckCircle2
                  size={14}
                  className="shrink-0 text-[var(--secondary)]"
                  aria-hidden="true"
                />
              ) : (
                <Circle size={14} className="shrink-0" aria-hidden="true" />
              )}
              {r.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
