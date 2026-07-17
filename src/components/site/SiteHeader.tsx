import { Link } from "@tanstack/react-router";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";

export function SiteHeader() {
  return (
    <header className="polia-v3 sticky top-0 z-40 border-b border-[var(--line)] bg-white">
      <div className="mx-auto flex min-h-16 max-w-[1120px] items-center justify-between gap-6 px-6">
        <Link to="/" aria-label="Pólia, página inicial" className="text-[var(--ink)] no-underline">
          <PoliaWordmark className="h-6 w-auto" />
        </Link>
        <Link
          to="/auth/login"
          className="rounded-lg border border-[var(--line)] px-6 py-3 text-[16px] font-semibold text-[var(--ink)] no-underline transition-colors hover:border-[var(--ink)]"
        >
          Já tem conta?
        </Link>
      </div>
    </header>
  );
}
