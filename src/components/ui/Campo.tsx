import {
  cloneElement,
  isValidElement,
  useId,
  type AriaAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { FieldError } from "@/components/ui/FieldError";

/** Subconjunto de props que o Campo injeta no filho clonado — cobre input, textarea e select nativos. */
type CampoChildProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  required?: boolean;
};

interface CampoProps {
  /** Texto do label. */
  label: string;
  /** Id do campo. Gerado via React.useId() quando omitido. */
  id?: string;
  /**
   * Escape valve pra quando clonar o filho é complicado demais (ex: um Select
   * do Radix que já cuida da própria associação por dentro). Quando presente,
   * o Campo NÃO clona o filho — só usa esse id no htmlFor do label, e o
   * consumidor é responsável por aplicar id/aria-describedby no elemento real.
   */
  htmlFor?: string;
  /** Mensagem de erro. Quando presente, marca aria-invalid no filho clonado. */
  error?: string;
  /** Texto de ajuda, mostrado abaixo do campo. */
  hint?: ReactNode;
  required?: boolean;
  /** O input/select/textarea real — precisa ser um único elemento. */
  children: ReactElement<CampoChildProps>;
}

/**
 * Wrapper de label+input genérico — pra parar de reescrever o par Campo/CampoNum
 * que hoje vive duplicado (local, sem export) em projecao.tsx e produtos.tsx.
 * Por padrão clona o filho injetando id/aria-describedby/aria-invalid, então
 * funciona com qualquer <input>/<select>/<textarea> nativo sem precisar mudar
 * como o consumidor escreve o campo. Erro sempre liga ao filho via aria-describedby
 * (role="alert" já vem do FieldError existente).
 */
export function Campo({ label, id, htmlFor, error, hint, required, children }: CampoProps) {
  const generatedId = useId();
  const resolvedId = htmlFor ?? id ?? generatedId;
  const errorId = `${resolvedId}-erro`;
  const hintId = `${resolvedId}-dica`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  const podeClonar = !htmlFor && isValidElement(children);
  const campo = podeClonar
    ? cloneElement(children, {
        id: resolvedId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        ...(required ? { required: true } : {}),
      })
    : children;

  return (
    <div className="w-full">
      <label
        htmlFor={resolvedId}
        className="mb-1.5 block text-[12px] font-medium text-[var(--ink-soft)]"
      >
        {label}
        {required && (
          <span className="text-[var(--danger)]" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {campo}
      {hint && (
        <p id={hintId} className="mt-1.5 text-[12.5px] text-[var(--muted)]">
          {hint}
        </p>
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}
