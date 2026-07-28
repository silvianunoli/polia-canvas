import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Map,
  Users,
  Package,
  Wallet,
  LayoutList,
  Target,
  Notebook,
  Flame,
  Menu,
  ChevronsLeft,
  ChevronsRight,
  Settings,
  LogOut,
  CalendarDays,
  Lock,
  Sparkles,
  TrendingUp,
  Stethoscope,
  Megaphone,
} from "lucide-react";
import { PoliaIcon, PoliaWordmark } from "@/components/brand/PoliaLogo";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useUserMeta } from "@/hooks/useUserMeta";
import { TOKEN_BRIDGE_V3 } from "@/lib/uiTokenBridge";
import { ehBeta, tierDoPlano, tierMinimoDaRota } from "@/lib/planos";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

// Marca e Mapa de Mercado NÃO ficam aqui: são documentos do planejamento,
// acessados pelo badge de cada módulo dentro de /planejamento. O sidebar guarda
// o planejamento + as ferramentas de trabalho do dia a dia.
const NAV: NavItem[] = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/aimer", label: "Aimer", icon: Sparkles },
  { to: "/planejamento", label: "Planejamento", icon: Map },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/projecao", label: "Projeção e cenários", icon: TrendingUp },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/raiox", label: "Raio-x do mês", icon: Stethoscope },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/caderno", label: "Caderno", icon: Notebook },
  { to: "/planner", label: "Planner", icon: LayoutList },
  { to: "/plano-conteudo", label: "Plano de conteúdo", icon: Megaphone },
  { to: "/calendario", label: "Calendário", icon: CalendarDays },
];

function isActive(itemTo: string, pathname: string) {
  if (itemTo === "/painel") return pathname === itemTo;
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
      ? `${meta.streak} ${meta.streak === 1 ? "dia" : "dias"} de presença, com algo registrado na Pólia. Só cresce, nunca zera.`
      : "Conta os dias com presença e algo registrado na Pólia. Só cresce.";

  function Body({ compact, onNavigate }: { compact: boolean; onNavigate?: () => void }) {
    return (
      <TooltipProvider delayDuration={150}>
        <div className="flex h-full flex-col overflow-y-auto bg-white">
          {/* Topo: logo + negócio + presença + avatar */}
          <div className={`flex flex-col gap-3 px-3 pb-4 pt-4 ${compact ? "items-center" : ""}`}>
            <Link
              to="/painel"
              onClick={onNavigate}
              aria-label="Pólia, ir para o painel"
              className="text-[var(--ink)] no-underline"
            >
              {compact ? (
                <PoliaIcon className="h-7 w-auto" />
              ) : (
                <PoliaWordmark className="h-6 w-auto" />
              )}
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
                <TooltipContent className="polia-v3" style={TOKEN_BRIDGE_V3}>
                  {streakLabel}
                </TooltipContent>
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

          <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1 px-2 py-3">
            {NAV.map((item) => {
              const active = isActive(item.to, pathname);
              const Icon = item.icon;
              const liberado =
                ehBeta(meta.plano) ||
                tierMinimoDaRota(item.to) === "confere" ||
                tierDoPlano(meta.plano) === "controle";
              const content = liberado ? (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  data-track="nav_clicado"
                  data-track-props={JSON.stringify({ destino: item.to })}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[14px] no-underline transition-colors ${
                    active
                      ? "border-l-[3px] border-[var(--secondary)] pl-[9px] font-medium text-[var(--ink)]"
                      : "border-l-[3px] border-transparent text-[var(--ink-soft)] hover:bg-[var(--surface)]"
                  } ${compact ? "justify-center" : ""}`}
                >
                  <Icon size={20} aria-hidden="true" />
                  {!compact && <span>{item.label}</span>}
                </Link>
              ) : (
                <Link
                  key={item.to}
                  to="/upgrade"
                  search={{ rota: item.to, tier: "controle" }}
                  onClick={onNavigate}
                  data-track="nav_bloqueado_clicado"
                  data-track-props={JSON.stringify({ destino: item.to })}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[14px] text-[var(--muted)] no-underline transition-colors hover:bg-[var(--surface)] border-l-[3px] border-transparent ${
                    compact ? "justify-center" : ""
                  }`}
                >
                  {compact ? (
                    <Lock size={18} aria-hidden="true" />
                  ) : (
                    <>
                      <Icon size={20} aria-hidden="true" />
                      <span className="flex flex-1 items-center justify-between gap-2">
                        {item.label}
                        <Lock size={14} aria-hidden="true" />
                      </span>
                    </>
                  )}
                </Link>
              );
              const tooltipLabel = liberado
                ? item.label
                : `${item.label} — desbloqueie com o Controle`;
              return compact ? (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>{content}</TooltipTrigger>
                  <TooltipContent side="right" className="polia-v3" style={TOKEN_BRIDGE_V3}>
                    {tooltipLabel}
                  </TooltipContent>
                </Tooltip>
              ) : (
                content
              );
            })}
          </nav>

          {/* Rodapé: config, sair, toggle colapso */}
          <div className="flex flex-col gap-1 border-t border-[var(--line)] px-2 py-3">
            <Link
              to="/configuracoes"
              onClick={onNavigate}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[14px] text-[var(--ink-soft)] no-underline hover:bg-[var(--surface)] ${compact ? "justify-center" : ""}`}
            >
              <Settings size={20} aria-hidden="true" />
              {!compact && <span>Configurações</span>}
            </Link>
            <button
              type="button"
              onClick={signOut}
              data-track="sair_clicado"
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
                className="mt-2 hidden self-end rounded-md px-2 py-1 text-[12px] text-[var(--muted)] transition-colors md:flex md:items-center md:gap-1.5 hover:text-[var(--ink-soft)]"
              >
                Recolher <ChevronsLeft size={15} aria-hidden="true" />
              </button>
            )}
            {compact && (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                aria-label="Expandir menu"
                className="mt-1 hidden md:flex min-h-9 items-center justify-center rounded-lg px-3 text-[var(--muted)] hover:bg-[var(--surface)]"
              >
                <ChevronsRight size={18} aria-hidden="true" />
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
        <PoliaWordmark className="h-[18px] w-auto text-[var(--ink)]" />
      </div>
    </>
  );
}
