import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { PlaceholderImage } from "@/components/PlaceholderImage";
import { useUserMeta } from "@/hooks/useUserMeta";

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

/**
 * Header global das rotas autenticadas.
 * Aceita `initial` e `streak` por compatibilidade, mas a fonte real
 * vem de useUserMeta — garante consistência entre rotas.
 */
export function PainelNav({
  navActive = "/painel",
}: {
  initial?: string;
  streak?: number;
  navActive?: string;
}) {
  const meta = useUserMeta();
  const streak = meta.streak;

  return (
    <header
      className="sticky top-0 z-30 h-14 w-full bg-[#FDF8F5]"
      style={{ borderBottom: "1px solid rgba(26,26,46,0.08)" }}
    >
      <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-6">
        {/* Logo */}
        <PlaceholderImage
          slot="logo-header"
          width={120}
          height={32}
          description="logo Pólia"
          rounded={6}
        />

        {/* Links */}
        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => {
            const isActive = navActive === l.to || navActive.startsWith(l.to + "/");
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
              background:
                streak > 0 ? "rgba(201,107,62,0.10)" : "rgba(26,26,46,0.05)",
              border:
                streak > 0
                  ? "1px solid rgba(201,107,62,0.25)"
                  : "1px solid rgba(26,26,46,0.10)",
            }}
          >
            <span
              className="font-sans text-[13px] font-semibold"
              style={{
                color: streak > 0 ? "#C96B3E" : "rgba(26,26,46,0.55)",
              }}
            >
              {streak} {streak === 1 ? "dia" : "dias"}
            </span>
          </div>
          <AvatarMenu initial={meta.initial} isAdmin={meta.isAdmin} avatarUrl={meta.avatarUrl} />
        </div>
      </div>
    </header>
  );
}

function AvatarMenu({
  initial,
  isAdmin,
  avatarUrl,
}: {
  initial: string;
  isAdmin: boolean;
  avatarUrl: string | null;
}) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth/login" });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Abrir menu"
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-polia-terracota font-sans text-[14px] font-bold text-polia-creme outline-none focus-visible:ring-2 focus-visible:ring-polia-terracota/40"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <PlaceholderImage
              slot="foto-perfil"
              width={36}
              height={36}
              rounded={999}
              fit="cover"
            />
          )}
          {!avatarUrl && (
            <span style={{ display: "none" }}>{initial}</span>
          )}
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
