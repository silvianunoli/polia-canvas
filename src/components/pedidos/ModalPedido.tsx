import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Campo } from "@/components/ui/Campo";
import { fmt } from "@/components/produtos/tipos";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { ANDAMENTOS, ROTULO_ANDAMENTO, rotuloEntrega, type AndamentoPedido } from "@/lib/pedidos";
import type { PedidoLinha } from "./dados";

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[16px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none sm:text-[14px]";

/**
 * Detalhe do pedido: itens, andamento (o caminho por teclado e no celular, sem
 * arrastar), nova data de entrega, receber e cancelar. Cancelar devolve o
 * estoque e tira o lançamento do Financeiro (cancelar_venda de sempre).
 */
export function ModalPedido({
  pedido,
  hoje,
  ocupado,
  erro,
  onMover,
  onRemarcar,
  onReceber,
  onCancelar,
  onClose,
}: {
  pedido: PedidoLinha;
  hoje: string;
  ocupado: boolean;
  erro: string | null;
  onMover: (e: AndamentoPedido) => void;
  onRemarcar: (data: string) => void;
  onReceber: () => void;
  onCancelar: () => void;
  onClose: () => void;
}) {
  const [data, setData] = useState(pedido.entregaEm);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const entrega = rotuloEntrega(pedido, hoje);

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={pedido.clienteNome ? `Pedido de ${pedido.clienteNome}` : "Pedido"}
      footer={
        <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
          Fechar
        </button>
      }
    >
      <div className="space-y-5 text-[14px]">
        <ul className="space-y-1 text-[var(--ink)]">
          {pedido.itens.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-4">
              <span>
                {i.quantidade}x {i.produtoNome}
                {i.variacao ? ` ${i.variacao}` : ""}
              </span>
              <span>{fmt(i.quantidade * i.precoUnitario)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-4 border-t border-[var(--line)] pt-1 font-medium">
            <span>Total</span>
            <span>{fmt(pedido.total)}</span>
          </li>
        </ul>

        <Campo label="Andamento">
          <select
            value={pedido.andamento}
            disabled={ocupado}
            onChange={(e) => onMover(e.target.value as AndamentoPedido)}
            className={INPUT}
          >
            {ANDAMENTOS.map((e) => (
              <option key={e} value={e}>
                {ROTULO_ANDAMENTO[e]}
              </option>
            ))}
          </select>
        </Campo>

        <div>
          <Campo label="Entrega" hint={entrega.texto}>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className={INPUT}
            />
          </Campo>
          {data && data !== pedido.entregaEm && (
            <button
              type="button"
              onClick={() => onRemarcar(data)}
              disabled={ocupado}
              className={`${BTN_MIUDO} mt-2 min-h-11`}
            >
              {ocupado ? "Salvando..." : "Salvar a nova data"}
            </button>
          )}
        </div>

        <div className="border-t border-[var(--line)] pt-4">
          {pedido.status === "a_receber" ? (
            <>
              <p className="text-[var(--ink-soft)]">O pagamento ainda não entrou.</p>
              <button
                type="button"
                onClick={onReceber}
                disabled={ocupado}
                className={`${BTN_ACAO} mt-2`}
              >
                {ocupado ? "Lançando..." : "Recebi, lançar no Financeiro"}
              </button>
            </>
          ) : (
            <p className="text-[var(--ink-soft)]">Pago e lançado no Financeiro.</p>
          )}
        </div>

        <div className="border-t border-[var(--line)] pt-4">
          {confirmarCancelar ? (
            <div role="alert">
              <p className="text-[var(--ink)]">
                Cancelar devolve os itens pro estoque e tira o valor do Financeiro. O pedido sai do
                quadro.
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                <button
                  type="button"
                  onClick={onCancelar}
                  disabled={ocupado}
                  className={`${BTN_ACAO_CONTORNO} !border-[var(--danger)] !text-[var(--danger)]`}
                >
                  {ocupado ? "Cancelando..." : "Cancelar o pedido"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmarCancelar(false)}
                  className="min-h-11 text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
                >
                  Manter
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmarCancelar(true)}
              className="min-h-11 text-[13px] font-medium text-[var(--danger)] hover:underline"
            >
              Cancelar pedido
            </button>
          )}
        </div>

        {erro && (
          <p role="alert" className="text-[13px] text-[var(--danger)]">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  );
}
