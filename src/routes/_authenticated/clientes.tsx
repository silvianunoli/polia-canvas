import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { AlertTriangle, Pencil, Trash2, Users } from "lucide-react";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { MenuOpcoes } from "@/components/ui/MenuOpcoes";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { toastErro, toastSucesso } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { registrar as registrarFounder } from "@/lib/founder-eventos";
import { gerarCsv, baixarCsv } from "@/lib/csv";
import { dataISOLocal, hojeISO } from "@/lib/data.functions";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Seus clientes · Pólia One" },
      { name: "description", content: "Suas clientes, do primeiro contato ao pós-venda." },
    ],
  }),
  component: ClientesPage,
});

type StatusPedido = "Em espera" | "Em produção" | "Entregue" | "Atrasado";

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
}

interface Produto {
  id: string;
  nome: string;
}

function formatarValorBRL(valor: number | null) {
  if (valor === null || valor === undefined) return null;
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDataCurta(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function statusPedidoCor(status: StatusPedido) {
  switch (status) {
    case "Em produção":
      return "bg-[var(--secondary-light)] text-[var(--secondary-text)]";
    case "Entregue":
      return "bg-[var(--surface-pink)] text-[var(--ink-soft)]";
    case "Atrasado":
      return "bg-[var(--highlight)] text-[var(--highlight-ink)]";
    case "Em espera":
    default:
      return "bg-[var(--line)] text-[var(--ink-soft)]";
  }
}

const STATUS_PEDIDO_OPTIONS: StatusPedido[] = ["Em espera", "Em produção", "Entregue", "Atrasado"];

function ClientesPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const [modalAberto, setModalAberto] = useState(false);
  // QA-31 (07/10/2026): editar reaproveita o mesmo modal da criação.
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);

  const dadosQuery = useQuery({
    queryKey: ["clientes-hub", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [clientesRes, produtosRes] = await Promise.all([
        (
          supabase.from("clientes" as never) as unknown as {
            select: (s: string) => {
              eq: (
                c: string,
                v: string,
              ) => {
                order: (
                  c: string,
                  o: { ascending: boolean },
                ) => Promise<{ data: Cliente[] | null; error: unknown }>;
              };
            };
          }
        )
          .select("*")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false }),
        supabase.from("produtos").select("id, nome").eq("user_id", userId!),
      ]);
      // Leitura que falha não pode virar "Nenhuma cliente cadastrada ainda"
      // (07/10/2026): lança, e a tela mostra o estado de erro com nova tentativa.
      if (clientesRes.error) throw clientesRes.error;
      if (produtosRes.error) throw produtosRes.error;
      return {
        clientes: (clientesRes.data ?? []) as Cliente[],
        produtos: (produtosRes.data ?? []) as Produto[],
      };
    },
  });

  const clientes = dadosQuery.data?.clientes ?? [];
  const produtos = dadosQuery.data?.produtos ?? [];

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
    ];
    const linhas = clientes.map((c) => [
      c.nome,
      c.contato ?? "",
      c.status_pedido ?? "",
      nomeProduto(c.produto_id),
      c.valor != null ? String(c.valor) : "",
      formatarDataCurta(c.created_at),
      c.venda_registrada ? "sim" : "não",
    ]);
    baixarCsv(`clientes-polia-${hojeISO()}.csv`, gerarCsv(cabecalho, linhas));
    track("clientes_exportados", { total: clientes.length });
  };

  return (
    <PaginaLogada
      dica="clientes"
      largura="larga"
      eyebrow="Seus clientes"
      titulo="Do primeiro contato ao sim."
      subtitulo="Suas clientes e seus pedidos, num lugar só."
      acao={
        <div className="flex gap-2">
          {clientes.length > 0 && (
            <button type="button" onClick={exportarCsv} className={BTN_ACAO_CONTORNO}>
              Exportar CSV
            </button>
          )}
          <button type="button" onClick={() => setModalAberto(true)} className={BTN_ACAO}>
            + Adicionar cliente
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
            texto="Cada cliente guarda o pedido, o valor e o status da entrega. Quando o pedido é entregue, a venda vai pro Financeiro com um clique."
            acao={
              <button type="button" onClick={() => setModalAberto(true)} className={BTN_ACAO}>
                Adicionar a primeira cliente
              </button>
            }
          />
        ) : (
          <div>
            {clientes.map((cliente) => (
              <LinhaCliente
                key={cliente.id}
                cliente={cliente}
                nomeProduto={nomeProduto(cliente.produto_id)}
                userId={userId!}
                onRegistrado={() => qc.invalidateQueries({ queryKey: ["clientes-hub", userId] })}
                onEditar={() => setClienteEditando(cliente)}
              />
            ))}
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
  const [duplicataData, setDuplicataData] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

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
      if (jaRegistrada) onRegistrado();
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

  const mostrarAcaoRegistrar = cliente.status_pedido === "Entregue" && !cliente.venda_registrada;

  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white p-5">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]">
          <span className="font-sans text-[16px] font-semibold text-[var(--accent-ink)]">
            {cliente.nome.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate font-sans text-[15px] font-semibold text-[var(--ink)]">
            {cliente.nome}
          </p>
          <p className="truncate font-sans text-[12px] text-[var(--muted)]">
            {cliente.contato || "sem contato"}
          </p>
          <p className="mt-0.5 truncate font-sans text-[13px] text-[var(--ink-soft)]">
            {nomeProduto}
            {formatarValorBRL(cliente.valor) ? ` · ${formatarValorBRL(cliente.valor)}` : ""}
            {` · ${formatarDataCurta(cliente.created_at)}`}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <MenuOpcoes
          ariaLabel={`Alterar status do pedido. Status atual: ${cliente.status_pedido ?? "sem pedido"}.`}
          trigger={
            <span
              className={`rounded px-3 py-1.5 font-sans text-[11px] transition-opacity hover:opacity-80 ${statusPedidoCor(cliente.status_pedido ?? "Em espera")}`}
            >
              {salvandoStatus ? "Salvando…" : (cliente.status_pedido ?? "Sem pedido")}
            </span>
          }
          itens={STATUS_PEDIDO_OPTIONS.map((s) => ({
            label: s === cliente.status_pedido ? `${s} (atual)` : s,
            onClick: () => mudarStatus(s),
            desabilitado: salvandoStatus,
          }))}
        />
        {cliente.venda_registrada ? (
          <span className="shrink-0 font-sans text-[13px] text-[var(--ink-soft)]">
            Registrada ·{" "}
            <Link
              to="/financeiro"
              className="inline-flex min-h-6 items-center text-[var(--secondary-text)] hover:underline"
            >
              ver no Financeiro
            </Link>
          </span>
        ) : mostrarAcaoRegistrar ? (
          <button type="button" onClick={abrirPopover} className={`${BTN_MIUDO} shrink-0`}>
            Registrar venda →
          </button>
        ) : null}
        <MenuOpcoes
          ariaLabel={`Opções da cliente ${cliente.nome}`}
          itens={[
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
    </div>
  );
}

/* ============== Modal: nova cliente / editar cliente ============== */
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
    if (!nome.trim()) {
      setErro("Nome é obrigatório.");
      return;
    }
    const valorNumero = valor.trim() === "" ? null : Number(valor);
    if (valorNumero !== null && (!Number.isFinite(valorNumero) || valorNumero < 0)) {
      setErro("O valor precisa ser um número igual ou maior que zero.");
      return;
    }
    setSalvando(true);
    setErro(null);
    // Sem user_id nem venda_registrada no payload da edição: a dona não muda, e
    // a marca de venda registrada só a RPC registrar_venda_cliente mexe.
    const campos: Record<string, unknown> = {
      nome: nome.trim(),
      contato: contato.trim() || null,
      status_pedido: statusPedido || null,
      notas: notas.trim() || null,
      valor: valorNumero,
      produto_id: produtoId || null,
    };
    const tabela = supabase.from("clientes" as never) as unknown as {
      insert: (p: Record<string, unknown>) => Promise<{ error: unknown }>;
      update: (p: Record<string, unknown>) => {
        eq: (c: string, v: string) => Promise<{ error: unknown }>;
      };
    };
    const { error } = cliente
      ? await tabela
          .update({ ...campos, updated_at: new Date().toISOString() })
          .eq("id", cliente.id)
      : await tabela.insert({ ...campos, user_id: userId });
    setSalvando(false);
    if (error) {
      // Técnico no log, frase da Pólia na tela (mesmo padrão do modal de lançamento).
      console.error(editando ? "cliente_editar" : "cliente_criar", error);
      setErro("A Pólia One não conseguiu salvar a cliente agora. Tenta de novo.");
      return;
    }
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

  const statusOptions = STATUS_PEDIDO_OPTIONS;

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
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </>
      }
    >
      <div className="mb-4">
        <Campo label="Nome" required>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            placeholder="Ex: Marina Duarte"
          />
        </Campo>
      </div>

      <div className="mb-4">
        <Campo label="Contato">
          <input
            value={contato}
            onChange={(e) => setContato(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            placeholder="@instagram ou telefone"
          />
        </Campo>
      </div>

      <div className="mb-4">
        <p id="cliente-status-rotulo" className="mb-1 block text-[12px] text-[var(--muted)]">
          Status do pedido
        </p>
        <div role="group" aria-labelledby="cliente-status-rotulo" className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStatusPedido("")}
            aria-pressed={statusPedido === ""}
            className={`${BTN_MIUDO} ${statusPedido === "" ? "!bg-[var(--secondary)]" : "bg-white"}`}
          >
            Sem pedido
          </button>
          {statusOptions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusPedido(s)}
              aria-pressed={statusPedido === s}
              className={`${BTN_MIUDO} ${statusPedido === s ? "!bg-[var(--secondary)]" : "bg-white"}`}
            >
              {s}
            </button>
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
                {p.nome} · R$ {Number(p.preco_venda).toLocaleString("pt-BR")}
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
