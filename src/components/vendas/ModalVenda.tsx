import { useState } from "react";
import { hojeISO } from "@/lib/data.functions";
import { toastErro, toastSucesso } from "@/lib/toast";
import { Modal } from "@/components/ui/Modal";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { fmt, fmtData } from "@/components/produtos/tipos";
import { CANAL_LABEL, lucroDaVenda, valorRecebidoDaVenda } from "@/lib/vendas";
import { cancelarVenda, receberVenda, type VendaLinha } from "./dados";

const STATUS_LABEL = {
  recebida: "Recebida",
  a_receber: "A receber",
  cancelada: "Cancelada",
} as const;

/** Detalhe de uma venda: marcar como recebida ou cancelar. */
export function ModalVenda({
  venda,
  onClose,
  onMudou,
}: {
  venda: VendaLinha;
  onClose: () => void;
  onMudou: () => void;
}) {
  const [recebendo, setRecebendo] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const lucro = lucroDaVenda(venda);

  const receber = async () => {
    setRecebendo(true);
    const { error } = await receberVenda(venda.id, hojeISO());
    setRecebendo(false);
    if (error) {
      console.error("venda_receber", error);
      toastErro("A Pólia One não conseguiu marcar como recebida. Tenta de novo.");
      return;
    }
    toastSucesso("Venda recebida e lançada no Financeiro.");
    onMudou();
  };

  const cancelar = async () => {
    setCancelando(true);
    const { error } = await cancelarVenda(venda.id);
    setCancelando(false);
    if (error) {
      console.error("venda_cancelar", error);
      toastErro("A Pólia One não conseguiu cancelar a venda. Nada mudou, tenta de novo.");
      return;
    }
    setConfirmarCancelar(false);
    toastSucesso("Venda cancelada. O estoque e o Financeiro voltaram.");
    onMudou();
  };

  const linhas: [string, string][] = [
    ["Data", fmtData(venda.data)],
    ["Por onde", CANAL_LABEL[venda.canal]],
    ["Cliente", venda.clienteNome ?? "sem cliente"],
    ["Situação", STATUS_LABEL[venda.status]],
  ];

  return (
    <>
      <Modal
        open
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        title={`Venda de ${fmtData(venda.data)}`}
        footer={
          venda.status === "cancelada" ? (
            <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
              Fechar
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmarCancelar(true)}
                className="mr-auto inline-flex min-h-11 items-center px-1 text-[14px] font-medium text-[var(--danger)] hover:underline"
              >
                Cancelar venda
              </button>
              <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
                Fechar
              </button>
              {venda.status === "a_receber" && (
                <button type="button" onClick={receber} disabled={recebendo} className={BTN_ACAO}>
                  {recebendo ? "Salvando…" : "Marcar como recebida"}
                </button>
              )}
            </>
          )
        }
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[14px]">
          {linhas.map(([rotulo, valor]) => (
            <div key={rotulo} className="contents">
              <dt className="text-[var(--muted)]">{rotulo}</dt>
              <dd className="text-[var(--ink)]">{valor}</dd>
            </div>
          ))}
        </dl>

        <ul className="mt-4 border-t border-[var(--line)] pt-3 text-[14px]">
          {venda.itens.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-3 py-1">
              <span className="text-[var(--ink)]">
                {i.quantidade}x {i.produtoNome}
                {i.variacao ? ` · ${i.variacao}` : ""}
              </span>
              <span className="text-[var(--ink-soft)]">{fmt(i.quantidade * i.precoUnitario)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-3 border-t border-[var(--line)] pt-3 text-[14px]">
          {venda.desconto > 0 && <Linha rotulo="Desconto" valor={`-${fmt(venda.desconto)}`} />}
          {venda.frete > 0 && <Linha rotulo="Frete cobrado" valor={fmt(venda.frete)} />}
          <Linha rotulo="Total" valor={fmt(venda.total)} forte />
          {venda.taxaCanal > 0 && <Linha rotulo="Taxa" valor={`-${fmt(venda.taxaCanal)}`} />}
          {venda.status !== "cancelada" && (
            <Linha
              rotulo={
                venda.status === "recebida" ? "Entrou no Financeiro" : "Vai entrar no Financeiro"
              }
              valor={fmt(valorRecebidoDaVenda(venda))}
            />
          )}
          {venda.status !== "cancelada" && (
            <Linha
              rotulo="A marca lucrou"
              valor={lucro == null ? "sem custo cadastrado" : fmt(lucro)}
            />
          )}
        </dl>

        {venda.observacao && (
          <p className="mt-3 text-[13px] text-[var(--ink-soft)]">{venda.observacao}</p>
        )}
      </Modal>

      <ConfirmarAcao
        open={confirmarCancelar}
        onOpenChange={(open) => {
          if (!open) setConfirmarCancelar(false);
        }}
        titulo="Cancelar esta venda?"
        descricao="Os itens voltam pro estoque e o lançamento sai do Financeiro. A venda continua na lista como cancelada."
        textoConfirmar="Cancelar venda"
        textoCancelar="Manter venda"
        textoCarregando="Cancelando…"
        onConfirmar={cancelar}
        carregando={cancelando}
      />
    </>
  );
}

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <dt className="text-[var(--muted)]">{rotulo}</dt>
      <dd className={forte ? "font-semibold text-[var(--ink)]" : "text-[var(--ink)]"}>{valor}</dd>
    </div>
  );
}
