interface NavLinkItem {
  to: string;
  label: string;
  exists: boolean;
}

const links: NavLinkItem[] = [
  { to: "/painel", label: "Painel", exists: true },
  { to: "/jornada", label: "Jornada", exists: false },
  { to: "/tarefas", label: "Tarefas", exists: false },
  { to: "/clientes", label: "Clientes", exists: false },
  { to: "/financeiro", label: "Financeiro", exists: false },
];

export function PainelNav({
  initial,
  streak,
}: {
  initial: string;
  streak: number;
}) {
  return (
    <header
      className="sticky top-0 z-30 h-14 w-full bg-[#FDF8F5]"
      style={{ borderBottom: "1px solid rgba(26,26,46,0.08)" }}
    >
      <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-6">
        {/* Logo placeholder */}
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-polia-terracota bg-transparent px-4 py-1.5">
          <span className="font-accent text-[9px] font-bold tracking-[1.5px] text-polia-dourado">
            PLACEHOLDER · LOGO
          </span>
          <span className="font-sans text-[8px] text-polia-noite opacity-40">
            120×32
          </span>
        </div>

        {/* Links */}
        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => {
            const isActive = l.to === "/painel";
            return (
              <a
                key={l.to}
                href={l.to}
                className={
                  isActive
                    ? "border-b-2 border-polia-terracota pb-[2px] font-sans text-[14px] font-medium text-polia-terracota"
                    : "font-sans text-[14px] font-medium text-polia-noite opacity-60 transition hover:opacity-100"
                }
              >
                {l.label}
              </a>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1"
            style={{
              background: "rgba(200,169,110,0.12)",
              border: "1px solid rgba(200,169,110,0.3)",
            }}
          >
            <span className="font-sans text-[13px] font-semibold text-polia-dourado">
              {streak} {streak === 1 ? "dia" : "dias"}
            </span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-polia-terracota font-sans text-[14px] font-bold text-polia-creme">
            {initial}
          </div>
        </div>
      </div>
    </header>
  );
}
