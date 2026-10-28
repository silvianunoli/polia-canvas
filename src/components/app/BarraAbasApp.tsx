import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Calculator, ClipboardList, Ellipsis, Home, Plus } from "lucide-react";
import { MenuRegistrarApp } from "@/components/app/MenuRegistrarApp";

// Barra de abas do app Android (AND-07, wireframe aprovado em 28/10/2026).
// Substitui o menu lateral só dentro do app: Hoje, Calcular, o + no meio
// (venda, pedido, gasto), Pedidos e Mais (o resto da Pólia One). Pedidos
// entrou no lugar do Planner em 28/10/2026, quando o Planner virou ferramenta interna.
// Hoje é o Painel enxuto (/hoje); o Painel completo também acende a aba Hoje.

const ABAS = [
  { to: "/hoje", label: "Hoje", icon: Home },
  { to: "/calculadora", label: "Calcular", icon: Calculator },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/mais", label: "Mais", icon: Ellipsis },
] as const;

function ativa(to: string, pathname: string) {
  if (to === "/hoje" && pathname === "/painel") return true;
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Altura da barra sem a área do sistema; a página reserva esse espaço embaixo. */
export const ALTURA_BARRA_APP = 64;

export function BarraAbasApp({
  pathname,
  userId,
  plano,
}: {
  pathname: string;
  userId: string | undefined;
  plano: string | null;
}) {
  const [registrarAberto, setRegistrarAberto] = useState(false);

  const aba = (item: (typeof ABAS)[number]) => {
    const Icon = item.icon;
    const atual = ativa(item.to, pathname);
    return (
      <Link
        key={item.to}
        to={item.to}
        aria-current={atual ? "page" : undefined}
        className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg font-sans text-[11px] no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ink)] ${
          atual ? "font-medium text-[var(--ink)]" : "text-[var(--muted)]"
        }`}
      >
        <Icon size={22} strokeWidth={atual ? 2.25 : 1.75} aria-hidden="true" />
        {item.label}
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label="Navegação do app"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--bg)] px-2 pb-[env(safe-area-inset-bottom)]"
      >
        <div
          className="mx-auto flex max-w-[560px] items-center"
          style={{ height: ALTURA_BARRA_APP }}
        >
          {aba(ABAS[0])}
          {aba(ABAS[1])}
          <div className="flex flex-1 justify-center">
            <button
              type="button"
              aria-label="Registrar venda, pedido ou gasto"
              aria-haspopup="dialog"
              aria-expanded={registrarAberto}
              onClick={() => setRegistrarAberto(true)}
              disabled={!userId}
              className="flex h-12 w-12 items-center justify-center rounded-xl border-[1.5px] border-[var(--ink)] bg-[var(--secondary)] text-[var(--secondary-ink)] transition-transform active:scale-[0.95] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:opacity-60"
            >
              <Plus size={24} aria-hidden="true" />
            </button>
          </div>
          {aba(ABAS[2])}
          {aba(ABAS[3])}
        </div>
      </nav>
      {userId && (
        <MenuRegistrarApp
          aberto={registrarAberto}
          onOpenChange={setRegistrarAberto}
          userId={userId}
          plano={plano}
        />
      )}
    </>
  );
}
