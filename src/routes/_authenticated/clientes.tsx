import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { AlertTriangle, FileText, Link2, Pencil, Trash2, Users } from "lucide-react";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { MenuOpcoes } from "@/components/ui/MenuOpcoes";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO, BTN_MIUDO_ACAO } from "@/lib/botoes";
import { toastErro, toastSucesso } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { registrar as registrarFounder } from "@/lib/founder-eventos";
import { gerarCsv, baixarCsv } from "@/lib/csv";
import { dataISOLocal, hojeISO } from "@/lib/data.functions";
import { lerTodasAsPaginas } from "@/lib/leituraPaginada";
import { formatarReais } from "@/lib/formatarReais";
import { ModalRegistrarVenda } from "@/components/vendas/ModalRegistrarVenda";
import { ModalOrcamento } from "@/components/orcamentos/ModalOrcamento";
import { FichaCliente } from "@/components/clientes/FichaCliente";
import { ModalLinkCaptura } from "@/components/clientes/ModalLinkCaptura";
import { useCompradoPorCliente } from "@/components/clientes/dados";
import { useUserMeta } from "@/hooks/useUserMeta";
import {
  formatarWhatsapp,
  noGrupo,
  normalizarWhatsapp,
  ORIGEM_LABEL,
  ORIGENS,
  ORIGENS_MANUAIS,
  resumoLeads,
  type FiltroGrupo,
  type Origem,
} from "@/lib/leads";
import {
  emNegociacao,
  GRUPOS_STATUS,
  jaEntregue,
  TODOS_STATUS,
  type StatusCliente,
} from "@/lib/statusCliente";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Suas clientes · Pólia One" },
      { name: "description", content: "Suas clientes, do primeiro contato ao pós-venda." },
    ],
  }),
  component: ClientesPage,
});

type StatusPedido = StatusCliente;

interface Cliente {
  id: string;
  user_id: string;
  nome: string;
  contato: string | null;
  status_pedido: StatusPedido | null;
  notas: string | null;
  valor: number | null;
  produto_id: string | null;
  created_at: string;
  updated_at: string | null;
  venda_registrada: boolean;
  // Fase 2 (VND-04): leads.
  origem: string | null;
  whatsapp: string | null;
  whatsapp_consentimento_em: string | null;
  consentimento_origem: string | null;
  interesse: string | null;
  novo: boolean;
}

const origemLabel = (o: string | null) =>
  o && o in ORIGEM_LABEL ? ORIGEM_LABEL[o as Origem] : null;

interface Produto {
  id: string;
  nome: string;
}

// Formatador único de dinheiro (08/10/2026): mesma escrita do Painel e do Financeiro.
function formatarValorBRL(valor: number | null) {
  if (valor === null || valor === undefined) return null;
  return formatarReais(Number(valor));
}

/** Venda sem valor lançava uma entrada de R$ 0 no Financeiro. */
function temValorDeVenda(valor: number | null) {
  return valor != null && Number(valor) > 0;
}

function formatarDataCurta(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function statusPedidoCor(status: StatusPedido) {
  if (emNegociacao(status)) return "border border-[var(--line)] bg-white text-[var(--ink-soft)]";
  switch (status) {
    case "Em produção":
      return "bg-[var(--secondary-light)] text-[var(--secondary-text)]";
    case "Entregue":
      return "bg-[var(--surface-pink)] text-[var(--ink-soft)]";
    case "Atrasado":
      return "bg-[var(--highlight)] text-[var(--highlight-ink)]";
    case "Pós-venda":
      return "bg-[var(--accent)] text-[var(--accent-ink)]";
    case "Em espera":
    default:
      return "bg-[var(--line)] text-[var(--ink-soft)]";
  }
}

function ClientesPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const [modalAberto, setModalAberto] = useState(false);
  // QA-31 (07/10/2026): editar reaproveita o mesmo modal da criação.
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [grupo, setGrupo] = useState<FiltroGrupo>("todas");
  const [origemFiltro, setOrigemFiltro] = useState<Origem | "todas">("todas");
  const [linkAberto, setLinkAberto] = useState(false);
  const meta = useUserMeta();
  const compradoQuery = useCompradoPorCliente(userId);

  const dadosQuery = useQuery({
    queryKey: ["clientes-hub", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [clientes, produtosRes] = await Promise.all([
        // Lida inteira, página por página (QA-24): acima de 1.000 clientes o
        // PostgREST cortava a lista em silêncio. Erro sobe pelo lerTodasAsPaginas.
        lerTodasAsPaginas<Cliente>((de, ate) =>
          supabase
            .from("clientes")
            .select("*")
            .eq("user_id", userId!)
            .order("created_at", { ascending: false })
            .order("id", { ascending: true })
            .range(de, ate)
            .then((r) => ({ data: r.data as unknown as Cliente[] | null, error: r.error })),
        ),
        supabase.from("produtos").select("id, nome").eq("user_id", userId!),
      ]);
      // Leitura que falha não pode virar "Nenhuma cliente cadastrada ainda"
      // (07/10/2026): lança, e a tela mostra o estado de erro com nova tentativa.
      if (produtosRes.error) throw produtosRes.error;
      return {
        clientes,
        produtos: (produtosRes.data ?? []) as Produto[],
      };
    },
  });

  const clientes = dadosQuery.data?.clientes ?? [];
  const produtos = dadosQuery.data?.produtos ?? [];
  const resumo = resumoLeads(clientes, hojeISO().slice(0, 7), compradoQuery.data);
  const filtradas = clientes.filter(
    (c) =>
      noGrupo(c.status_pedido, grupo) && (origemFiltro === "todas" || c.origem === origemFiltro),
  );
  const recarregar = () => qc.invalidateQueries({ queryKey: ["clientes-hub", userId] });

  const nomeProduto = (produtoId: string | null) => {
    if (!produtoId) return "sem produto";
    return produtos.find((p) => p.id === produtoId)?.nome || "sem produto";
  };

  const exportarCsv = () => {
    const cabecalho = [
      "Nome",
      "Contato",
      "Status do pedido",
      "Produto",
      "Valor",
      "Data de cadastro",
      "Venda registrada",
      "WhatsApp",
      "Origem",
      "Autorizou WhatsApp em",
      "Interesse",
    ];
    const linhas = clientes.map((c) => [
      c.nome,
      c.contato ?? "",
      c.status_pedido ?? "",
      nomeProduto(c.produto_id),
      c.valor != null ? String(c.valor) : "",
      formatarDataCurta(c.created_at),
      c.venda_registrada ? "sim" : "não",
      c.whatsapp ? formatarWhatsapp(c.whatsapp) : "",
      origemLabel(c.origem) ?? "",
      c.whatsapp_consentimento_em ? formatarDataCurta(c.whatsapp_consentimento_em) : "",
      c.interesse ?? "",
    ]);
    baixarCsv(`clientes-polia-${hojeISO()}.csv`, gerarCsv(cabecalho, linhas));
    track("clientes_exportados", { total: clientes.length });
  };

  return (
    <PaginaLogada
      dica="clientes"
      largura="larga"
      eyebrow="Suas clientes"
      titulo="Do primeiro contato ao sim."
      subtitulo="Suas clientes e seus pedidos, num lugar só."
      acao={
        <div className="flex flex-wrap gap-2">
          {clientes.length > 0 && (
            <button type="button" onClick={exportarCsv} className={BTN_ACAO_CONTORNO}>
              Exportar CSV
            </button>
          )}
          <button type="button" onClick={() => setLinkAberto(true)} className={BTN_ACAO_CONTORNO}>
            <Link2 size={16} aria-hidden="true" />
            Link de captura
          </button>
          <button type="button" onClick={() => setModalAberto(true)} className={BTN_ACAO}>
            + Adicionar
          </button>
        </div>
      }
    >
      <div>
        {dadosQuery.isLoading ? (
          <p className="py-16 text-center text-[14px] text-[var(--muted)]">Carregando…</p>
        ) : dadosQuery.isError ? (
          <Vazio
            icone={AlertTriangle}
            titulo="A Pólia One não conseguiu carregar as suas clientes."
            texto="Pode ter sido a conexão. Tenta de novo, nada do que já está salvo se perdeu."
            acao={
              <button type="button" onClick={() => void dadosQuery.refetch()} className={BTN_ACAO}>
                Tentar de novo
              </button>
            }
          />
        ) : clientes.length === 0 ? (
          <Vazio
            icone={Users}
            titulo="Nenhuma cliente cadastrada ainda."
            texto="Cada cliente guarda onde a conversa está, o pedido, o valor e o pós-venda. Quando o pedido é entregue, a venda vai pro Financeiro com um clique."
            acao={
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => setModalAberto(true)} className={BTN_ACAO}>
                  Adicionar a primeira cliente
                </button>
                <button
                  type="button"
                  onClick={() => setLinkAberto(true)}
                  className={BTN_ACAO_CONTORNO}
                >
                  Criar link de captura
                </button>
              </div>
            }
          />
        ) : (
          <div>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <NumeroLeads
                rotulo="Novas fichas no mês"
                valor={String(resumo.novosNoMes)}
                nota={resumo.peloLink > 0 ? `${resumo.peloLink} pelo link` : undefined}
              />
              <NumeroLeads
                rotulo="Viraram pedido"
                valor={`${resumo.viraramCliente} de ${resumo.novosNoMes}`}
              />
              <NumeroLeads
                rotulo="De onde mais vem gente"
                valor={resumo.origemMaisComum ? ORIGEM_LABEL[resumo.origemMaisComum] : "sem origem"}
                nota={
                  compradoQuery.isError
                    ? "quem mais compra não carregou"
                    : resumo.origemQueMaisCompra
                      ? `quem mais compra: ${ORIGEM_LABEL[resumo.origemQueMaisCompra]}`
                      : resumo.origemMaisComum
                        ? undefined
                        : "marque a origem no cadastro"
                }
              />
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Mostrar" className="flex flex-wrap gap-2">
                {(
                  [
                    { id: "todas", label: "Todas" },
                    {
                      id: "leads",
                      label: resumo.naoVistos > 0 ? `Leads (${resumo.naoVistos} novos)` : "Leads",
                    },
                    { id: "pedido", label: "Com pedido" },
                    { id: "depois", label: "Depois da entrega" },
                  ] as { id: FiltroGrupo; label: string }[]
                ).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={grupo === g.id}
                    onClick={() => setGrupo(g.id)}
                    className={`${BTN_MIUDO} min-h-11 ${grupo === g.id ? "!bg-[var(--secondary)]" : "bg-white"}`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <label className="sr-only" htmlFor="clientes-origem">
                Origem
              </label>
              <select
                id="clientes-origem"
                value={origemFiltro}
                onChange={(e) => setOrigemFiltro(e.target.value as Origem | "todas")}
                className="min-h-11 rounded-lg border border-[var(--line)] bg-white px-3 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none sm:ml-auto"
              >
                <option value="todas">Origem: todas</option>
                {ORIGENS.map((o) => (
                  <option key={o} value={o}>
                    {ORIGEM_LABEL[o]}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              {filtradas.length === 0 ? (
                <div className="rounded-xl border border-[var(--line)] bg-white p-6 text-[14px] text-[var(--ink-soft)]">
                  <p>
                    {grupo === "leads"
                      ? "Nenhuma interessada com esse filtro. O link de captura traz contatos direto pra cá."
                      : "Nenhuma cliente com esse filtro."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setGrupo("todas");
                      setOrigemFiltro("todas");
                    }}
                    className="mt-2 inline-flex min-h-11 items-center font-medium text-[var(--secondary-text)] hover:underline"
                  >
                    Ver todas
                  </button>
                </div>
              ) : (
                filtradas.map((cliente) => (
                  <LinhaCliente
                    key={cliente.id}
                    cliente={cliente}
                    nomeProduto={nomeProduto(cliente.produto_id)}
                    userId={userId!}
                    onRegistrado={recarregar}
                    onEditar={() => setClienteEditando(cliente)}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {modalAberto && userId && (
        <ModalCliente
          userId={userId}
          onClose={() => setModalAberto(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["clientes-hub", userId] });
            setModalAberto(false);
          }}
        />
      )}

      {linkAberto && userId && (
        <ModalLinkCaptura
          userId={userId}
          nomeDaMarca={meta.businessName}
          onClose={() => setLinkAberto(false)}
        />
      )}

      {clienteEditando && userId && (
        <ModalCliente
          userId={userId}
          cliente={clienteEditando}
          nomeProdutoAtual={
            clienteEditando.produto_id ? nomeProduto(clienteEditando.produto_id) : undefined
          }
          onClose={() => setClienteEditando(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["clientes-hub", userId] });
            setClienteEditando(null);
          }}
        />
      )}
    </PaginaLogada>
  );
}

/* ============== Linha da lista + popover de registro ============== */
function LinhaCliente({
  cliente,
  nomeProduto,
  userId,
  onRegistrado,
  onEditar,
}: {
  cliente: Cliente;
  nomeProduto: string;
  userId: string;
  onRegistrado: () => void;
  onEditar: () => void;
}) {
  const [popAberto, setPopAberto] = useState(false);
  // Cliente com produto vende pelo módulo Vendas (VND-03): baixa o estoque e o
  // lucro sai certo. Sem produto continua o registro simples no Financeiro.
  const [vendaAberta, setVendaAberta] = useState(false);
  // Ficha (VND-04) e a venda que sai dela: a ficha registra venda a qualquer
  // momento; marca a cliente só quando é a venda do pedido entregue.
  const [fichaAberta, setFichaAberta] = useState(false);
  const [vendaDaFicha, setVendaDaFicha] = useState(false);
  const vendePorProduto = !!cliente.produto_id;
  const [duplicataData, setDuplicataData] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [orcamentoAberto, setOrcamentoAberto] = useState(false);

  // QA-31 (07/10/2026): excluir a cliente apaga só a linha de `clientes`. O
  // lançamento que registrar_venda_cliente criou em `lancamentos` não tem FK pra
  // cliente (liga só pela descrição), então continua no Financeiro: a venda
  // aconteceu e o dinheiro entrou, sumir com ele bagunçaria o mês.
  const excluir = async () => {
    setExcluindo(true);
    const { error } = await (
      supabase.from("clientes" as never) as unknown as {
        delete: () => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
      }
    )
      .delete()
      .eq("id", cliente.id);
    setExcluindo(false);
    if (error) {
      console.error("cliente_excluir", error);
      toastErro("A Pólia One não conseguiu excluir a cliente. Tenta de novo.");
      return;
    }
    track("cliente_excluido", { venda_registrada: cliente.venda_registrada });
    setConfirmarExcluir(false);
    onRegistrado();
    toastSucesso("Cliente excluída.");
  };

  const mudarStatus = async (novo: StatusPedido) => {
    if (novo === cliente.status_pedido) return;
    setSalvandoStatus(true);
    const { error } = await (
      supabase.from("clientes" as never) as unknown as {
        update: (p: Record<string, unknown>) => {
          eq: (c: string, v: string) => Promise<{ error: unknown }>;
        };
      }
    )
      .update({ status_pedido: novo, updated_at: new Date().toISOString() })
      .eq("id", cliente.id);
    setSalvandoStatus(false);
    if (error) {
      toastErro("A Pólia One não conseguiu atualizar o status. Tenta de novo.");
      return;
    }
    track("cliente_status_atualizado", { status: novo });
    onRegistrado();
  };

  const abrirPopover = async () => {
    setPopAberto(true);
    setDuplicataData(null);
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    const { data } = await supabase
      .from("lancamentos")
      .select("data, descricao")
      .eq("user_id", userId)
      .ilike("descricao", cliente.nome)
      .gte("data", dataISOLocal(seteDiasAtras));
    if (data && data.length > 0) {
      setDuplicataData(data[0].data);
    }
  };

  const registrar = async () => {
    if (!temValorDeVenda(cliente.valor)) return;
    setRegistrando(true);
    // RPC transacional: insere o lançamento e marca a cliente numa só transação. Se o update
    // falhar, o insert faz rollback — sem lançamento órfão que levasse a registro DUPLICADO.
    const { error } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message?: string } | null }>
    )("registrar_venda_cliente", { p_cliente_id: cliente.id });
    setRegistrando(false);
    if (error) {
      const jaRegistrada = error.message?.includes("já registrada");
      toastErro(
        jaRegistrada
          ? "Essa venda já foi registrada. Atualize a página."
          : "A Pólia One não conseguiu registrar a venda no Financeiro. Tenta de novo.",
      );
      // Recarrega a lista mesmo no erro "já registrada" pra sumir com o botão desatualizado.
      if (jaRegistrada) {
        setPopAberto(false);
        onRegistrado();
      }
      return;
    }
    track("venda_registrada");
    void registrarFounder("feature_completed", {
      feature: "clientes",
      propriedades: { acao: "venda" },
    });
    setPopAberto(false);
    onRegistrado();
    toastSucesso("Venda registrada no Financeiro.");
  };

  // Pós-venda vem depois da entrega: a venda ainda pode ser registrada ali,
  // senão mover a cliente pro pós-venda escondia o botão (ONE-123).
  const mostrarAcaoRegistrar = jaEntregue(cliente.status_pedido) && !cliente.venda_registrada;
  const semValor = !temValorDeVenda(cliente.valor);

  // A ação de venda mora numa linha própria no celular: em 375px, selo +
  // "Registrar venda →" + menu não cabiam ao lado do nome e estouravam a linha.
  const acaoVenda = cliente.venda_registrada ? (
    <span className="font-sans text-[13px] text-[var(--ink-soft)]">
      Registrada ·{" "}
      <Link
        to="/financeiro"
        className="inline-flex min-h-11 items-center text-[var(--secondary-text)] hover:underline"
      >
        ver no Financeiro
      </Link>
    </span>
  ) : mostrarAcaoRegistrar ? (
    semValor && !vendePorProduto ? (
      // Sem valor, registrar lançaria R$ 0 no caixa: o caminho é pôr o valor.
      <span className="font-sans text-[13px] text-[var(--ink-soft)]">
        Coloque o valor da venda pra registrar ·{" "}
        <button
          type="button"
          onClick={onEditar}
          className="inline-flex min-h-11 items-center font-medium text-[var(--secondary-text)] hover:underline"
        >
          Editar cliente
        </button>
      </span>
    ) : (
      <button
        type="button"
        onClick={vendePorProduto ? () => setVendaAberta(true) : abrirPopover}
        className={`${BTN_MIUDO_ACAO} w-full sm:w-auto`}
      >
        Registrar venda →
      </button>
    )
  ) : null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-white p-5 sm:flex-nowrap">
      <div className="order-1 flex min-w-0 flex-1 items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]">
          <span className="font-sans text-[16px] font-semibold text-[var(--accent-ink)]">
            {cliente.nome.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => setFichaAberta(true)}
            className="flex max-w-full items-center gap-2 text-left font-sans text-[15px] font-semibold text-[var(--ink)] underline-offset-2 hover:underline"
          >
            <span className="truncate">{cliente.nome}</span>
            {cliente.novo && (
              <span className="shrink-0 rounded border border-[var(--line)] px-1.5 py-0.5 text-[11px] font-normal text-[var(--ink-soft)]">
                novo
              </span>
            )}
            <span className="sr-only">, abrir ficha</span>
          </button>
          <p className="truncate font-sans text-[12px] text-[var(--muted)]">
            {[
              cliente.whatsapp
                ? formatarWhatsapp(cliente.whatsapp)
                : cliente.contato || "sem contato",
              origemLabel(cliente.origem),
              cliente.interesse ? `"${cliente.interesse}"` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-0.5 truncate font-sans text-[13px] text-[var(--ink-soft)]">
            {nomeProduto}
            {formatarValorBRL(cliente.valor) ? ` · ${formatarValorBRL(cliente.valor)}` : ""}
            {` · ${formatarDataCurta(cliente.created_at)}`}
          </p>
        </div>
      </div>
      {acaoVenda && (
        <div className="order-3 w-full sm:order-2 sm:w-auto sm:shrink-0">{acaoVenda}</div>
      )}
      <div className="order-2 flex shrink-0 items-center gap-3 sm:order-3">
        <MenuOpcoes
          ariaLabel={`Alterar status da cliente. Status atual: ${cliente.status_pedido ?? "sem status"}.`}
          trigger={
            <span
              className={`rounded px-3 py-1.5 font-sans text-[11px] transition-opacity hover:opacity-80 ${statusPedidoCor(cliente.status_pedido ?? "Primeiro contato")}`}
            >
              {salvandoStatus ? "Salvando…" : (cliente.status_pedido ?? "Sem status")}
            </span>
          }
          itens={TODOS_STATUS.map((s) => ({
            label: s === cliente.status_pedido ? `${s} (atual)` : s,
            onClick: () => mudarStatus(s),
            desabilitado: salvandoStatus,
          }))}
        />
        <MenuOpcoes
          ariaLabel={`Opções da cliente ${cliente.nome}`}
          itens={[
            { label: "Abrir ficha", icone: Users, onClick: () => setFichaAberta(true) },
            { label: "Fazer orçamento", icone: FileText, onClick: () => setOrcamentoAberto(true) },
            { label: "Editar", icone: Pencil, onClick: onEditar },
            {
              label: "Excluir",
              icone: Trash2,
              destrutivo: true,
              onClick: () => setConfirmarExcluir(true),
            },
          ]}
        />
      </div>

      <ConfirmarAcao
        open={confirmarExcluir}
        onOpenChange={setConfirmarExcluir}
        titulo={`Excluir ${cliente.nome}?`}
        descricao={
          cliente.venda_registrada
            ? "A cliente sai da lista, com contato e notas, e não dá pra desfazer. A venda dela já foi registrada: o lançamento continua no Financeiro, porque o dinheiro entrou de verdade. Se quiser tirar também, apague o lançamento lá."
            : "A cliente sai da lista, com contato, notas e pedido. Não dá pra desfazer."
        }
        textoConfirmar="Excluir"
        textoCarregando="Excluindo…"
        destrutivo
        carregando={excluindo}
        onConfirmar={excluir}
      />

      <ConfirmarAcao
        open={popAberto}
        onOpenChange={setPopAberto}
        titulo="Registrar no Financeiro"
        descricao={
          <>
            {nomeProduto}
            {formatarValorBRL(cliente.valor) ? ` · ${formatarValorBRL(cliente.valor)}` : ""}
            {" · categoria: Venda de produto"}
            {duplicataData && (
              <span className="mt-3 block rounded-lg bg-[var(--bg)] px-3 py-2 text-[12.5px] text-[var(--ink-soft)]">
                Já existe um lançamento parecido em {formatarDataCurta(duplicataData)}. Registrar
                mesmo assim?
              </span>
            )}
          </>
        }
        textoConfirmar={
          registrando ? "Registrando..." : duplicataData ? "Registrar mesmo assim" : "Registrar"
        }
        onConfirmar={registrar}
        carregando={registrando}
      />
      {vendaAberta && (
        <ModalRegistrarVenda
          userId={userId}
          prefill={{
            clienteId: cliente.id,
            clienteNome: cliente.nome,
            produtoId: cliente.produto_id,
            valor: cliente.valor,
            marcarCliente: true,
          }}
          onClose={() => setVendaAberta(false)}
          onSaved={() => {
            setVendaAberta(false);
            onRegistrado();
          }}
        />
      )}
      {fichaAberta && (
        <FichaCliente
          cliente={cliente}
          onClose={() => setFichaAberta(false)}
          onVista={onRegistrado}
          onRegistrarVenda={() => {
            setFichaAberta(false);
            setVendaDaFicha(true);
          }}
          onCriarOrcamento={() => {
            setFichaAberta(false);
            setOrcamentoAberto(true);
          }}
          onEditar={() => {
            setFichaAberta(false);
            onEditar();
          }}
        />
      )}
      {vendaDaFicha && (
        <ModalRegistrarVenda
          userId={userId}
          prefill={{
            clienteId: cliente.id,
            clienteNome: cliente.nome,
            produtoId: cliente.produto_id,
            valor: cliente.valor,
            // Só a venda do pedido entregue marca a cliente (é a que o botão da linha faria).
            marcarCliente: mostrarAcaoRegistrar && vendePorProduto,
          }}
          onClose={() => setVendaDaFicha(false)}
          onSaved={() => {
            setVendaDaFicha(false);
            onRegistrado();
          }}
        />
      )}
      {orcamentoAberto && (
        <ModalOrcamento
          userId={userId}
          prefill={{
            clienteId: cliente.id,
            clienteNome: cliente.nome,
            clienteContato: cliente.contato,
            clienteStatus: cliente.status_pedido,
          }}
          onClose={() => setOrcamentoAberto(false)}
          onCriado={onRegistrado}
        />
      )}
    </div>
  );
}

/* ============== Modal: nova cliente / editar cliente ============== */
function NumeroLeads({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface)] p-4">
      <dt className="text-[13px] text-[var(--muted)]">{rotulo}</dt>
      <dd className="font-cabinet mt-1 text-[24px] text-[var(--ink)]">{valor}</dd>
      {nota && <dd className="mt-1 text-[12px] text-[var(--muted)]">{nota}</dd>}
    </div>
  );
}

function ModalCliente({
  userId,
  cliente,
  nomeProdutoAtual,
  onClose,
  onSaved,
}: {
  userId: string;
  /** Com cliente, o modal edita essa linha; sem, cria uma nova. */
  cliente?: Cliente;
  /** Nome do produto atual da cliente, pra não sumir do select se estiver arquivado. */
  nomeProdutoAtual?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editando = !!cliente;
  const [nome, setNome] = useState(cliente?.nome ?? "");
  const [contato, setContato] = useState(cliente?.contato ?? "");
  const [whatsapp, setWhatsapp] = useState(
    cliente?.whatsapp ? formatarWhatsapp(cliente.whatsapp) : "",
  );
  const [origem, setOrigem] = useState<string>(cliente?.origem ?? "");
  const [autorizou, setAutorizou] = useState(!!cliente?.whatsapp_consentimento_em);
  const [erroNome, setErroNome] = useState<string | undefined>();
  const [erroWhats, setErroWhats] = useState<string | undefined>();
  // Aceite dado pela própria cliente no link é prova dela: a dona não desmarca.
  const whatsappAtual = whatsapp.trim() ? normalizarWhatsapp(whatsapp) : null;
  const aceiteDoLink =
    cliente?.consentimento_origem === "link" &&
    !!cliente.whatsapp &&
    whatsappAtual === cliente.whatsapp;
  const [statusPedido, setStatusPedido] = useState<StatusPedido | "">(cliente?.status_pedido ?? "");
  const [notas, setNotas] = useState(cliente?.notas ?? "");
  const [valor, setValor] = useState(cliente?.valor != null ? String(cliente.valor) : "");
  const [produtoId, setProdutoId] = useState(cliente?.produto_id ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const produtosQuery = useQuery({
    queryKey: ["produtos-select", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("produtos")
        .select("id, nome, preco_venda")
        .eq("user_id", userId)
        .eq("arquivado", false)
        .order("nome");
      return data ?? [];
    },
  });
  const produtos = produtosQuery.data ?? [];

  const selecionarProduto = (id: string) => {
    setProdutoId(id);
    const p = produtos.find((x) => x.id === id);
    if (p) setValor(String(p.preco_venda));
  };

  const salvar = async () => {
    setErroNome(undefined);
    setErroWhats(undefined);
    if (!nome.trim()) {
      setErroNome("Escreva o nome.");
      document.getElementById("cliente-nome")?.focus();
      return;
    }
    const valorNumero = valor.trim() === "" ? null : Number(valor);
    if (valorNumero !== null && (!Number.isFinite(valorNumero) || valorNumero < 0)) {
      setErro("O valor precisa ser um número igual ou maior que zero.");
      return;
    }
    const whatsappNormal = whatsappAtual;
    if (whatsapp.trim() && !whatsappNormal) {
      setErroWhats("Confira o número, com DDD. Ex: (11) 98888-0000");
      document.getElementById("cliente-whatsapp")?.focus();
      return;
    }
    if (autorizou && !whatsappNormal && !aceiteDoLink) {
      setErroWhats("Pra marcar a autorização, preencha o WhatsApp.");
      document.getElementById("cliente-whatsapp")?.focus();
      return;
    }
    setSalvando(true);
    setErro(null);
    // Sem user_id nem venda_registrada no payload da edição: a dona não muda, e
    // a marca de venda registrada só a RPC de venda mexe. O aceite de WhatsApp
    // também fica fora: muda só pela registrar_consentimento (livro da LGPD), e
    // o banco recusa escrita direta nessas colunas.
    const campos = {
      nome: nome.trim(),
      contato: contato.trim() || null,
      status_pedido: statusPedido || null,
      notas: notas.trim() || null,
      valor: valorNumero,
      produto_id: produtoId || null,
      whatsapp: whatsappNormal,
      origem: origem || null,
    };
    const resposta = cliente
      ? await supabase
          .from("clientes")
          .update({ ...campos, updated_at: new Date().toISOString() } as never)
          .eq("id", cliente.id)
          .select("id")
          .single()
      : await supabase
          .from("clientes")
          .insert({ ...campos, user_id: userId } as never)
          .select("id")
          .single();
    if (resposta.error || !resposta.data) {
      setSalvando(false);
      // Técnico no log, frase da Pólia na tela (mesmo padrão do modal de lançamento).
      console.error(editando ? "cliente_editar" : "cliente_criar", resposta.error);
      setErro(
        resposta.error?.code === "23505"
          ? "Já existe uma cliente com esse WhatsApp. Procure por ela na lista."
          : "A Pólia One não conseguiu salvar a cliente agora. Tenta de novo.",
      );
      return;
    }

    // Aceite só é gravado quando a caixinha muda em relação ao banco. Número
    // trocado já derrubou o aceite antigo no próprio banco (gatilho).
    const mesmoNumero = !!cliente?.whatsapp && whatsappNormal === cliente.whatsapp;
    const aceiteNoBanco = !!cliente?.whatsapp_consentimento_em && mesmoNumero;
    if (!aceiteDoLink && whatsappNormal && autorizou !== aceiteNoBanco) {
      const { error } = await supabase.rpc("registrar_consentimento", {
        p_cliente_id: (resposta.data as { id: string }).id,
        p_aceite: autorizou,
      });
      if (error) {
        setSalvando(false);
        console.error("cliente_consentimento", error);
        toastErro("A cliente foi salva, mas a autorização não. Abra a cliente e salve de novo.");
        onSaved();
        return;
      }
    }
    setSalvando(false);
    if (editando) {
      track("cliente_editado");
      onSaved();
      return;
    }
    track("cliente_criado");
    void registrarFounder("feature_completed", {
      feature: "clientes",
      propriedades: { acao: "cliente" },
    });
    onSaved();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={editando ? "Editar cliente" : "Adicionar cliente"}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
            Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={salvando} className={BTN_ACAO}>
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </>
      }
    >
      <div className="mb-4">
        <Campo label="Nome" required id="cliente-nome" error={erroNome}>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            placeholder="Ex: Marina Duarte"
          />
        </Campo>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Campo label="WhatsApp" id="cliente-whatsapp" error={erroWhats}>
          <input
            type="tel"
            inputMode="tel"
            value={whatsapp}
            onChange={(e) => {
              setWhatsapp(e.target.value);
              // Aceite é do número: trocou, a caixinha volta a ficar vazia.
              setAutorizou(
                !!cliente?.whatsapp_consentimento_em &&
                  normalizarWhatsapp(e.target.value) === cliente.whatsapp,
              );
            }}
            maxLength={30}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            placeholder="(11) 98888-0000"
          />
        </Campo>
        <Campo label="Outro contato">
          <input
            value={contato}
            onChange={(e) => setContato(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            placeholder="@instagram ou e-mail"
          />
        </Campo>
      </div>

      <div className="mb-4">
        <Campo label="De onde veio">
          <select
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
          >
            <option value="">Não sei</option>
            {/* "Link de captura" só entra pelo próprio link, mas continua visível na edição. */}
            {(origem === "link" ? ORIGENS : ORIGENS_MANUAIS).map((o) => (
              <option key={o} value={o}>
                {ORIGEM_LABEL[o]}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {aceiteDoLink ? (
        <p className="mb-4 rounded-lg bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--ink-soft)]">
          Ela autorizou mensagens da marca pelo link em{" "}
          {formatarDataCurta(cliente!.whatsapp_consentimento_em!)}. Esse aceite fica guardado.
        </p>
      ) : (
        <label className="mb-4 flex min-h-11 cursor-pointer items-start gap-3 text-[14px] text-[var(--ink)]">
          <input
            type="checkbox"
            checked={autorizou}
            onChange={(e) => setAutorizou(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--secondary-text)]"
          />
          <span>
            Ela autorizou receber mensagens da marca no WhatsApp
            {cliente?.whatsapp_consentimento_em && (
              <span className="block text-[12px] text-[var(--muted)]">
                desde {formatarDataCurta(cliente.whatsapp_consentimento_em)} (
                {cliente.consentimento_origem === "link" ? "pelo link" : "no cadastro"})
              </span>
            )}
          </span>
        </label>
      )}

      <div className="mb-4">
        <p id="cliente-status-rotulo" className="mb-1 block text-[12px] text-[var(--muted)]">
          Status
        </p>
        <div role="group" aria-labelledby="cliente-status-rotulo" className="space-y-3">
          <button
            type="button"
            onClick={() => setStatusPedido("")}
            aria-pressed={statusPedido === ""}
            className={`${BTN_MIUDO} min-h-11 ${statusPedido === "" ? "!bg-[var(--secondary)]" : "bg-white"}`}
          >
            Sem status
          </button>
          {GRUPOS_STATUS.map((grupo) => (
            <div key={grupo.titulo}>
              <p className="mb-1.5 text-[12px] text-[var(--muted)]">{grupo.titulo}</p>
              <div className="flex flex-wrap gap-2">
                {grupo.status.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusPedido(s)}
                    aria-pressed={statusPedido === s}
                    className={`${BTN_MIUDO} min-h-11 ${statusPedido === s ? "!bg-[var(--secondary)]" : "bg-white"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <Campo label="Produto (opcional)">
          <select
            value={produtoId}
            onChange={(e) => selecionarProduto(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
          >
            <option value="">Sem produto</option>
            {produtoId && !produtos.some((p) => p.id === produtoId) && (
              <option value={produtoId}>{nomeProdutoAtual ?? "Produto atual"}</option>
            )}
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} · {formatarReais(Number(p.preco_venda))}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <div className="mb-4">
        <Campo label="Valor da venda (R$)">
          <input
            type="number"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            placeholder="0"
            aria-describedby={cliente?.venda_registrada ? "cliente-valor-aviso" : undefined}
          />
        </Campo>
        {cliente?.venda_registrada && (
          <p
            id="cliente-valor-aviso"
            className="mt-2 rounded-lg bg-[var(--bg)] px-3 py-2 text-[12.5px] leading-[1.5] text-[var(--ink-soft)]"
          >
            A venda dessa cliente já foi registrada. Mudar o valor aqui não mexe no Financeiro: o
            lançamento guarda o valor do dia em que a venda foi registrada. Se precisar corrigir,
            edite o lançamento no Financeiro.
          </p>
        )}
      </div>

      <div>
        <Campo label="Notas">
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
          />
        </Campo>
      </div>

      {erro && (
        <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
          {erro}
        </p>
      )}
    </Modal>
  );
}
