import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
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
  /**
   * Síncrono: o diálogo fecha logo depois (comportamento antigo).
   * Devolvendo Promise: o diálogo fica aberto, com os botões travados e o
   * texto de carregando, até ela terminar. Quem fecha é o chamador (no
   * sucesso); se falhar, o diálogo continua aberto pra tentar de novo.
   */
  onConfirmar: () => void | Promise<unknown>;
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

function ehPromessa(v: unknown): v is PromiseLike<unknown> {
  return !!v && typeof (v as { then?: unknown }).then === "function";
}

/**
 * Substitui window.confirm() (auditoria de set/2026 encontrou 5 usos nativos)
 * compondo API mais simples por cima do AlertDialog do shadcn já instalado —
 * mesma composição (polia-v3 + TOKEN_BRIDGE_V3, botão --secondary/--danger) já
 * usada em calendario.tsx (desconectar Google Calendar) e planner.$slug.tsx
 * (concluir tarefa).
 *
 * 08/10/2026: o AlertDialogAction do Radix fecha o diálogo no próprio clique.
 * Com isso o "Excluindo…" nunca aparecia (o diálogo sumia antes) e, durante a
 * animação de saída, o botão ainda aceitava um segundo clique: o cancelamento
 * de assinatura em Configurações podia ser disparado duas vezes. Agora o
 * clique não fecha sozinho (preventDefault), uma trava por ref barra o segundo
 * disparo na hora, e o diálogo só fecha quando o onConfirmar termina.
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
  const [rodando, setRodando] = useState(false);
  // O estado só muda no próximo render: um duplo clique rápido passaria pelos
  // dois handlers antes disso. A ref trava na hora.
  const disparouRef = useRef(false);

  // Cada abertura nova começa destravada.
  useEffect(() => {
    if (open) {
      disparouRef.current = false;
      setRodando(false);
    }
  }, [open]);

  const ocupado = carregando || rodando;

  const confirmar = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (disparouRef.current || ocupado) return;
    disparouRef.current = true;
    let resultado: void | Promise<unknown>;
    try {
      resultado = onConfirmar();
    } catch (erro) {
      disparouRef.current = false;
      throw erro;
    }
    if (!ehPromessa(resultado)) {
      onOpenChange(false);
      return;
    }
    setRodando(true);
    try {
      await resultado;
    } catch (erro) {
      // O chamador trata o próprio erro (toast); aqui só não deixa travado.
      console.error("confirmar_acao", erro);
    } finally {
      setRodando(false);
      // Se continuou aberto (falhou), libera pra tentar de novo.
      disparouRef.current = false;
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(proximo) => {
        // Esc e clique fora não fecham no meio do pedido.
        if (!proximo && ocupado) return;
        onOpenChange(proximo);
      }}
    >
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
            disabled={ocupado}
            className={`${BTN_ACAO_CONTORNO} h-auto bg-white shadow-none hover:bg-white hover:text-[var(--ink)]`}
          >
            {textoCancelar}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => void confirmar(e)}
            disabled={ocupado}
            aria-busy={ocupado}
            className={
              destrutivo
                ? `${BTN_ACAO_CONTORNO} h-auto border-[var(--danger)] bg-white text-[var(--danger)] shadow-none hover:bg-[var(--danger-soft)]`
                : `${BTN_ACAO} h-auto shadow-none hover:bg-[var(--secondary)]`
            }
          >
            <span role="status" aria-live="polite">
              {ocupado ? textoCarregando : textoConfirmar}
            </span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
