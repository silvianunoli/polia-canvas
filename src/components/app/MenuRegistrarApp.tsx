import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckSquare, ClipboardList, Lock, Receipt, ShoppingBag } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { ModalRegistrarVenda } from "@/components/vendas/ModalRegistrarVenda";
import { ModalLancamento } from "@/components/financeiro/ModalLancamento";
import { ModalNovaTarefaApp } from "@/components/app/ModalNovaTarefaApp";
import { ModalNovoPedido } from "@/components/pedidos/ModalNovoPedido";
import { useFerramentasInternas } from "@/hooks/useFerramentasInternas";
import { hojeISO } from "@/lib/data.functions";
import { recursoLiberado, tierPagoDaRota, TIERS_PAGOS } from "@/lib/planos";
import { toastSucesso } from "@/lib/toast";
import { TOKEN_BRIDGE_V3 } from "@/lib/uiTokenBridge";

// O + da barra de abas do app (AND-07): o que acontece no meio do dia, longe
// do computador. Cada opção abre o mesmo formulário da Pólia One completa
// (ModalRegistrarVenda, ModalNovoPedido, ModalLancamento), então a regra é uma só.
// Vendas é do Premium: no Grátis a opção aparece com cadeado e leva ao upgrade.
// Pedido abre em todo plano; o teto do Grátis é o próprio modal que explica.
// O gasto vale pra todos; no Grátis fica preso ao mês corrente, como no Painel.
// Nova tarefa só pra quem ainda tem o Planner (conta interna, desde 28/10/2026).

type Aberto = null | "venda" | "pedido" | "gasto" | "tarefa";

export function MenuRegistrarApp({
  aberto,
  onOpenChange,
  userId,
  plano,
}: {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  userId: string;
  plano: string | null;
}) {
  const qc = useQueryClient();
  const [formulario, setFormulario] = useState<Aberto>(null);
  const vendasLiberado = recursoLiberado("/vendas", plano);
  const financeiroLiberado = recursoLiberado("/financeiro", plano);
  const internas = useFerramentasInternas();

  function abrir(qual: Exclude<Aberto, null>) {
    onOpenChange(false);
    setFormulario(qual);
  }

  // Os modais de venda e de pedido já avisam sozinhos; o de lançamento não.
  function salvou(mensagem: string | null) {
    setFormulario(null);
    void qc.invalidateQueries();
    if (mensagem) toastSucesso(mensagem);
  }

  const opcao =
    "flex min-h-14 w-full items-center gap-3 rounded-xl border-[1.5px] border-[var(--ink)] bg-white px-4 text-left font-sans text-[15px] font-medium text-[var(--ink)] transition-transform active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]";

  return (
    <>
      <Sheet open={aberto} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="polia-v3 rounded-t-2xl bg-[var(--bg)] px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-6"
          style={TOKEN_BRIDGE_V3}
        >
          <SheetTitle className="font-cabinet text-[19px] text-[var(--ink)]">Registrar</SheetTitle>
          <SheetDescription className="sr-only">
            Escolha entre registrar uma venda, anotar um pedido ou lançar um gasto.
          </SheetDescription>
          <div className="mt-4 flex flex-col gap-3">
            {vendasLiberado ? (
              <button type="button" className={opcao} onClick={() => abrir("venda")}>
                <ShoppingBag size={20} aria-hidden="true" />
                Registrar venda
              </button>
            ) : (
              <Link
                to="/upgrade"
                search={{ rota: "/vendas", tier: tierPagoDaRota("/vendas") }}
                onClick={() => onOpenChange(false)}
                className={`${opcao} justify-between text-[var(--muted)] no-underline`}
              >
                <span className="flex items-center gap-3">
                  <ShoppingBag size={20} aria-hidden="true" />
                  Registrar venda
                </span>
                <span className="flex items-center gap-1 text-[12px] font-normal">
                  <Lock size={14} aria-hidden="true" />
                  {TIERS_PAGOS[tierPagoDaRota("/vendas")].titulo}
                </span>
              </Link>
            )}
            <button type="button" className={opcao} onClick={() => abrir("pedido")}>
              <ClipboardList size={20} aria-hidden="true" />
              Novo pedido
            </button>
            <button type="button" className={opcao} onClick={() => abrir("gasto")}>
              <Receipt size={20} aria-hidden="true" />
              Lançar gasto
            </button>
            {internas.planner && (
              <button type="button" className={opcao} onClick={() => abrir("tarefa")}>
                <CheckSquare size={20} aria-hidden="true" />
                Nova tarefa
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {formulario === "venda" && (
        <ModalRegistrarVenda
          userId={userId}
          onClose={() => setFormulario(null)}
          onSaved={() => salvou(null)}
        />
      )}
      {formulario === "pedido" && (
        <ModalNovoPedido
          userId={userId}
          onClose={() => setFormulario(null)}
          onSaved={() => salvou(null)}
        />
      )}
      {formulario === "gasto" && (
        <ModalLancamento
          userId={userId}
          tipoInicial="saida"
          dataPadrao={hojeISO()}
          prefill={null}
          lancamentoEdit={null}
          historico={[]}
          somenteMesCorrente={!financeiroLiberado}
          onClose={() => setFormulario(null)}
          onSaved={() => salvou("Gasto lançado.")}
        />
      )}
      {formulario === "tarefa" && (
        <ModalNovaTarefaApp userId={userId} onClose={() => setFormulario(null)} />
      )}
    </>
  );
}
