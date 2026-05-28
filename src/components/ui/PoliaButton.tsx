import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export interface PoliaButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "ghost";
  size?: "default" | "large";
  fullWidth?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}

export const PoliaButton = forwardRef<HTMLButtonElement, PoliaButtonProps>(
  (
    {
      children,
      onClick,
      href,
      variant = "primary",
      size = "default",
      fullWidth = false,
      type = "button",
      disabled,
      className = "",
      ...rest
    },
    ref,
  ) => {
    const widthClass = fullWidth ? "w-full" : "";

    const sizeClasses =
      size === "large"
        ? "h-[66px] px-8 text-[18px]"
        : "h-[58px] px-6 text-[18px]";

    if (variant === "ghost") {
      const ghostClasses = `relative inline-flex ${sizeClasses} ${widthClass} items-center justify-center gap-2 rounded-xl border border-[rgba(255,255,255,0.20)] bg-transparent font-sans font-semibold text-[#FDF8F5] transition-all hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.30)] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed ${className}`;

      if (href) {
        return (
          <Link to={href} className={ghostClasses}>
            {children}
          </Link>
        );
      }
      return (
        <button
          ref={ref}
          type={type}
          onClick={onClick}
          disabled={disabled}
          className={ghostClasses}
          {...rest}
        >
          {children}
        </button>
      );
    }

    // primary
    const primaryInner = `relative inline-flex ${sizeClasses} ${widthClass} items-center justify-center gap-2 rounded-xl bg-[#C96B3E] font-sans font-semibold text-[#FDF8F5] transition-all hover:bg-[#D6764A] active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed ${className}`;

    const wrapper = (inner: ReactNode) => (
      <div className={`relative ${fullWidth ? "w-full" : "inline-block"}`}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[5px] -z-10 rounded-[18px] bg-[rgba(201,107,62,0.3)] blur-[2px]"
        />
        {inner}
      </div>
    );

    if (href) {
      return wrapper(
        <Link to={href} className={primaryInner}>
          {children}
        </Link>,
      );
    }

    return wrapper(
      <button
        ref={ref}
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={primaryInner}
        {...rest}
      >
        {children}
      </button>,
    );
  },
);
PoliaButton.displayName = "PoliaButton";
