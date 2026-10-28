import { useMemo, useState, type DragEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus } from "lucide-react";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { BlockError } from "@/components/ui/BlockError";
import { BTN_ACAO, BTN_MIUDO } from "@/lib/botoes";
import { fmt } from "@/components/produtos/tipos";
import { hojeISO } from "@/lib/data.functions";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { toastErro, toastSucesso } from "@/lib/toast";
import { ehPlanoGratis } from "@/lib/planoGratis";
import {
  ANDAMENTOS,
  ROTULO_ANDAMENTO,
  TETO_PEDIDOS_GRATIS,
  contarAbertos,
  ehAndamento,
  ficaNoQuadro,
  linhaDoResumo,
  ordenarPorEntrega,
  proximoAndamento,
  resumoDoDia,
  tetoAtingido,
  type AndamentoPedido,
} from "@/lib/pedidos";
import { cancelarVenda, receberVenda } from "@/components/vendas/dados";
import {
  moverPedido,
  recarregarDepoisDoPedido,
  remarcarPedido,
  usePedidos,
  type PedidoLinha,
} from "@/components/pedidos/dados";
import { CartaoPedido } from "@/components/pedidos/CartaoPedido";
import { ModalNovoPedido } from "@/components/pedidos/ModalNovoPedido";
import { ModalPedido } from "@/components/pedidos/ModalPedido";

// Quadro de Pedidos (GRW-93, Fase 1). Desde 28/10/2026 tem rota e item de menu
// próprios: o Planner saiu das usuárias (lib/ferramentasInternas.ts). Lê vendas,
// não tarefas. Plano e wireframe em docs/plano-quadro-de-pedidos.md.
export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos · Pólia One" },
      {
        name: "description",
        content: "O que entregar hoje, o que atrasou e quanto entra na semana.",
      },
    ],
  }),
  component: QuadroDePedidos,
});

function QuadroDePedidos() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const meta = useUserMeta();
  const ehGratis = ehPlanoGratis(meta);
  const qc = useQueryClient();
  const [hoje] = useState(() => hojeISO());
  const pedidosQuery = usePedidos(userId, hoje);

  const [novoAberto, setNovoAberto] = useState(false);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);
  // Celular: uma coluna por vez.
  const [colunaCelular, setColunaCelular] = useState<AndamentoPedido>("a_fazer");
  const [colunaSobre, setColunaSobre] = useState<AndamentoPedido | null>(null);

  const pedidos = useMemo(
    () => (pedidosQuery.data ?? []).filter((p) => ficaNoQuadro(p, hoje)),
    [pedidosQuery.data, hoje],
  );
  const porAndamento = useMemo(() => {
    const m = new Map<AndamentoPedido, PedidoLinha[]>(ANDAMENTOS.map((e) => [e, []]));
    for (const p of pedidos) m.get(p.andamento)!.push(p);
    for (const e of ANDAMENTOS) m.set(e, ordenarPorEntrega(m.get(e)!));
    return m;
  }, [pedidos]);
  const resumo = useMemo(() => resumoDoDia(pedidos, hoje), [pedidos, hoje]);
  const abertos = contarAbertos(pedidos);
  const noTeto = tetoAtingido(ehGratis, abertos);
  const aberto = pedidos.find((p) => p.id === abertoId) ?? null;

  const recarregar = () => recarregarDepoisDoPedido(qc, userId);

  const mover = async (p: PedidoLinha, andamento: AndamentoPedido) => {
    if (andamento === p.andamento || ocupadoId) return;
    setOcupadoId(p.id);
    setErroDetalhe(null);
    const { error } = await moverPedido(p.id, andamento);
    setOcupadoId(null);
    if (error) {
      console.error("pedido_mover", error);
      const msg =
        "A Pólia One não conseguiu mover o pedido. Tenta de novo, ele continua onde estava.";
      setErroDetalhe(msg);
      if (!abertoId) toastErro(msg);
      return;
    }
    track("pedido_movido", { de: p.andamento, para: andamento });
    void registrar("feature_completed", {
      feature: "pedidos",
      propriedades: { acao: "mover", para: andamento },
    });
    recarregar();
  };

  const remarcar = async (p: PedidoLinha, data: string) => {
    setOcupadoId(p.id);
    setErroDetalhe(null);
    const { error } = await remarcarPedido(p.id, data);
    setOcupadoId(null);
    if (error) {
      console.error("pedido_remarcar", error);
      setErroDetalhe("A Pólia One não conseguiu salvar a nova data. Tenta de novo.");
      return;
    }
    toastSucesso("Data de entrega atualizada.");
    recarregar();
  };

  const receber = async (p: PedidoLinha) => {
    setOcupadoId(p.id);
    setErroDetalhe(null);
    const { error } = await receberVenda(p.id, hojeISO());
    setOcupadoId(null);
    if (error) {
      console.error("pedido_receber", error);
      const msg =
        "A Pólia One não conseguiu lançar o pagamento. Tenta de novo: não lança em dobro.";
      setErroDetalhe(msg);
      if (!abertoId) toastErro(msg);
      return;
    }
    track("pedido_recebido");
    toastSucesso("Pagamento lançado no Financeiro.");
    recarregar();
  };

  const cancelar = async (p: PedidoLinha) => {
    setOcupadoId(p.id);
    setErroDetalhe(null);
    const { error } = await cancelarVenda(p.id);
    setOcupadoId(null);
    if (error) {
      console.error("pedido_cancelar", error);
      setErroDetalhe("A Pólia One não conseguiu cancelar o pedido. Tenta de novo.");
      return;
    }
    track("pedido_cancelado");
    toastSucesso("Pedido cancelado. Os itens voltaram pro estoque.");
    setAbertoId(null);
    recarregar();
  };

  const soltar = (e: DragEvent<HTMLElement>, andamento: AndamentoPedido) => {
    e.preventDefault();
    setColunaSobre(null);
    const id = e.dataTransfer.getData("text/plain");
    const p = pedidos.find((x) => x.id === id);
    if (p) void mover(p, andamento);
  };

  const botaoNovo = (
    <button
      type="button"
      onClick={() => setNovoAberto(true)}
      disabled={noTeto || !userId}
      aria-describedby={noTeto ? "pedidos-teto" : undefined}
      className={BTN_ACAO}
    >
      <Plus size={16} aria-hidden="true" />
      Novo pedido
    </button>
  );

  const cabecalho = {
    largura: "larga" as const,
    eyebrow: "Pedidos",
    titulo: "O que entregar e quando.",
    subtitulo: "Cada pedido com a cliente, o dia da entrega e se já pagou.",
  };

  if (pedidosQuery.isError) {
    return (
      <PaginaLogada {...cabecalho}>
        <div role="alert">
          <BlockError
            message="A Pólia One não conseguiu ler os seus pedidos agora. Nada foi perdido, é só a leitura que falhou."
            onRetry={() => void pedidosQuery.refetch()}
          />
        </div>
      </PaginaLogada>
    );
  }

  return (
    <PaginaLogada {...cabecalho} acao={botaoNovo}>
      {pedidosQuery.isLoading || !userId ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4" aria-hidden="true">
          {ANDAMENTOS.map((e) => (
            <div
              key={e}
              className="h-40 animate-pulse rounded-xl bg-[var(--surface)] motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : pedidos.length === 0 ? (
        <Vazio
          icone={ClipboardList}
          titulo="Nenhum pedido anotado ainda."
          texto="Cada pedido guarda a cliente, o que ela pediu e o dia da entrega. Na entrega, ele vira venda no Financeiro."
          acao={
            <button type="button" onClick={() => setNovoAberto(true)} className={BTN_ACAO}>
              Anotar o primeiro pedido
            </button>
          }
        />
      ) : (
        <>
          <div className="mb-6">
            <p className="text-[16px] text-[var(--ink)]">{linhaDoResumo(resumo)}</p>
            {resumo.entraNaSemana > 0 && (
              <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
                Esta semana entram {fmt(resumo.entraNaSemana)}
              </p>
            )}
            {noTeto && (
              <p
                id="pedidos-teto"
                className="mt-3 rounded-lg bg-[var(--surface)] p-3 text-[13px] text-[var(--ink-soft)]"
              >
                No plano Grátis cabem {TETO_PEDIDOS_GRATIS} pedidos abertos ao mesmo tempo. Marque
                como entregue os que já saíram, ou assine o Premium pra deixar sem limite.{" "}
                <Link
                  to="/assinar"
                  search={{ plano: "controle" }}
                  className="font-medium text-[var(--secondary-text)] no-underline hover:underline"
                >
                  Assinar o Premium
                </Link>
              </p>
            )}
          </div>

          {/* Celular: abas no lugar das quatro colunas lado a lado. */}
          <div
            role="group"
            aria-label="Andamento do pedido"
            className="mb-4 flex flex-wrap gap-2 md:hidden"
          >
            {ANDAMENTOS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={colunaCelular === e}
                onClick={() => setColunaCelular(e)}
                className={`${BTN_MIUDO} min-h-11 ${colunaCelular === e ? "!bg-[var(--secondary)]" : "bg-white"}`}
              >
                {ROTULO_ANDAMENTO[e]} {porAndamento.get(e)!.length}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {ANDAMENTOS.map((andamento) => {
              const lista = porAndamento.get(andamento)!;
              return (
                <section
                  key={andamento}
                  aria-labelledby={`coluna-${andamento}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setColunaSobre(andamento);
                  }}
                  onDragLeave={() => setColunaSobre((c) => (c === andamento ? null : c))}
                  onDrop={(e) => soltar(e, andamento)}
                  className={`rounded-xl border p-3 ${
                    colunaSobre === andamento
                      ? "border-[var(--secondary)] bg-[var(--secondary-light)]"
                      : "border-[var(--line)] bg-[var(--surface)]"
                  } ${colunaCelular === andamento ? "" : "hidden md:block"}`}
                >
                  <h2
                    id={`coluna-${andamento}`}
                    className="font-accent mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]"
                  >
                    {ROTULO_ANDAMENTO[andamento]} ({lista.length})
                    {andamento === "entregue" && (
                      <span className="sr-only"> nos últimos 7 dias</span>
                    )}
                  </h2>
                  {lista.length === 0 ? (
                    <p className="px-1 text-[13px] text-[var(--muted)]">
                      {andamento === "entregue"
                        ? "Nada entregue nos últimos 7 dias."
                        : "Nada aqui."}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {lista.map((p) => (
                        <CartaoPedido
                          key={p.id}
                          pedido={p}
                          hoje={hoje}
                          ocupado={ocupadoId === p.id}
                          onAbrir={() => {
                            setErroDetalhe(null);
                            setAbertoId(p.id);
                          }}
                          onAvancar={() => {
                            const proxima = proximoAndamento(p.andamento);
                            if (proxima) void mover(p, proxima);
                          }}
                          onReceber={() => void receber(p)}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", p.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {novoAberto && userId && (
        <ModalNovoPedido
          userId={userId}
          onClose={() => setNovoAberto(false)}
          onSaved={() => {
            setNovoAberto(false);
            setColunaCelular("a_fazer");
            recarregar();
          }}
        />
      )}

      {aberto && (
        <ModalPedido
          key={aberto.id}
          pedido={aberto}
          hoje={hoje}
          ocupado={ocupadoId === aberto.id}
          erro={erroDetalhe}
          onMover={(e) => {
            if (ehAndamento(e)) void mover(aberto, e);
          }}
          onRemarcar={(d) => void remarcar(aberto, d)}
          onReceber={() => void receber(aberto)}
          onCancelar={() => void cancelar(aberto)}
          onClose={() => setAbertoId(null)}
        />
      )}
    </PaginaLogada>
  );
}
