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
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
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
  /** Se true, o confirmar vira contorno com borda e texto --danger (forma de
   *  BTN_ACAO_CONTORNO), em vez do preenchido turquesa de BTN_ACAO. */
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
            className={`${BTN_ACAO_CONTORNO} h-auto bg-white shadow-none hover:bg-white hover:text-[var(--ink)]`}
          >
            {textoCancelar}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmar}
            disabled={carregando}
            aria-busy={carregando}
            className={
              destrutivo
                ? `${BTN_ACAO_CONTORNO} h-auto border-[var(--danger)] bg-white text-[var(--danger)] shadow-none hover:bg-[var(--danger-soft)]`
                : `${BTN_ACAO} h-auto shadow-none hover:bg-[var(--secondary)]`
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
