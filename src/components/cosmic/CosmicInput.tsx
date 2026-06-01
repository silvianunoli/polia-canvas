import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

interface CosmicInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: ReactNode;
  error?: string;
  hint?: ReactNode;
  rightSlot?: ReactNode;
}

export const CosmicInput = forwardRef<HTMLInputElement, CosmicInputProps>(
  ({ label, icon, error, hint, rightSlot, id, type = "text", ...rest }, ref) => {
    const inputId = id ?? rest.name;
    const isPassword = type === "password";
    const [show, setShow] = useState(false);
    const effectiveType = isPassword ? (show ? "text" : "password") : type;

    return (
      <div className="w-full">
        <div className="mb-1.5 flex items-end justify-between">
          <label
            htmlFor={inputId}
            className="font-sans text-[13px] text-polia-marrom/80"
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
            {...rest}
            className={`h-[52px] w-full rounded-xl bg-white px-4 ${
              icon || isPassword ? "pr-11" : ""
            } font-sans text-[16px] text-polia-marrom placeholder:text-polia-marrom/40 outline-none transition-all border ${
              error
                ? "border-[#E53E3E] focus:border-[#E53E3E] focus:shadow-[0_0_12px_rgba(229,62,62,0.25)]"
                : "border-[rgba(201,107,62,0.4)] focus:border-polia-terracota focus:shadow-[0_0_12px_rgba(201,107,62,0.25)]"
            } disabled:opacity-60`}
          />
          {(icon || isPassword || rightSlot) && (
            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2 text-polia-marrom/50">
              {rightSlot}
              {isPassword ? (
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="rounded-md p-1 transition-colors hover:text-polia-marrom focus:outline-none focus:ring-2 focus:ring-polia-terracota/40"
                  aria-label={show ? "Esconder senha" : "Mostrar senha"}
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
        {error && (
          <p className="mt-1.5 font-sans text-[13px] text-[#E53E3E]">{error}</p>
        )}
      </div>
    );
  },
);
CosmicInput.displayName = "CosmicInput";

interface PasswordStrengthProps {
  password: string;
}

export function passwordScore(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (password.length >= 12 || /[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const score = passwordScore(password);
  const colors = ["#E53E3E", "#E89770", "#C8A96E", "#2D6A4F"];
  return (
    <div className="mt-2 grid grid-cols-4 gap-1.5">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-1 rounded-full transition-colors"
          style={{
            backgroundColor:
              i < score ? colors[Math.min(score - 1, 3)] : "rgba(26,26,46,0.08)",
          }}
        />
      ))}
    </div>
  );
}
