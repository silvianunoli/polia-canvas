import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

interface CosmicButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: "primary" | "ghost" | "outline";
}

export const CosmicButton = forwardRef<HTMLButtonElement, CosmicButtonProps>(
  ({ loading, disabled, children, variant = "primary", className = "", ...rest }, ref) => {
    if (variant === "primary") {
      return (
        <div className="relative w-full">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-[5px] -z-10 rounded-[18px] bg-[rgba(201,107,62,0.3)] blur-[2px]"
          />
          <button
            ref={ref}
            disabled={loading || disabled}
            {...rest}
            className={`relative inline-flex h-[58px] w-full items-center justify-center gap-2 rounded-xl bg-[#C96B3E] font-sans text-[18px] font-semibold text-[#FDF8F5] transition-all hover:bg-[#D6764A] active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed ${className}`}
          >
            {loading && <Loader2 size={20} className="animate-spin" />}
            {children}
          </button>
        </div>
      );
    }
    if (variant === "outline") {
      return (
        <button
          ref={ref}
          disabled={loading || disabled}
          {...rest}
          className={`inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] font-sans text-[16px] text-[#D8D2CC] transition-colors hover:bg-[rgba(255,255,255,0.10)] disabled:opacity-60 ${className}`}
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          {children}
        </button>
      );
    }
    return (
      <button
        ref={ref}
        disabled={loading || disabled}
        {...rest}
        className={`inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-transparent border border-[rgba(255,255,255,0.15)] font-sans text-[16px] text-[#D8D2CC] transition-colors hover:bg-[rgba(255,255,255,0.05)] disabled:opacity-60 ${className}`}
      >
        {loading && <Loader2 size={18} className="animate-spin" />}
        {children}
      </button>
    );
  },
);
CosmicButton.displayName = "CosmicButton";
