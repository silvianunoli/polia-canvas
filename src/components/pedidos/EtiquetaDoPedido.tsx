import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fmt } from "@/components/produtos/tipos";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { acaoEtiqueta, lerEtiquetaDoPedido } from "@/lib/envioLoja.functions";
import { recarregarDepoisDoPedido } from "./dados";

const ROTULO_RASTREIO = {
  postada: "Postada",
  entregue: "Entregue",
  problema: "Problema na entrega: confira no Melhor Envio",
} as const;

const LINK = "min-h-11 text-[13px] font-medium text-[var(--secondary-text)] hover:underline";

/**
 * Etiqueta do pedido pago na loja com frete (ONE-189). Primeiro mostra o custo e o saldo;
 * só o botão de pagar usa a carteira do Melhor Envio. Pedido sem frete não mostra nada.
 */
export function EtiquetaDoPedido({ vendaId }: { vendaId: string }) {
  const qc = useQueryClient();
  const { user } = useSupabaseSession();
  const chave = ["etiqueta-pedido", vendaId];
  const {
    data: etiqueta,
    isLoading,
    isError,
  } = useQuery({
    queryKey: chave,
    queryFn: () => lerEtiquetaDoPedido({ data: { vendaId } }),
  });
  const [saldo, setSaldo] = useState<number | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);

  const executar = async (
    acao: "preparar" | "comprar" | "imprimir" | "cancelar",
    aba: Window | null = null,
  ) => {
    setOcupado(acao);
    setErro(null);
    try {
      const r = await acaoEtiqueta({ data: { vendaId, acao } });
      if (!r.ok) {
        aba?.close();
        setErro(r.error);
      } else {
        if (acao === "preparar") setSaldo(r.saldo ?? null);
        if (acao === "cancelar") {
          setSaldo(undefined);
          setConfirmarCancelar(false);
        }
        if (aba) {
          if (r.url) aba.location.href = r.url;
          else {
            aba.close();
            setErro(
              "A etiqueta está pronta, mas o link de impressão não veio. Clique em Imprimir etiqueta.",
            );
          }
        }
        if (acao === "comprar" || acao === "cancelar") recarregarDepoisDoPedido(qc, user?.id);
      }
      await qc.invalidateQueries({ queryKey: chave });
    } catch {
      aba?.close();
      setErro("A Pólia One não conseguiu falar com o Melhor Envio agora. Tenta de novo.");
    } finally {
      setOcupado(null);
    }
  };

  // A aba abre no clique: depois de esperar a resposta, o navegador bloquearia.
  const comAba = (acao: "comprar" | "imprimir") => void executar(acao, window.open("", "_blank"));

  if (isLoading) return null;
  if (isError)
    return (
      <p
        role="alert"
        className="border-t border-[var(--line)] pt-4 text-[13px] text-[var(--danger)]"
      >
        A etiqueta deste pedido não carregou. Feche e abra o pedido de novo.
      </p>
    );
  if (!etiqueta) return null;

  const { status, custo } = etiqueta;
  const semSaldo = typeof saldo === "number" && custo != null && saldo < custo;
  const ocupadoAgora = ocupado !== null;

  return (
    <section
      aria-label="Etiqueta de envio"
      className="border-t border-[var(--line)] pt-4 text-[14px]"
    >
      <p className="font-medium text-[var(--ink)]">Etiqueta de envio</p>
      <p className="text-[var(--ink-soft)]">
        {[etiqueta.servico, etiqueta.empresa].filter(Boolean).join(", ")}
        {etiqueta.destino ? ` para ${etiqueta.destino}` : ""}. A cliente pagou{" "}
        {fmt(etiqueta.freteCobrado)} de frete.
      </p>

      {status === null && (
        <button
          type="button"
          onClick={() => void executar("preparar")}
          disabled={ocupadoAgora}
          className={`${BTN_ACAO} mt-2`}
        >
          {ocupado === "preparar" ? "Calculando..." : "Comprar etiqueta"}
        </button>
      )}

      {status === "carrinho" && custo != null && (
        <div className="mt-2">
          <p className="text-[var(--ink)]">
            Custo da etiqueta: <strong>{fmt(custo)}</strong>
            {typeof saldo === "number" && <> · Saldo na carteira: {fmt(saldo)}</>}
          </p>
          <p className="text-[13px] text-[var(--muted)]">
            Sai com declaração de conteúdo, paga com o saldo do Melhor Envio.
          </p>
          {saldo === undefined && (
            <button
              type="button"
              onClick={() => void executar("preparar")}
              disabled={ocupadoAgora}
              className={LINK}
            >
              {ocupado === "preparar" ? "Consultando..." : "Ver o saldo da carteira"}
            </button>
          )}
          {semSaldo && (
            <p role="alert" className="mt-1 text-[13px] text-[var(--danger)]">
              O saldo não cobre esta etiqueta.{" "}
              <a
                href="https://app.melhorenvio.com.br/melhor-carteira"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Colocar saldo no Melhor Envio
              </a>
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={() => comAba("comprar")}
              disabled={ocupadoAgora || semSaldo}
              className={BTN_ACAO}
            >
              {ocupado === "comprar" ? "Pagando..." : `Pagar ${fmt(custo)} e gerar`}
            </button>
            <button
              type="button"
              onClick={() => void executar("cancelar")}
              disabled={ocupadoAgora}
              className={LINK}
            >
              Desistir
            </button>
          </div>
        </div>
      )}

      {status === "paga" && (
        <div className="mt-2">
          <p className="text-[var(--ink-soft)]">A etiqueta foi paga e falta gerar.</p>
          <button
            type="button"
            onClick={() => comAba("comprar")}
            disabled={ocupadoAgora}
            className={`${BTN_ACAO} mt-2`}
          >
            {ocupado === "comprar" ? "Gerando..." : "Gerar etiqueta"}
          </button>
        </div>
      )}

      {etiqueta.rastreioStatus && (
        <p className="mt-2 text-[var(--ink)]">
          {ROTULO_RASTREIO[etiqueta.rastreioStatus]}
          {etiqueta.rastreioCodigo ? ` · ${etiqueta.rastreioCodigo}` : ""}
          {etiqueta.rastreioUrl && (
            <>
              {" · "}
              <a
                href={etiqueta.rastreioUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[var(--secondary-text)] underline"
              >
                Acompanhar
              </a>
            </>
          )}
        </p>
      )}

      {status === "gerada" && (
        <div className="mt-2">
          {custo != null && (
            <p className="text-[var(--ink-soft)]">Etiqueta gerada por {fmt(custo)}.</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={() => comAba("imprimir")}
              disabled={ocupadoAgora}
              className={BTN_ACAO_CONTORNO}
            >
              {ocupado === "imprimir" ? "Abrindo..." : "Imprimir etiqueta"}
            </button>
            {!confirmarCancelar && !etiqueta.rastreioStatus && (
              <button
                type="button"
                onClick={() => setConfirmarCancelar(true)}
                disabled={ocupadoAgora}
                className="min-h-11 text-[13px] font-medium text-[var(--danger)] hover:underline"
              >
                Cancelar etiqueta
              </button>
            )}
          </div>
          {confirmarCancelar && (
            <div role="alert" className="mt-2">
              <p className="text-[var(--ink)]">
                Só dá para cancelar antes de postar. O valor volta para a carteira do Melhor Envio
                em até 12 horas.
              </p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
                <button
                  type="button"
                  onClick={() => void executar("cancelar")}
                  disabled={ocupadoAgora}
                  className={`${BTN_ACAO_CONTORNO} !border-[var(--danger)] !text-[var(--danger)]`}
                >
                  {ocupado === "cancelar" ? "Cancelando..." : "Cancelar a etiqueta"}
                </button>
                <button type="button" onClick={() => setConfirmarCancelar(false)} className={LINK}>
                  Manter
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {erro && (
        <p role="alert" className="mt-2 text-[13px] text-[var(--danger)]">
          {erro}
        </p>
      )}
    </section>
  );
}
