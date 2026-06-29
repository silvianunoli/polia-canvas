import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { BusinessBrandLockup } from "@/components/painel/BusinessBrandLockup";
import { useUserMeta } from "@/hooks/useUserMeta";
import { Menu, Flame, ChevronDown } from "lucide-react";

interface NavLinkItem {
  to: string;
  label: string;
}

const links: NavLinkItem[] = [
  { to: "/painel", label: "Painel" },
  { to: "/jornada", label: "Jornada" },
  { to: "/tarefas", label: "Tarefas" },
  { to: "/clientes", label: "Vendas e clientes" },
  { to: "/vitrine", label: "Vitrine" },
  { to: "/financeiro", label: "Financeiro" },
  { to: "/biblioteca", label: "Entregáveis" },
];

// "Seu dia" — camada de operação diária da marca (agrupada pra não inflar o nav principal).
const seuDiaLinks: NavLinkItem[] = [
  { to: "/diario", label: "Diário" },
  { to: "/habitos", label: "Hábitos" },
  { to: "/metas", label: "Metas" },
  { to: "/foco", label: "Foco" },
  { to: "/caderno", label: "Caderno" },
  { to: "/planner", label: "Quadros" },
  { to: "/equipe", label: "Equipe" },
  { to: "/guia", label: "Sua guia" },
  { to: "/progresso", label: "Seu Progresso" },
];

export function PainelNav({
  navActive = "/painel",
}: {
  initial?: string;
  streak?: number;
  navActive?: string;
}) {
  const meta = useUserMeta();
  const streak = meta.streak;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const seuDiaActive = seuDiaLinks.some(
    (l) => navActive === l.to || navActive.startsWith(l.to + "/"),
  );

  return (
    <header
      className="sticky top-0 z-30 h-14 w-full bg-[#FDF8F5]"
      style={{ borderBottom: "1px solid rgba(26,26,46,0.08)" }}
    >
      <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-4 sm:px-6">
        {/* Mobile hamburger */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Abrir menu"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-[#0E1731] hover:bg-[#0E1731]/5 lg:hidden"
            >
              <Menu size={22} />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-[#FDF8F5] p-0">
            <nav aria-label="Navegação principal" className="flex h-full flex-col">
              <div className="border-b border-[rgba(26,26,46,0.08)] px-6 py-5">
                <BusinessBrandLockup variant="drawer" />
              </div>
              <ul className="flex flex-col gap-1 px-3 py-4">
                {links.map((l) => {
                  const isActive = navActive === l.to || navActive.startsWith(l.to + "/");
                  return (
                    <li key={l.to}>
                      <a
                        href={l.to}
                        onClick={() => setDrawerOpen(false)}
                        aria-current={isActive ? "page" : undefined}
                        className={
                          isActive
                            ? "flex min-h-11 items-center rounded-lg bg-polia-terracota/10 px-3 font-sans text-[15px] font-bold text-polia-terracota"
                            : "flex min-h-11 items-center rounded-lg px-3 font-sans text-[15px] text-[#0E1731] hover:bg-[#0E1731]/5"
                        }
                      >
                        {l.label}
                      </a>
                    </li>
                  );
                })}
              </ul>

              {/* Grupo "Seu dia" — operação diária */}
              <div className="border-t border-[rgba(26,26,46,0.08)] px-3 pt-4">
                <p className="px-3 pb-2 font-accent text-[9px] font-bold uppercase tracking-[1.5px] text-[#0E1731] opacity-40">
                  Seu dia
                </p>
                <ul className="flex flex-col gap-1">
                  {seuDiaLinks.map((l) => {
                    const isActive = navActive === l.to || navActive.startsWith(l.to + "/");
                    return (
                      <li key={l.to}>
                        <a
                          href={l.to}
                          onClick={() => setDrawerOpen(false)}
                          aria-current={isActive ? "page" : undefined}
                          className={
                            isActive
                              ? "flex min-h-11 items-center rounded-lg bg-polia-terracota/10 px-3 font-sans text-[15px] font-bold text-polia-terracota"
                              : "flex min-h-11 items-center rounded-lg px-3 font-sans text-[15px] text-[#0E1731] hover:bg-[#0E1731]/5"
                          }
                        >
                          {l.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-auto border-t border-[rgba(26,26,46,0.08)] px-3 py-3">
                <a
                  href="/configuracoes"
                  onClick={() => setDrawerOpen(false)}
                  className="flex min-h-11 items-center rounded-lg px-3 font-sans text-[14px] text-[#0E1731] hover:bg-[#0E1731]/5"
                >
                  Configurações
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.href = "/auth/login";
                  }}
                  className="flex min-h-11 w-full items-center rounded-lg px-3 text-left font-sans text-[14px] text-[#0E1731] opacity-70 hover:bg-[#0E1731]/5"
                >
                  Sair
                </button>
              </div>
            </nav>
          </SheetContent>
        </Sheet>

        {/* Brand lockup — nome do negócio da Aimer dominante, "feito com Pólia" como assinatura.
            Marcador Exclusivo nº3 (Inversão de Hierarquia). cf. polia-marcadores-exclusivos. */}
        <BusinessBrandLockup variant="header" />

        {/* Desktop nav */}
        <nav aria-label="Navegação principal" className="hidden items-center gap-6 lg:flex">
          {links.map((l) => {
            const isActive = navActive === l.to || navActive.startsWith(l.to + "/");
            return (
              <a
                key={l.to}
                href={l.to}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "border-b-2 border-polia-terracota pb-[2px] font-sans text-[16px] font-bold text-polia-terracota"
                    : "font-sans text-[14px] font-medium text-[#0E1731] transition hover:text-polia-terracota"
                }
              >
                {l.label}
              </a>
            );
          })}

          {/* Grupo "Seu dia" — dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Seu dia"
                className={
                  seuDiaActive
                    ? "flex items-center gap-1 border-b-2 border-polia-terracota pb-[2px] font-sans text-[16px] font-bold text-polia-terracota"
                    : "flex items-center gap-1 font-sans text-[14px] font-medium text-[#0E1731] transition hover:text-polia-terracota"
                }
              >
                Seu dia <ChevronDown size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 rounded-xl border border-[rgba(26,26,46,0.08)] bg-white p-1 shadow-md"
            >
              {seuDiaLinks.map((l) => {
                const isActive = navActive === l.to || navActive.startsWith(l.to + "/");
                return (
                  <DropdownMenuItem key={l.to} asChild>
                    <a
                      href={l.to}
                      className={
                        isActive
                          ? "cursor-pointer rounded-lg px-3 py-2 font-sans text-[14px] font-semibold text-polia-terracota focus:bg-[rgba(201,107,62,0.08)]"
                          : "cursor-pointer rounded-lg px-3 py-2 font-sans text-[14px] text-[#0E1731] focus:bg-[rgba(26,26,46,0.04)]"
                      }
                    >
                      {l.label}
                    </a>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Streak: ícone+tooltip mobile, badge completo desktop.
              streak>=1 → terracota sólido com texto branco (alto contraste);
              streak=0  → outline neutro. */}
          <span
            data-positive={streak > 0 ? "true" : "false"}
            title={`${streak} ${streak === 1 ? "dia" : "dias"} seguidos`}
            aria-label={`Streak: ${streak} ${streak === 1 ? "dia" : "dias"}`}
            className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2 sm:px-3"
            style={
              streak > 0
                ? { background: "#C96B3E", border: "1px solid #C96B3E" }
                : { background: "transparent", border: "1px solid rgba(14,23,49,0.30)" }
            }
          >
            <Flame size={16} className={streak > 0 ? "text-white" : "text-[#0E1731]/50"} />
            <span
              className="hidden font-sans text-[13px] font-bold sm:inline"
              style={{ color: streak > 0 ? "#FFFFFF" : "rgba(14,23,49,0.55)" }}
            >
              {streak} {streak === 1 ? "dia" : "dias"}
            </span>
          </span>
          <AvatarMenu initial={meta.initial} isAdmin={meta.isAdmin} />
        </div>
      </div>
    </header>
  );
}

function AvatarMenu({ initial, isAdmin }: { initial: string; isAdmin: boolean }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth/login" });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Abrir menu da conta"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-polia-terracota font-sans text-[14px] font-bold text-polia-creme outline-none focus-visible:ring-2 focus-visible:ring-polia-terracota/40"
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 bg-white border border-[rgba(26,26,46,0.08)] rounded-xl shadow-md p-1"
      >
        <DropdownMenuItem
          onSelect={() => navigate({ to: "/configuracoes" })}
          className="font-sans text-[14px] text-[#0E1731] px-3 py-2 rounded-lg cursor-pointer focus:bg-[rgba(26,26,46,0.04)]"
        >
          Configurações
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator className="my-1 bg-[rgba(26,26,46,0.06)]" />
            <DropdownMenuItem
              onSelect={() => navigate({ to: "/admin" })}
              className="font-sans text-[14px] text-polia-terracota font-medium px-3 py-2 rounded-lg cursor-pointer focus:bg-[rgba(26,26,46,0.04)]"
            >
              Administração
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator className="my-1 bg-[rgba(26,26,46,0.06)]" />
        <DropdownMenuItem
          onSelect={handleLogout}
          className="font-sans text-[14px] text-[#0E1731] opacity-80 px-3 py-2 rounded-lg cursor-pointer focus:bg-[rgba(26,26,46,0.04)]"
        >
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
