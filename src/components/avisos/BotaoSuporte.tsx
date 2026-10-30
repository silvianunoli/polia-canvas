import { Link } from "@tanstack/react-router";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { BookOpen, LifeBuoy, MessageSquarePlus, MessagesSquare } from "lucide-react";
import { TOKEN_BRIDGE_V3 } from "@/lib/uiTokenBridge";

// Suporte à vista no topo (ONE-152). Antes só existia em Configurações > Ajuda,
// a sétima seção da página. "Abrir um chamado" já chega com o formulário aberto.

const ITEM =
  "flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-[14px] text-[var(--ink)] no-underline outline-none transition-colors duration-150 data-[highlighted]:bg-[var(--surface)]";

export function BotaoSuporte({ compacto = false }: { compacto?: boolean }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        type="button"
        aria-label={compacto ? "Suporte" : undefined}
        className={`inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-white text-[14px] font-medium text-[var(--ink)] transition-colors duration-150 hover:border-[var(--secondary)] hover:bg-[var(--secondary-light)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--secondary-text)] data-[state=open]:border-[var(--secondary)] data-[state=open]:bg-[var(--secondary-light)] ${
          compacto ? "w-11" : "px-4"
        }`}
      >
        <LifeBuoy size={18} aria-hidden="true" />
        {!compacto && "Suporte"}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className="polia-v3 z-50 min-w-[220px] overflow-hidden rounded-lg border border-[var(--line)] bg-white py-1 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:duration-[200ms] data-[state=closed]:duration-[150ms]"
          style={TOKEN_BRIDGE_V3}
        >
          <DropdownMenu.Item asChild>
            <Link to="/chamados" search={{ novo: 1 }} className={ITEM}>
              <MessageSquarePlus size={16} aria-hidden="true" />
              Abrir um chamado
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link to="/chamados" className={ITEM}>
              <MessagesSquare size={16} aria-hidden="true" />
              Seus chamados
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <a href="/ajuda" className={ITEM}>
              <BookOpen size={16} aria-hidden="true" />
              Central de ajuda
            </a>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
