import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

interface NavLinkItem {
  to: string;
  label: string;
  exists: boolean;
}

const links: NavLinkItem[] = [
  { to: "/painel", label: "Painel", exists: true },
  { to: "/jornada", label: "Jornada", exists: true },
  { to: "/tarefas", label: "Tarefas", exists: true },
  { to: "/clientes", label: "Clientes", exists: true },
  { to: "/vitrine", label: "Vitrine", exists: true },
  { to: "/financeiro", label: "Financeiro", exists: false },
  { to: "/biblioteca", label: "Biblioteca", exists: true },
];


export function PainelNav({
  initial,
  streak,
  navActive = "/painel",
}: {
  initial: string;
  streak: number;
  navActive?: string;
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
            const isActive = l.to === navActive;

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
          <AvatarMenu initial={initial} />
        </div>
      </div>
    </header>
  );
}

function AvatarMenu({ initial }: { initial: string }) {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();
      if (active && data?.is_admin) setIsAdmin(true);
    })();
    return () => { active = false; };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth/login" });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Abrir menu"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-polia-terracota font-sans text-[14px] font-bold text-polia-creme outline-none focus-visible:ring-2 focus-visible:ring-polia-terracota/40"
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
          className="font-sans text-[14px] text-[#1A1A2E] px-3 py-2 rounded-lg cursor-pointer focus:bg-[rgba(26,26,46,0.04)]"
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
          className="font-sans text-[14px] text-[#1A1A2E] opacity-70 px-3 py-2 rounded-lg cursor-pointer focus:bg-[rgba(26,26,46,0.04)]"
        >
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
