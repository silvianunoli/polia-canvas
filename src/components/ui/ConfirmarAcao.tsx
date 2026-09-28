import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TOKEN_BRIDGE_V3 } from "@/lib/uiTokenBridge";

interface ConfirmarAcaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descricao?: ReactNode;
  textoConfirmar?: string;
  textoCancelar?: string;
  onConfirmar: () => void;
  /** Se true, o botão de confirmar usa --danger em vez de --secondary. */
  destrutivo?: boolean;
  /**
   * Desabilita os dois botões enquanto onConfirmar ainda está em andamento —
   * evita duplo clique num pedido que demora (mesmo cuidado de
   * `desconectarMutation.isPending` em calendario.tsx). Opcional: quem chama
   * uma ação síncrona pode ignorar essa prop.
   */
  carregando?: boolean;
}

/**
 * Substitui window.confirm() (auditoria de set/2026 encontrou 5 usos nativos)
 * compondo API mais simples por cima do AlertDialog do shadcn já instalado —
 * mesma composição (polia-v3 + TOKEN_BRIDGE_V3, botão --secondary/--danger) já
 * usada em calendario.tsx (desconectar Google Calendar) e planner.$slug.tsx
 * (concluir tarefa).
 */
export function ConfirmarAcao({
  open,
  onOpenChange,
  titulo,
  descricao,
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  onConfirmar,
  destrutivo = false,
  carregando = false,
}: ConfirmarAcaoProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="polia-v3 rounded-xl border border-[var(--line)] bg-white"
        style={TOKEN_BRIDGE_V3}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[var(--ink)]">{titulo}</AlertDialogTitle>
          {descricao && (
            <AlertDialogDescription className="text-[var(--ink-soft)]">
              {descricao}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={carregando}
            className="rounded-lg border border-[var(--line)] bg-white text-[var(--ink-soft)] hover:bg-[var(--surface)]"
          >
            {textoCancelar}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmar}
            disabled={carregando}
            className={
              destrutivo
                ? "rounded-lg bg-[var(--danger)] text-white hover:opacity-90"
                : "rounded-lg bg-[var(--secondary)] text-[var(--secondary-ink)] hover:opacity-90"
            }
          >
            {textoConfirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
