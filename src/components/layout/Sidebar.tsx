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
  ChevronDown,
  Settings,
  Shield,
  LogOut,
  CalendarDays,
} from "lucide-react";
import { PoliaIcon, PoliaWordmark } from "@/components/brand/PoliaLogo";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useUserMeta } from "@/hooks/useUserMeta";
import { TOKEN_BRIDGE_V3 } from "@/lib/uiTokenBridge";
import { DOMINIO_GESTAO } from "@/lib/dominio-gestao";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

// Marca e Mapa de Mercado NÃO ficam aqui: são documentos do planejamento,
// acessados pelo badge de cada módulo dentro de /planejamento. O sidebar guarda
// o planejamento + as ferramentas de trabalho do dia a dia.
const NAV: NavItem[] = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/planejamento", label: "Planejamento", icon: Map },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/caderno", label: "Caderno", icon: Notebook },
  { to: "/planner", label: "Planner", icon: LayoutList },
  { to: "/calendario", label: "Calendário", icon: CalendarDays },
];

function isActive(itemTo: string, pathname: string) {
  if (itemTo === "/painel") return pathname === itemTo;
  return pathname === itemTo || pathname.startsWith(itemTo + "/");
}

// A área de gestão (CRM, Social, Financeiro interno, etc.) foi extraída pro
// projeto polia-admin (deploy e domínio próprios, silvianunoli.com.br) em
// 27/07/2026 — não mora mais nas rotas deste app. Blog e Design System
// continuam aqui (fora do escopo da extração).
const ADMIN_SUBLINKS = [
  { to: "/blog-admin", label: "Blog" },
  { to: "/design-system", label: "Design System" },
] as const;
const URL_GESTAO = "https://silvianunoli.com.br";

async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/auth/login";
}

export function Sidebar() {
  const meta = useUserMeta();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  // Domínio de gestão só serve a área de gestão (agora no polia-admin) — o
  // sidebar não deve mostrar nem linkar as seções da assinante
  // (Painel/Planejamento/...) aqui. Checado só no client (via useEffect) pra
  // não divergir do HTML renderizado no SSR.
  const [emDominioGestao, setEmDominioGestao] = useState(false);
  useEffect(() => {
    setEmDominioGestao(window.location.hostname === DOMINIO_GESTAO);
  }, []);

  // ≤1366px: colapsa para ícones automaticamente.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 1366px)");
    const apply = () => setCollapsed(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Abre o submenu de Administração automaticamente se já está numa página dele.
  useEffect(() => {
    if (pathname.startsWith("/blog-admin") || pathname.startsWith("/design-system")) {
      setAdminOpen(true);
    }
  }, [pathname]);

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
              to={emDominioGestao ? "/central" : "/painel"}
              onClick={onNavigate}
              aria-label={
                emDominioGestao ? "Pólia, ir para a central de administração" : "Pólia, ir para o painel"
              }
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

          {/* Navegação — some no domínio de gestão, que só serve /admin. */}
          <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1 px-2 py-3">
            {!emDominioGestao && NAV.map((item) => {
              const active = isActive(item.to, pathname);
              const Icon = item.icon;
              const content = (
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
              );
              return compact ? (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>{content}</TooltipTrigger>
                  <TooltipContent side="right" className="polia-v3" style={TOKEN_BRIDGE_V3}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              ) : (
                content
              );
            })}
          </nav>

          {/* Rodapé: config, admin, sair, toggle colapso */}
          <div className="flex flex-col gap-1 border-t border-[var(--line)] px-2 py-3">
            {!emDominioGestao && (
              <Link
                to="/configuracoes"
                onClick={onNavigate}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[14px] text-[var(--ink-soft)] no-underline hover:bg-[var(--surface)] ${compact ? "justify-center" : ""}`}
              >
                <Settings size={20} aria-hidden="true" />
                {!compact && <span>Configurações</span>}
              </Link>
            )}
            {meta.isAdmin && compact && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={URL_GESTAO}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Administração"
                    className="flex min-h-11 items-center justify-center rounded-lg px-3 text-[var(--ink-soft)] no-underline hover:bg-[var(--surface)]"
                  >
                    <Shield size={20} aria-hidden="true" />
                  </a>
                </TooltipTrigger>
                <TooltipContent side="right" className="polia-v3" style={TOKEN_BRIDGE_V3}>
                  Administração
                </TooltipContent>
              </Tooltip>
            )}
            {meta.isAdmin && !compact && (
              <div>
                <button
                  type="button"
                  onClick={() => setAdminOpen((o) => !o)}
                  aria-expanded={adminOpen}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-[14px] text-[var(--ink-soft)] hover:bg-[var(--surface)]"
                >
                  <Shield size={20} aria-hidden="true" />
                  <span className="flex-1 text-left">Administração</span>
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={`transition-transform ${adminOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {adminOpen && (
                  <div className="ml-8 flex flex-col gap-1 py-1">
                    <a
                      href={URL_GESTAO}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-9 items-center rounded-lg px-3 text-[13px] text-[var(--ink-soft)] no-underline hover:bg-[var(--surface)]"
                    >
                      Gestão (CRM, Financeiro...) ↗
                    </a>
                    {ADMIN_SUBLINKS.map((s) => (
                      <Link
                        key={s.to}
                        to={s.to}
                        onClick={onNavigate}
                        aria-current={isActive(s.to, pathname) ? "page" : undefined}
                        className={`flex min-h-9 items-center rounded-lg px-3 text-[13px] no-underline ${
                          isActive(s.to, pathname)
                            ? "font-medium text-[var(--ink)]"
                            : "text-[var(--ink-soft)] hover:bg-[var(--surface)]"
                        }`}
                      >
                        {s.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
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
