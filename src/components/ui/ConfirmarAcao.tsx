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
  /** Texto do botão enquanto `carregando` é true. Default: "Confirmando…". */
  textoCarregando?: string;
  textoCancelar?: string;
  onConfirmar: () => void;
  /** Se true, o botão de confirmar usa --danger em vez de --secondary. */
  destrutivo?: boolean;
  /**
   * Desabilita os dois botões enquanto onConfirmar ainda está em andamento —
   * evita duplo clique num pedido que demora (mesmo cuidado de
   * `desconectarMutation.isPending` em calendario.tsx). Também troca o texto
   * do botão e anuncia a mudança pro leitor de tela (role="status"), pra não
   * ficar sem nenhum retorno perceptível durante o carregamento.
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
  textoCarregando = "Confirmando…",
  textoCancelar = "Cancelar",
  onConfirmar,
  destrutivo = false,
  carregando = false,
}: ConfirmarAcaoProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="polia-v3 rounded-xl border border-[var(--line)] bg-white shadow-none"
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
            className="rounded-lg border border-[var(--line)] bg-white text-[var(--ink-soft)] shadow-none hover:bg-[var(--surface)]"
          >
            {textoCancelar}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmar}
            disabled={carregando}
            aria-busy={carregando}
            className={
              destrutivo
                ? "rounded-lg bg-[var(--danger)] text-white shadow-none hover:bg-[var(--danger)] hover:opacity-90"
                : "rounded-lg bg-[var(--secondary)] text-[var(--secondary-ink)] shadow-none hover:bg-[var(--secondary)] hover:opacity-90"
            }
          >
            <span role="status" aria-live="polite">
              {carregando ? textoCarregando : textoConfirmar}
            </span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
