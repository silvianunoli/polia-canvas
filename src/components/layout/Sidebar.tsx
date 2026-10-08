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
  Menu,
  ChevronsLeft,
  ChevronsRight,
  Settings,
  LogOut,
  PlayCircle,
  CalendarDays,
  Lock,
  TrendingUp,
  Stethoscope,
  Megaphone,
  Calculator,
} from "lucide-react";
import { PoliaIcon, PoliaWordmark } from "@/components/brand/PoliaLogo";
import { registrarEAguardar } from "@/lib/founder-eventos";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useUserMeta } from "@/hooks/useUserMeta";
import { TOKEN_BRIDGE_V3 } from "@/lib/uiTokenBridge";
import { recursoLiberado, tierPagoDaRota, TIERS_PAGOS } from "@/lib/planos";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

// Marca e Mapa de Mercado NÃO ficam aqui: são documentos do planejamento,
// acessados pelo badge de cada módulo dentro de /planejamento. O sidebar guarda
// o planejamento + as ferramentas de trabalho do dia a dia.
const NAV: NavItem[] = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/planejamento", label: "Planejamento", icon: Map },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/calculadora", label: "Calculadora", icon: Calculator },
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

// Mesma chave de TEVE_SESSAO_KEY em routes/_authenticated.tsx (literal aqui pra
// não importar o arquivo da rota, que importa este componente). Saída por
// vontade própria não é expiração: sem limpar a flag, a próxima pessoa que
// abrisse o app neste navegador via "Sua sessão expirou".
const TEVE_SESSAO_KEY = "polia-teve-sessao";

async function signOut() {
  await registrarEAguardar("logout", { feature: "conta" });
  await supabase.auth.signOut();
  try {
    localStorage.removeItem(TEVE_SESSAO_KEY);
  } catch {
    // localStorage indisponível (modo privado restrito): o pior caso é o aviso
    // de sessão expirada aparecer uma vez, nada quebra.
  }
  window.location.href = "/auth/login";
}

// Fica fora do Sidebar de propósito: declarado lá dentro, o React via um
// componente novo a cada troca de rota e remontava o menu inteiro (a rolagem
// do menu voltava pro topo e o tooltip perdia o estado).
function Body({
  compact,
  onNavigate,
  onCollapsedChange,
}: {
  compact: boolean;
  onNavigate?: () => void;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const meta = useUserMeta();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const configAtiva = isActive("/configuracoes", pathname) || isActive("/chamados", pathname);
  const tutorialAtivo = isActive("/como-usar", pathname);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
        {/* Topo: logo + negócio + avatar (o contador de presença saiu em 05/10/2026, decisão da Sil) */}
        <div className={`flex flex-col gap-2 px-3 pb-3 pt-4 ${compact ? "items-center" : ""}`}>
          <div className={`flex items-center ${compact ? "justify-center" : "justify-between"}`}>
            <Link
              to="/painel"
              onClick={onNavigate}
              aria-label="Pólia One, ir para o painel"
              className="text-[var(--ink)] no-underline"
            >
              {compact ? (
                <PoliaIcon className="h-7 w-auto" />
              ) : (
                <PoliaWordmark className="h-6 w-auto" />
              )}
            </Link>
            {/* Recolher mora aqui em cima (e não no rodapé) pra sobrar altura:
                o menu inteiro precisa caber na tela sem rolagem. */}
            {!compact && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onCollapsedChange(true)}
                    aria-label="Recolher menu"
                    className="-my-2 -mr-2 hidden h-11 w-11 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--ink-soft)] md:flex"
                  >
                    <ChevronsLeft size={16} aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="polia-v3" style={TOKEN_BRIDGE_V3}>
                  Recolher menu
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {!compact && meta.businessName && (
            <p className="text-[13px] text-[var(--muted)] leading-tight -mt-1">
              {meta.businessName}
            </p>
          )}
          <div className={`flex items-center gap-2 ${compact ? "flex-col" : "justify-end"}`}>
            {/* No modo recolhido o avatar (só decorativo) sai pra caber em altura. */}
            {!compact && (
              <span
                aria-hidden="true"
                className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[var(--accent)] text-[13px] font-medium text-[var(--accent-ink)]"
              >
                {meta.initial}
              </span>
            )}
          </div>
        </div>

        <div className="mx-3 h-px bg-[var(--line)]" />

        {/* Desktop: cada item cresce até 44px e encolhe até 26px conforme a altura
            da tela, pra lista inteira caber sem rolagem. No celular (drawer) fica
            44px fixo, que é o alvo de toque confortável. */}
        <nav
          aria-label="Navegação principal"
          className="flex flex-1 flex-col gap-1 px-2 py-2 md:gap-0"
        >
          {NAV.map((item) => {
            const active = isActive(item.to, pathname);
            const Icon = item.icon;
            // `recursoLiberado`, não `rotaLiberada`: Raio-x, Projeção e Plano
            // de conteúdo passam pelo guard de tier (são "controle") e só são
            // barradas por um portão dentro da página. Com a checagem antiga a
            // usuária do Premium via esses três itens SEM cadeado e só
            // descobria que eram pagos depois de clicar.
            //
            // Enquanto o plano não chegou (ou a leitura falhou), "confere" é
            // chute: sem cadeado, senão quem paga via o cadeado piscar em toda
            // abertura. O guard da rota continua barrando quem não tem acesso.
            const liberado = meta.carregando || recursoLiberado(item.to, meta.plano);
            const tierNecessario = tierPagoDaRota(item.to);
            const content = liberado ? (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                data-tour={item.to.slice(1)}
                data-track="nav_clicado"
                data-track-props={JSON.stringify({ destino: item.to })}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 md:min-h-[26px] md:max-h-11 md:flex-[1_1_0] items-center gap-3 rounded-lg px-3 text-[13px] no-underline transition-colors ${
                  active
                    ? "bg-[var(--secondary-light)] font-medium text-[var(--ink)]"
                    : "text-[var(--ink-soft)] hover:bg-[var(--bg)]"
                } ${compact ? "justify-center" : ""}`}
              >
                <Icon size={18} aria-hidden="true" />
                <span className={compact ? "sr-only" : undefined}>{item.label}</span>
              </Link>
            ) : (
              <Link
                key={item.to}
                to="/upgrade"
                search={{ rota: item.to, tier: tierNecessario }}
                onClick={onNavigate}
                data-tour={item.to.slice(1)}
                data-track="nav_bloqueado_clicado"
                data-track-props={JSON.stringify({ destino: item.to })}
                className={`flex min-h-11 md:min-h-[26px] md:max-h-11 md:flex-[1_1_0] items-center gap-3 rounded-lg px-3 text-[13px] text-[var(--muted)] no-underline transition-colors hover:bg-[var(--bg)] ${
                  compact ? "justify-center" : ""
                }`}
              >
                {compact ? (
                  <>
                    <Lock size={18} aria-hidden="true" />
                    <span className="sr-only">{`${item.label}, disponível no ${TIERS_PAGOS[tierNecessario].titulo}`}</span>
                  </>
                ) : (
                  <>
                    <Icon size={18} aria-hidden="true" />
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
              : `${item.label}: abre no ${TIERS_PAGOS[tierNecessario].titulo}`;
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

        {/* Rodapé: config, sair e, no modo recolhido, o botão de expandir */}
        <div className="flex flex-col gap-0.5 border-t border-[var(--line)] px-2 py-2">
          {/* Tutorial narrado (07/10/2026): fica sempre à mão pra quando bater a dúvida. */}
          <Link
            to="/como-usar"
            onClick={onNavigate}
            aria-current={tutorialAtivo ? "page" : undefined}
            className={`flex min-h-11 md:min-h-8 items-center gap-3 rounded-lg px-3 text-[13px] no-underline transition-colors ${
              tutorialAtivo
                ? "bg-[var(--secondary-light)] font-medium text-[var(--ink)]"
                : "text-[var(--ink-soft)] hover:bg-[var(--bg)]"
            } ${compact ? "justify-center" : ""}`}
          >
            <PlayCircle size={18} aria-hidden="true" />
            <span className={compact ? "sr-only" : undefined}>Tutorial</span>
          </Link>
          <Link
            to="/configuracoes"
            onClick={onNavigate}
            aria-current={configAtiva ? "page" : undefined}
            className={`flex min-h-11 md:min-h-8 items-center gap-3 rounded-lg px-3 text-[13px] no-underline transition-colors ${
              configAtiva
                ? "bg-[var(--secondary-light)] font-medium text-[var(--ink)]"
                : "text-[var(--ink-soft)] hover:bg-[var(--bg)]"
            } ${compact ? "justify-center" : ""}`}
          >
            <Settings size={18} aria-hidden="true" />
            <span className={compact ? "sr-only" : undefined}>Configurações</span>
          </Link>
          <button
            type="button"
            onClick={signOut}
            data-track="sair_clicado"
            className={`flex min-h-11 md:min-h-8 items-center gap-3 rounded-lg px-3 text-left text-[13px] text-[var(--ink-soft)] hover:bg-[var(--bg)] ${compact ? "justify-center" : ""}`}
          >
            <LogOut size={18} aria-hidden="true" />
            <span className={compact ? "sr-only" : undefined}>Sair</span>
          </button>
          {compact && (
            <button
              type="button"
              onClick={() => onCollapsedChange(false)}
              aria-label="Expandir menu"
              className="hidden md:flex min-h-11 items-center justify-center rounded-lg px-3 text-[var(--muted)] hover:bg-[var(--bg)]"
            >
              <ChevronsRight size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Enquanto false, a largura da sidebar vem só da classe CSS
  // `.sidebar-largura` (ver styles.css) — que já nasce no tamanho certo via
  // media query, sem depender do JS. Assim que o `useEffect` abaixo confirma
  // o breakpoint real, passamos a aplicar `width` inline (que sobrepõe a
  // media query) pra manter a interatividade de expandir/colapsar manual;
  // como os dois valores concordam nesse momento, a troca não causa salto.
  const [breakpointConfirmado, setBreakpointConfirmado] = useState(false);

  // ≤1366px: colapsa para ícones automaticamente.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 1366px)");
    const apply = () => {
      setCollapsed(mq.matches);
      setBreakpointConfirmado(true);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <>
      {/* Sidebar fixa — desktop/tablet */}
      <aside
        className="polia-v3 sidebar-largura sticky top-0 hidden h-screen flex-shrink-0 border-r border-[var(--line)] bg-[var(--surface)] md:block"
        style={breakpointConfirmado ? { width: collapsed ? 64 : 232 } : undefined}
      >
        <Body compact={collapsed} onCollapsedChange={setCollapsed} />
      </aside>

      {/* Mobile — hambúrguer + drawer */}
      <div className="polia-v3 sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-3 md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Abrir menu"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--ink)] hover:bg-[var(--bg)]"
            >
              <Menu size={22} aria-hidden="true" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="polia-v3 w-64 bg-[var(--surface)] p-0"
            style={TOKEN_BRIDGE_V3}
          >
            <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
            <Body
              compact={false}
              onNavigate={() => setMobileOpen(false)}
              onCollapsedChange={setCollapsed}
            />
          </SheetContent>
        </Sheet>
        <PoliaWordmark className="h-[18px] w-auto text-[var(--ink)]" />
      </div>
    </>
  );
}
