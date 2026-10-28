import { useState, type DragEvent } from "react";
import { ArrowRight } from "lucide-react";
import { fmt } from "@/components/produtos/tipos";
import { BTN_ACAO, BTN_MIUDO } from "@/lib/botoes";
import { lucroDaVenda } from "@/lib/vendas";
import { ROTULO_ANDAMENTO, proximoAndamento, rotuloEntrega } from "@/lib/pedidos";
import type { PedidoLinha } from "./dados";

function resumoDosItens(p: Pick<PedidoLinha, "itens">): string {
  return p.itens
    .map((i) => `${i.quantidade}x ${i.produtoNome}${i.variacao ? ` ${i.variacao}` : ""}`)
    .join(", ");
}

/**
 * Cartão do quadro de Pedidos (wireframe em docs/plano-quadro-de-pedidos.md):
 * cliente, itens, total e lucro, entrega (ou o atraso), pago ou a receber e o
 * botão de avançar. Entregue ainda a receber pergunta se o dinheiro entrou.
 */
export function CartaoPedido({
  pedido,
  hoje,
  ocupado,
  onAvancar,
  onAbrir,
  onReceber,
  onDragStart,
}: {
  pedido: PedidoLinha;
  hoje: string;
  ocupado: boolean;
  onAvancar: () => void;
  onAbrir: () => void;
  onReceber: () => void;
  onDragStart: (e: DragEvent<HTMLLIElement>) => void;
}) {
  const [adiouReceber, setAdiouReceber] = useState(false);
  const entrega = rotuloEntrega(pedido, hoje);
  const proxima = proximoAndamento(pedido.andamento);
  const lucro = lucroDaVenda(pedido);
  const perguntaReceber = pedido.andamento === "entregue" && pedido.status === "a_receber";

  return (
    <li
      draggable={!ocupado}
      onDragStart={onDragStart}
      aria-busy={ocupado || undefined}
      className="rounded-xl border border-[var(--line)] bg-white p-3 text-[14px]"
    >
      <button
        type="button"
        onClick={onAbrir}
        className="block w-full rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
      >
        <span className="block font-medium text-[var(--ink)]">
          {pedido.clienteNome || "Sem nome"}
        </span>
        <span className="mt-0.5 block text-[var(--ink-soft)]">{resumoDosItens(pedido)}</span>
        <span className="mt-1 block text-[var(--ink)]">
          {fmt(pedido.total)}
          {lucro != null && (
            <span className="text-[var(--muted)]">
              {" "}
              · lucra {fmt(Math.round(lucro * 100) / 100)}
            </span>
          )}
        </span>
        <span
          className={`mt-1 block text-[13px] ${
            entrega.atrasado ? "font-medium text-[var(--danger)]" : "text-[var(--muted)]"
          }`}
        >
          {entrega.texto}
        </span>
        <span className="block text-[13px] text-[var(--muted)]">
          {pedido.status === "recebida" ? "pago" : "a receber"}
        </span>
      </button>

      {perguntaReceber && !adiouReceber ? (
        <div className="mt-3 border-t border-[var(--line)] pt-3">
          <p className="text-[13px] text-[var(--ink)]">Entregue. O dinheiro já entrou?</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="button" onClick={onReceber} disabled={ocupado} className={BTN_ACAO}>
              {ocupado ? "Lançando..." : "Sim, lançar no Financeiro"}
            </button>
            <button
              type="button"
              onClick={() => setAdiouReceber(true)}
              className="min-h-11 text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
            >
              Ainda não
            </button>
          </div>
        </div>
      ) : (
        proxima && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={onAvancar}
              disabled={ocupado}
              aria-label={`Mover pedido de ${pedido.clienteNome || "sem nome"} pra ${ROTULO_ANDAMENTO[proxima]}`}
              className={`${BTN_MIUDO} min-h-11 min-w-11`}
            >
              {ocupado ? "..." : <ArrowRight size={16} aria-hidden="true" />}
            </button>
          </div>
        )
      )}
    </li>
  );
}
