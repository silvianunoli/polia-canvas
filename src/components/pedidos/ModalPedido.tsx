import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Campo } from "@/components/ui/Campo";
import { fmt } from "@/components/produtos/tipos";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { ANDAMENTOS, ROTULO_ANDAMENTO, rotuloEntrega, type AndamentoPedido } from "@/lib/pedidos";
import { EtiquetaDoPedido } from "./EtiquetaDoPedido";
import type { PedidoLinha } from "./dados";
import {
  FORMAS_RECEBIMENTO,
  ROTULO_TAXA,
  regraEstaVazia,
  taxaDaVenda,
  type FormaRecebimento,
} from "@/lib/taxas";
import {
  ehFormaDeRecebimento,
  liquidoDoPedido,
  pagamentoVemDoCanal,
  rotuloDaTaxa,
  rotuloDoPagamento,
} from "@/lib/pagamentoPedido";
import { num } from "@/components/produtos/tipos";
import { useTaxas } from "@/components/vendas/taxasDados";

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
  onPagamento,
  onClose,
  userId,
}: {
  pedido: PedidoLinha;
  hoje: string;
  ocupado: boolean;
  erro: string | null;
  onMover: (e: AndamentoPedido) => void;
  onRemarcar: (data: string) => void;
  onReceber: () => void;
  onCancelar: () => void;
  /** Grava forma e taxa (pedido anotado à mão ou da Vitrine); devolve se salvou. */
  onPagamento: (forma: FormaRecebimento | null, taxa: number) => Promise<boolean>;
  onClose: () => void;
  userId: string | undefined;
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

        <BlocoPagamento
          pedido={pedido}
          ocupado={ocupado}
          onPagamento={onPagamento}
          userId={userId}
        />

        {pedido.canal === "site" && <EtiquetaDoPedido vendaId={pedido.id} />}

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

/**
 * Pagamento do pedido (23/11/2026, desenho aprovado pela Sil). Loja da marca
 * e marketplace chegam prontos do canal e só aparecem. Anotado à mão e Vitrine
 * escolhem a forma aqui; trocar a forma refaz a taxa pela regra dela, a menos
 * que a taxa tenha sido digitada.
 */
function BlocoPagamento({
  pedido,
  ocupado,
  onPagamento,
  userId,
}: {
  pedido: PedidoLinha;
  ocupado: boolean;
  onPagamento: (forma: FormaRecebimento | null, taxa: number) => Promise<boolean>;
  userId: string | undefined;
}) {
  const fixo = pagamentoVemDoCanal(pedido.canal);
  const formaSalva: FormaRecebimento | "" = ehFormaDeRecebimento(pedido.forma) ? pedido.forma : "";
  const taxaSalva = pedido.taxaCanal > 0 ? String(pedido.taxaCanal) : "";
  const [forma, setForma] = useState<FormaRecebimento | "">(formaSalva);
  const [taxa, setTaxa] = useState(taxaSalva);
  const [taxaDigitada, setTaxaDigitada] = useState(false);
  const taxasQuery = useTaxas(fixo ? undefined : userId);

  const valorDaTaxa = num(taxa);
  const taxaInvalida =
    !Number.isFinite(valorDaTaxa) ||
    valorDaTaxa < 0 ||
    (pedido.total > 0 && valorDaTaxa >= pedido.total);
  const mudou = forma !== formaSalva || taxa.trim() !== taxaSalva;

  if (fixo) {
    return (
      <div className="border-t border-[var(--line)] pt-4">
        <p className="mb-1 text-[12px] font-medium text-[var(--ink-soft)]">Pagamento</p>
        <p className="text-[var(--ink)]">{rotuloDoPagamento(pedido.canal, pedido.forma)}</p>
        <p className="text-[var(--ink-soft)]">
          {rotuloDaTaxa(pedido.canal)}: {fmt(pedido.taxaCanal)} · fica{" "}
          {fmt(liquidoDoPedido(pedido.total, pedido.taxaCanal))}
        </p>
      </div>
    );
  }

  const trocarForma = (nova: FormaRecebimento | "") => {
    setForma(nova);
    if (taxaDigitada || !nova || !taxasQuery.isSuccess) return;
    const regra = taxasQuery.data?.[nova];
    if (!regraEstaVazia(regra)) {
      const valor = taxaDaVenda(pedido.total, regra);
      setTaxa(valor > 0 ? String(valor) : "");
    }
  };

  const salvar = async () => {
    if (taxaInvalida || !mudou) return;
    const ok = await onPagamento(forma || null, Math.round(valorDaTaxa * 100) / 100);
    if (ok) setTaxaDigitada(false);
  };

  return (
    <div className="border-t border-[var(--line)] pt-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Forma de pagamento">
          <select
            value={forma}
            disabled={ocupado}
            onChange={(e) => trocarForma(e.target.value as FormaRecebimento | "")}
            className={INPUT}
          >
            <option value="">A definir</option>
            {FORMAS_RECEBIMENTO.map((f) => (
              <option key={f} value={f}>
                {ROTULO_TAXA[f]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          label={`${rotuloDaTaxa(pedido.canal)} (R$)`}
          hint={
            taxaInvalida
              ? undefined
              : `Fica ${fmt(liquidoDoPedido(pedido.total, valorDaTaxa))} do total de ${fmt(pedido.total)}.`
          }
          error={
            taxaInvalida ? "A taxa precisa ser de 0 até menos que o total do pedido." : undefined
          }
        >
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={taxa}
            disabled={ocupado}
            onChange={(e) => {
              setTaxa(e.target.value);
              setTaxaDigitada(true);
            }}
            className={INPUT}
            placeholder="0"
          />
        </Campo>
      </div>
      {mudou && (
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={ocupado || taxaInvalida}
          className={`${BTN_MIUDO} mt-2 min-h-11`}
        >
          {ocupado ? "Salvando..." : "Salvar o pagamento"}
        </button>
      )}
    </div>
  );
}
