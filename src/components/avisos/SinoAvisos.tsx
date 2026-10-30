import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as Popover from "@radix-ui/react-popover";
import { Bell, MessagesSquare, ShoppingBag, Sparkles, type LucideIcon } from "lucide-react";
import { TOKEN_BRIDGE_V3 } from "@/lib/uiTokenBridge";
import { formatarReais } from "@/lib/formatarReais";
import { contarNaoLidos, itensDoSino, quandoFoi, rotuloContador, type ItemSino, type TipoAviso } from "@/lib/avisos";
import { useAvisos, useMarcarLidos } from "./dados";

// Sino do topo da área logada (ONE-152): pedido novo da loja, resposta do
// suporte e novidade da Pólia One num feed só. Clicar num item marca como lido
// e leva pra tela dele.

const ICONE: Record<TipoAviso, LucideIcon> = {
  pedido: ShoppingBag,
  chamado: MessagesSquare,
  novidade: Sparkles,
};

export function SinoAvisos() {
  const [aberto, setAberto] = useState(false);
  const { data, isLoading, isError, refetch } = useAvisos();
  const marcarLidos = useMarcarLidos();
  const navigate = useNavigate();

  const itens = data ? itensDoSino(data.avisos, data.novidades, data.lidas) : [];
  const naoLidos = contarNaoLidos(itens);

  const abrirItem = async (item: ItemSino) => {
    if (!item.lido) {
      void marcarLidos(item.tipo === "novidade" ? [] : [item.id], item.tipo === "novidade" ? [item.id] : []);
    }
    if (item.link) {
      setAberto(false);
      await navigate({ to: item.link });
    }
  };

  const marcarTodos = () => {
    const pendentes = itens.filter((i) => !i.lido);
    void marcarLidos(
      pendentes.filter((i) => i.tipo !== "novidade").map((i) => i.id),
      pendentes.filter((i) => i.tipo === "novidade").map((i) => i.id),
    );
  };

  return (
    <Popover.Root open={aberto} onOpenChange={setAberto}>
      <Popover.Trigger
        type="button"
        aria-label={naoLidos ? `Avisos, ${naoLidos} sem ler` : "Avisos"}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--secondary-text)] data-[state=open]:bg-[var(--bg)]"
      >
        <Bell size={20} aria-hidden="true" />
        {naoLidos > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[var(--ink)] px-1 text-[11px] font-semibold leading-[18px] text-white"
          >
            {rotuloContador(naoLidos)}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className="polia-v3 z-50 flex max-h-[min(560px,calc(100dvh-96px))] w-[min(380px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-white outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:duration-[200ms] data-[state=closed]:duration-[150ms]"
          style={TOKEN_BRIDGE_V3}
        >
          <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
            <h2 className="font-cabinet text-[17px] text-[var(--ink)]">Avisos</h2>
            {naoLidos > 0 && (
              <span className="rounded-full bg-[var(--secondary-light)] px-2 py-0.5 text-[12px] font-medium text-[var(--ink)]">
                {naoLidos === 1 ? "1 novo" : `${naoLidos} novos`}
              </span>
            )}
            {naoLidos > 0 && (
              <button
                type="button"
                onClick={marcarTodos}
                className="ml-auto min-h-11 rounded-md px-2 text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
              >
                Marcar todos como lidos
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <p className="px-4 py-10 text-center text-[14px] text-[var(--muted)]">Carregando os avisos…</p>
            ) : isError ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[14px] text-[var(--ink-soft)]">A Pólia One não conseguiu carregar os avisos agora.</p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="mt-2 min-h-11 text-[14px] font-medium text-[var(--secondary-text)] hover:underline"
                >
                  Tentar de novo
                </button>
              </div>
            ) : itens.length === 0 ? (
              <p className="px-4 py-10 text-[14px] leading-[1.5] text-[var(--ink-soft)]">
                Nada novo por aqui. Pedido da loja, resposta do suporte e novidade da Pólia One aparecem neste sino.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {itens.map((item) => {
                  const Icone = ICONE[item.tipo];
                  return (
                    <li key={item.chave}>
                      <button
                        type="button"
                        onClick={() => void abrirItem(item)}
                        className={`flex w-full gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--bg)] focus-visible:bg-[var(--bg)] focus-visible:outline-none ${
                          item.lido ? "" : "bg-[var(--surface)]"
                        }`}
                      >
                        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--ink-soft)]">
                          <Icone size={16} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start gap-2">
                            <span className="flex-1 text-[14px] font-semibold leading-[1.35] text-[var(--ink)]">
                              {item.titulo}
                            </span>
                            <span className="shrink-0 text-[12px] text-[var(--muted)]">{quandoFoi(item.quando)}</span>
                            {!item.lido && (
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--secondary-text)]">
                                <span className="sr-only">sem ler</span>
                              </span>
                            )}
                          </span>
                          {item.corpo && (
                            <span
                              className={`mt-0.5 block text-[13px] leading-[1.45] text-[var(--ink-soft)] ${
                                item.tipo === "novidade" ? "line-clamp-2" : "truncate"
                              }`}
                            >
                              {item.corpo}
                            </span>
                          )}
                          {item.valor !== null && (
                            <span className="mt-0.5 block text-[13px] font-semibold text-[var(--ink)]">
                              {formatarReais(item.valor)}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
