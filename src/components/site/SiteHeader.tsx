import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";

const NAV = [
  { to: "/sobre", label: "Sobre" },
  { to: "/como-funciona", label: "Como funciona" },
  { to: "/precos", label: "Preços" },
  { to: "/manifesto", label: "Manifesto" },
  { to: "/blog", label: "Blog" },
];

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  return (
    <header className="polia-v3 sticky top-0 z-40 border-b border-[var(--line)] bg-white">
      <div className="mx-auto flex min-h-16 max-w-[1120px] items-center justify-between gap-6 px-6">
        <Link to="/" aria-label="Pólia, página inicial" className="text-[var(--ink)] no-underline">
          <PoliaWordmark className="h-6 w-auto" />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`border-b-2 py-1 text-[15px] no-underline transition-colors ${
                  active
                    ? "border-[var(--secondary)] text-[var(--ink)]"
                    : "border-transparent text-[var(--ink-soft)] hover:border-[var(--secondary)] hover:text-[var(--ink)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to="/precos"
            className="hidden rounded-lg border border-[var(--secondary)] bg-[var(--secondary)] px-6 py-3 text-[16px] font-semibold text-[var(--secondary-ink)] no-underline transition-[filter] hover:brightness-95 md:inline-flex"
          >
            Começar
          </Link>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mnav"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] md:hidden"
          >
            {open ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
            Menu
          </button>
        </div>
      </div>

      {open && (
        <div id="mnav" className="border-b border-[var(--line)] bg-white md:hidden">
          <ul className="flex flex-col gap-0 px-6 pb-6 pt-2">
            {NAV.map((item) => (
              <li key={item.to} className="border-b border-[var(--line)] last:border-b-0">
                <Link
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="block py-4 text-[var(--ink-soft)] no-underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/precos"
                onClick={() => setOpen(false)}
                className="block py-4 font-semibold text-[var(--ink)] no-underline"
              >
                Começar
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
