import type { ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { TOKEN_BRIDGE_V3 } from "@/lib/uiTokenBridge";

export interface MenuOpcoesItem {
  label: string;
  onClick: () => void;
  icone?: LucideIcon;
  destrutivo?: boolean;
  desabilitado?: boolean;
}

interface MenuOpcoesProps {
  itens: MenuOpcoesItem[];
  /** Conteúdo do gatilho. Sem essa prop, cai no ícone MoreHorizontal padrão. */
  trigger?: ReactNode;
  /**
   * Nome acessível do gatilho. Obrigatório quando `trigger` é passado (o
   * conteúdo customizado pode ser só um ícone, sem texto visível) — sem essa
   * prop nesse caso o botão fica sem nome nenhum pro leitor de tela. Sem
   * `trigger`, o padrão "Mais opções" já cobre o ícone MoreHorizontal.
   */
  ariaLabel?: string;
  align?: "start" | "end";
}

/**
 * Menu "···" pra substituir os menus reimplementados com useState cru (fecha
 * ao clicar fora com uma div fixed, sem fechar com Esc nem devolver foco —
 * auditoria de set/2026 encontrou 3+, ex: o menu de opções em produtos.tsx).
 * O gatilho é sempre um <button> de verdade renderizado pelo próprio
 * DropdownMenu.Trigger (sem asChild) — assim aria-haspopup/aria-expanded,
 * foco por teclado e Esc/clique-fora funcionam mesmo se `trigger` for só um
 * ícone solto, sem precisar que quem chama lembre de embrulhar num botão.
 */
export function MenuOpcoes({ itens, trigger, ariaLabel, align = "end" }: MenuOpcoesProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        type="button"
        aria-label={ariaLabel ?? (trigger ? undefined : "Mais opções")}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--surface)] hover:text-[var(--ink)] data-[state=open]:bg-[var(--surface)] data-[state=open]:text-[var(--ink)]"
      >
        {trigger ?? <MoreHorizontal size={18} aria-hidden="true" />}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={4}
          className="polia-v3 z-50 min-w-[168px] overflow-hidden rounded-lg border border-[var(--line)] bg-white py-1 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=open]:duration-[200ms] data-[state=closed]:duration-[150ms]"
          style={TOKEN_BRIDGE_V3}
        >
          {itens.map((item, indice) => {
            const Icone = item.icone;
            return (
              <DropdownMenu.Item
                key={`${item.label}-${indice}`}
                disabled={item.desabilitado}
                onSelect={() => item.onClick()}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-[14px] outline-none transition-colors duration-150 data-[highlighted]:bg-[var(--surface)] data-[disabled]:cursor-not-allowed data-[disabled]:text-[var(--muted)] data-[disabled]:hover:bg-transparent ${
                  item.destrutivo ? "text-[var(--danger)]" : "text-[var(--ink)]"
                }`}
              >
                {Icone && <Icone size={16} aria-hidden="true" />}
                {item.label}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
