import { useEffect } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { TOKEN_BRIDGE_V3 } from "@/lib/uiTokenBridge";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { fmt, fmtData } from "@/components/produtos/tipos";
import { formatarWhatsapp, ORIGEM_LABEL, type Origem } from "@/lib/leads";
import { marcarComoVista, useComprasDaCliente } from "./dados";

export interface ClienteFicha {
  id: string;
  nome: string;
  contato: string | null;
  whatsapp: string | null;
  whatsapp_consentimento_em: string | null;
  consentimento_origem: string | null;
  origem: string | null;
  interesse: string | null;
  status_pedido: string | null;
  created_at: string;
  novo: boolean;
}

function haQuantosDias(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(`${iso}T12:00:00`).getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

/**
 * Ficha da cliente (VND-04): painel lateral no computador, tela cheia no
 * celular. Compras vêm de Vendas pelo cliente_id. Abrir tira a etiqueta "novo".
 */
export function FichaCliente({
  cliente,
  onClose,
  onRegistrarVenda,
  onCriarOrcamento,
  onEditar,
  onVista,
}: {
  cliente: ClienteFicha;
  onClose: () => void;
  onRegistrarVenda: () => void;
  onCriarOrcamento: () => void;
  onEditar: () => void;
  /** Avisa a lista pra tirar a etiqueta "novo" sem esperar recarregar. */
  onVista: () => void;
}) {
  const compras = useComprasDaCliente(cliente.id);

  useEffect(() => {
    if (!cliente.novo) return;
    void marcarComoVista(cliente.id).then(onVista);
    // Só na abertura da ficha dessa cliente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente.id]);

  const lista = compras.data ?? [];
  const total = lista.reduce((s, v) => s + v.total, 0);
  const ultima = lista[0]?.data;
  const origem =
    cliente.origem && cliente.origem in ORIGEM_LABEL
      ? ORIGEM_LABEL[cliente.origem as Origem]
      : null;

  return (
    <Sheet
      open
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="polia-v3 w-full overflow-y-auto border-[var(--line)] bg-white text-[var(--ink)] shadow-none sm:max-w-md"
        style={TOKEN_BRIDGE_V3}
      >
        <SheetTitle className="font-cabinet pr-8 text-[24px] leading-tight tracking-[-0.02em] text-[var(--ink)]">
          {cliente.nome}
        </SheetTitle>
        <SheetDescription className="mt-1 text-[14px] text-[var(--ink-soft)]">
          Desde {fmtData(cliente.created_at)}
          {origem ? ` · origem: ${origem.toLowerCase()}` : ""}
          {cliente.status_pedido ? ` · ${cliente.status_pedido}` : ""}
        </SheetDescription>

        <dl className="mt-5 grid grid-cols-3 gap-2">
          <Numero rotulo="Pedidos" valor={compras.isLoading ? "…" : String(lista.length)} />
          <Numero rotulo="Comprou" valor={compras.isLoading ? "…" : fmt(total)} />
          <Numero
            rotulo="Última"
            valor={compras.isLoading ? "…" : ultima ? haQuantosDias(ultima) : "nenhuma"}
          />
        </dl>

        <div className="mt-4 rounded-xl bg-[var(--surface)] p-4 text-[14px]">
          {cliente.whatsapp ? (
            <>
              <p>
                WhatsApp {formatarWhatsapp(cliente.whatsapp)}
                {cliente.contato ? (
                  <span className="text-[var(--ink-soft)]"> · {cliente.contato}</span>
                ) : null}
              </p>
              <a
                href={`https://wa.me/${cliente.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center font-medium text-[var(--secondary-text)] hover:underline"
              >
                Abrir conversa no WhatsApp
              </a>
            </>
          ) : (
            <p>{cliente.contato ?? "Sem contato cadastrado"}</p>
          )}
          <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
            {cliente.whatsapp_consentimento_em
              ? `Autorizou mensagens em ${fmtData(cliente.whatsapp_consentimento_em)} (${
                  cliente.consentimento_origem === "link" ? "pelo link" : "no cadastro"
                }).`
              : "Sem autorização registrada pra mensagens da marca no WhatsApp."}
          </p>
        </div>

        {cliente.interesse && (
          <div className="mt-4">
            <p className="text-[12px] text-[var(--muted)]">O que ela procura</p>
            <p className="mt-1 whitespace-pre-line text-[14px] text-[var(--ink)]">
              {cliente.interesse}
            </p>
          </div>
        )}

        <div className="mt-5">
          <p className="text-[12px] text-[var(--muted)]">Pedidos</p>
          {compras.isError ? (
            <p role="alert" className="mt-2 text-[14px] text-[var(--danger)]">
              A Pólia One não conseguiu ler os pedidos agora.
            </p>
          ) : compras.isLoading ? (
            <p className="mt-2 text-[14px] text-[var(--muted)]">Carregando…</p>
          ) : lista.length === 0 ? (
            <p className="mt-2 text-[14px] text-[var(--ink-soft)]">Nenhum pedido registrado.</p>
          ) : (
            <ul className="mt-2">
              {lista.map((v) => (
                <li
                  key={v.id}
                  className="flex justify-between gap-3 border-t border-[var(--line)] py-2 text-[14px] first:border-t-0"
                >
                  <span className="min-w-0">
                    <span className="text-[var(--muted)]">{fmtData(v.data).slice(0, 5)} · </span>
                    {v.itens
                      .map(
                        (i) =>
                          `${i.quantidade}x ${i.produtoNome}${i.variacao ? ` ${i.variacao}` : ""}`,
                      )
                      .join(", ")}
                    {v.status === "a_receber" && (
                      <span className="text-[var(--muted)]"> · a receber</span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums">{fmt(v.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={onRegistrarVenda} className={BTN_ACAO}>
            Registrar venda
          </button>
          <button type="button" onClick={onCriarOrcamento} className={BTN_ACAO_CONTORNO}>
            Criar orçamento
          </button>
          <button type="button" onClick={onEditar} className={BTN_ACAO_CONTORNO}>
            Editar
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface)] p-3">
      <dt className="text-[12px] text-[var(--muted)]">{rotulo}</dt>
      <dd className="mt-0.5 text-[15px] font-semibold text-[var(--ink)]">{valor}</dd>
    </div>
  );
}
