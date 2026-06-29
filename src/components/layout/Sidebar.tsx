import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Map,
  Users,
  Store,
  Wallet,
  Sun,
  Flame,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  LogOut,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useUserMeta } from "@/hooks/useUserMeta";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

const NAV: NavItem[] = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/jornada", label: "Jornada", icon: Map },
  { to: "/clientes", label: "Vendas e clientes", icon: Users },
  { to: "/vitrine", label: "Vitrine", icon: Store },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/painel#ferramentas", label: "Seu dia", icon: Sun },
];

// Quando a usuária está numa feature do "Seu dia", o item fica destacado.
const SEU_DIA = [
  "/diario",
  "/habitos",
  "/metas",
  "/foco",
  "/caderno",
  "/planner",
  "/equipe",
  "/guia",
  "/progresso",
];

function isActive(itemTo: string, pathname: string) {
  if (itemTo === "/painel#ferramentas")
    return SEU_DIA.some((r) => pathname === r || pathname.startsWith(r + "/"));
  if (itemTo === "/painel") return pathname === "/painel";
  return pathname === itemTo || pathname.startsWith(itemTo + "/");
}

async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/auth/login";
}

export function Sidebar() {
  const meta = useUserMeta();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // ≤1366px: colapsa para ícones automaticamente.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 1366px)");
    const apply = () => setCollapsed(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const streakLabel =
    meta.streak > 0
      ? `Você apareceu ${meta.streak} ${meta.streak === 1 ? "dia" : "dias"}. Continua crescendo.`
      : "Os dias que você apareceu. Só cresce.";

  function Body({ compact, onNavigate }: { compact: boolean; onNavigate?: () => void }) {
    return (
      <TooltipProvider delayDuration={150}>
        <div className="flex h-full flex-col bg-white">
          {/* Topo: logo + negócio + presença + avatar */}
          <div className={`flex flex-col gap-3 px-3 pb-4 pt-4 ${compact ? "items-center" : ""}`}>
            <Link
              to="/painel"
              onClick={onNavigate}
              aria-label="Pólia — ir para o painel"
              className="font-fraunces text-[var(--ink)] no-underline"
              style={{ fontSize: compact ? 18 : 24, fontWeight: 600, lineHeight: 1 }}
            >
              {compact ? "P" : "Pólia"}
            </Link>
            {!compact && meta.businessName && (
              <p className="text-[13px] text-[var(--muted)] leading-tight -mt-1">
                {meta.businessName}
              </p>
            )}
            <div className={`flex items-center gap-2 ${compact ? "flex-col" : "justify-between"}`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="flex min-h-[28px] items-center gap-1.5 rounded-lg px-1 text-[13px] text-[var(--ink)]"
                    aria-label={`Presença: ${meta.streak} dias`}
                  >
                    <Flame size={18} aria-hidden="true" />
                    {!compact && (
                      <span>
                        {meta.streak} {meta.streak === 1 ? "dia" : "dias"} de presença
                      </span>
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{streakLabel}</TooltipContent>
              </Tooltip>
              <span
                aria-hidden="true"
                className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[var(--accent)] text-[13px] font-medium text-[var(--accent-ink)]"
              >
                {meta.initial}
              </span>
            </div>
          </div>

          <div className="mx-3 h-px bg-[var(--line)]" />

          {/* Navegação */}
          <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1 px-2 py-3">
            {NAV.map((item) => {
              const active = isActive(item.to, pathname);
              const Icon = item.icon;
              const content = (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[14px] no-underline transition-colors ${
                    active
                      ? "border-l-[3px] border-[var(--secondary)] pl-[9px] font-medium text-[var(--ink)] bg-[var(--surface)]"
                      : "border-l-[3px] border-transparent text-[var(--ink-soft)] hover:bg-[var(--surface)]"
                  } ${compact ? "justify-center" : ""}`}
                >
                  <Icon size={20} aria-hidden="true" />
                  {!compact && <span>{item.label}</span>}
                </Link>
              );
              return compact ? (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>{content}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                content
              );
            })}
          </nav>

          {/* Rodapé: config, admin, sair, toggle colapso */}
          <div className="flex flex-col gap-1 border-t border-[var(--line)] px-2 py-3">
            <Link
              to="/configuracoes"
              onClick={onNavigate}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[14px] text-[var(--ink-soft)] no-underline hover:bg-[var(--surface)] ${compact ? "justify-center" : ""}`}
            >
              <Settings size={20} aria-hidden="true" />
              {!compact && <span>Configurações</span>}
            </Link>
            {meta.isAdmin && (
              <Link
                to="/admin"
                onClick={onNavigate}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[14px] text-[var(--ink-soft)] no-underline hover:bg-[var(--surface)] ${compact ? "justify-center" : ""}`}
              >
                <Shield size={20} aria-hidden="true" />
                {!compact && <span>Administração</span>}
              </Link>
            )}
            <button
              type="button"
              onClick={signOut}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-[14px] text-[var(--ink-soft)] hover:bg-[var(--surface)] ${compact ? "justify-center" : ""}`}
            >
              <LogOut size={20} aria-hidden="true" />
              {!compact && <span>Sair</span>}
            </button>
            {!compact && (
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Recolher menu"
                className="mt-1 hidden md:flex min-h-9 items-center gap-2 rounded-lg px-3 text-[12px] text-[var(--muted)] hover:bg-[var(--surface)]"
              >
                <PanelLeftClose size={16} aria-hidden="true" /> Recolher
              </button>
            )}
            {compact && (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                aria-label="Expandir menu"
                className="mt-1 hidden md:flex min-h-9 items-center justify-center rounded-lg px-3 text-[var(--muted)] hover:bg-[var(--surface)]"
              >
                <PanelLeftOpen size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <>
      {/* Sidebar fixa — desktop/tablet */}
      <aside
        className="polia-v3 sticky top-0 hidden h-screen flex-shrink-0 border-r border-[var(--line)] bg-white md:block"
        style={{ width: collapsed ? 64 : 232 }}
      >
        <Body compact={collapsed} />
      </aside>

      {/* Mobile — hambúrguer + drawer */}
      <div className="polia-v3 sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-[var(--line)] bg-white px-3 md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Abrir menu"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--ink)] hover:bg-[var(--surface)]"
            >
              <Menu size={22} aria-hidden="true" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="polia-v3 w-64 bg-white p-0">
            <Body compact={false} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="font-fraunces text-[18px] font-semibold text-[var(--ink)]">Pólia</span>
      </div>
    </>
  );
}
