import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import { toastErro, toastSucesso } from "@/lib/toast";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Seus clientes · Pólia" },
      { name: "description", content: "Suas clientes, do primeiro contato ao pós-venda." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .maybeSingle();
    if (profile && profile.onboarding_completed === false) {
      throw redirect({ to: "/painel" });
    }
  },
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

function ClientesPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const [modalAberto, setModalAberto] = useState(false);

  const dadosQuery = useQuery({
    queryKey: ["clientes-hub", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [profileRes, clientesRes, produtosRes] = await Promise.all([
        supabase.from("profiles").select("full_name, streak").eq("id", userId!).maybeSingle(),
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
                ) => Promise<{ data: Cliente[] | null }>;
              };
            };
          }
        )
          .select("*")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false }),
        supabase.from("produtos").select("id, nome").eq("user_id", userId!),
      ]);
      return {
        profile: profileRes.data as { full_name: string | null; streak: number | null } | null,
        clientes: ((clientesRes as { data: Cliente[] | null }).data ?? []) as Cliente[],
        produtos: (produtosRes.data ?? []) as Produto[],
      };
    },
  });

  const profile = dadosQuery.data?.profile;
  const clientes = dadosQuery.data?.clientes ?? [];
  const produtos = dadosQuery.data?.produtos ?? [];
  const initial = (profile?.full_name?.charAt(0) || "P").toUpperCase();
  const streak = profile?.streak ?? 0;

  const nomeProduto = (produtoId: string | null) => {
    if (!produtoId) return "sem produto";
    return produtos.find((p) => p.id === produtoId)?.nome || "sem produto";
  };

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <PainelNav initial={initial} streak={streak} navActive="/clientes" />

      <div className="mx-auto max-w-[880px] px-6 py-12 md:px-10">
        <header className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
              SEUS CLIENTES
            </p>
            <h1 className="font-fraunces text-[clamp(28px,5vw,44px)] leading-tight text-[var(--ink)]">
              Do primeiro contato ao sim.
            </h1>
            <p className="mt-2 font-fraunces italic text-[15px] text-[var(--ink-soft)]">
              suas clientes e seus pedidos, num lugar só.
            </p>
          </div>
          <button
            onClick={() => setModalAberto(true)}
            className="shrink-0 rounded-xl bg-[var(--secondary)] px-5 py-2.5 font-sans text-[14px] font-semibold text-[var(--secondary-ink)] transition-opacity hover:opacity-90"
          >
            + Adicionar cliente
          </button>
        </header>

        {dadosQuery.isLoading ? (
          <p className="py-16 text-center font-fraunces italic text-[15px] text-[var(--muted)]">
            carregando…
          </p>
        ) : clientes.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[var(--line)] py-16 text-center">
            <p className="font-fraunces italic text-[15px] text-[var(--muted)]">
              adicione sua primeira cliente aqui.
            </p>
          </div>
        ) : (
          <div>
            {clientes.map((cliente) => (
              <LinhaCliente
                key={cliente.id}
                cliente={cliente}
                nomeProduto={nomeProduto(cliente.produto_id)}
                userId={userId!}
                onRegistrado={() => qc.invalidateQueries({ queryKey: ["clientes-hub", userId] })}
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
    </div>
  );
}

/* ============== Linha da lista + popover de registro ============== */
function LinhaCliente({
  cliente,
  nomeProduto,
  userId,
  onRegistrado,
}: {
  cliente: Cliente;
  nomeProduto: string;
  userId: string;
  onRegistrado: () => void;
}) {
  const [popAberto, setPopAberto] = useState(false);
  const [duplicataData, setDuplicataData] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popAberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopAberto(false);
      }
    };
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [popAberto]);

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
      .gte("data", seteDiasAtras.toISOString().slice(0, 10));
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
          : "Não consegui registrar a venda no Financeiro. Tenta de novo.",
      );
      // Recarrega a lista mesmo no erro "já registrada" pra sumir com o botão desatualizado.
      if (jaRegistrada) onRegistrado();
      return;
    }
    setPopAberto(false);
    onRegistrado();
    toastSucesso("Venda registrada no Financeiro.");
  };

  const mostrarAcaoRegistrar = cliente.status_pedido === "Entregue" && !cliente.venda_registrada;

  return (
    <div
      ref={containerRef}
      className="relative mb-3 flex items-center justify-between rounded-xl border border-[var(--line)] bg-white p-5 transition-colors hover:border-[var(--secondary)] hover:bg-[var(--secondary-light)]"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]">
          <span className="font-sans text-[16px] font-semibold text-[var(--accent-ink)]">
            {cliente.nome.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <p className="font-sans text-[15px] font-semibold text-[var(--ink)]">{cliente.nome}</p>
          <p className="font-sans text-[12px] text-[var(--muted)]">
            {cliente.contato || "sem contato"}
          </p>
          <p className="mt-0.5 font-sans text-[13px] text-[var(--ink-soft)]">
            {nomeProduto}
            {formatarValorBRL(cliente.valor) ? ` · ${formatarValorBRL(cliente.valor)}` : ""}
            {` · ${formatarDataCurta(cliente.created_at)}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {cliente.status_pedido && (
          <span
            className={`font-sans text-[11px] px-3 py-1 rounded ${statusPedidoCor(cliente.status_pedido)}`}
          >
            {cliente.status_pedido}
          </span>
        )}
        {cliente.venda_registrada ? (
          <span className="shrink-0 font-sans text-[13px] text-[var(--ink-soft)]">
            Registrada ·{" "}
            <Link to="/financeiro" className="text-[var(--secondary-text)] hover:underline">
              ver no Financeiro
            </Link>
          </span>
        ) : mostrarAcaoRegistrar ? (
          <button
            onClick={abrirPopover}
            className="shrink-0 font-sans text-[14px] text-[var(--ink-soft)] underline decoration-transparent underline-offset-4 transition-colors hover:decoration-[var(--secondary-ink)]"
          >
            Registrar venda →
          </button>
        ) : null}
      </div>

      {popAberto && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-10 w-[300px] rounded-xl border border-[var(--line)] bg-white p-4 text-left shadow-[0_4px_12px_rgba(10,10,10,0.08)]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-sans text-[14px] font-semibold text-[var(--ink)]">
            Registrar no Financeiro
          </p>
          <p className="mt-1 font-sans text-[13px] text-[var(--ink-soft)]">
            {nomeProduto}
            {formatarValorBRL(cliente.valor) ? ` · ${formatarValorBRL(cliente.valor)}` : ""}
            {` · categoria: Venda de produto`}
          </p>
          {duplicataData && (
            <p className="mt-3 rounded-lg bg-[var(--bg)] px-3 py-2 font-sans text-[12.5px] text-[var(--ink-soft)]">
              Já existe um lançamento parecido em {formatarDataCurta(duplicataData)}. Registrar
              mesmo assim?
            </p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setPopAberto(false)}
              className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 font-sans text-[13px] text-[var(--ink)]"
            >
              Cancelar
            </button>
            <button
              onClick={registrar}
              disabled={registrando}
              className="rounded-md border border-[var(--secondary)] bg-[var(--secondary)] px-3 py-1.5 font-sans text-[13px] font-medium text-[var(--secondary-ink)] disabled:opacity-50"
            >
              {registrando ? "Registrando..." : duplicataData ? "Registrar mesmo assim" : "Registrar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============== Modal: novo cliente ============== */
function ModalCliente({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [statusPedido, setStatusPedido] = useState<StatusPedido | "">("");
  const [notas, setNotas] = useState("");
  const [valor, setValor] = useState("");
  const [produtoId, setProdutoId] = useState("");
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
    setSalvando(true);
    setErro(null);
    const payload: Record<string, unknown> = {
      user_id: userId,
      nome: nome.trim(),
      contato: contato.trim() || null,
      status_pedido: statusPedido || null,
      notas: notas.trim() || null,
      valor: valor ? Number(valor) : null,
      produto_id: produtoId || null,
    };
    const { error } = await (
      supabase.from("clientes" as never) as unknown as {
        insert: (p: Record<string, unknown>) => Promise<{ error: unknown }>;
      }
    ).insert(payload);
    setSalvando(false);
    if (error) {
      setErro((error as { message?: string }).message || "Erro ao salvar.");
      return;
    }
    onSaved();
  };

  const statusOptions: StatusPedido[] = ["Em espera", "Em produção", "Entregue", "Atrasado"];

  return (
    <div
      className="polia-v3 fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/50 px-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-2xl bg-white p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
          NOVA CLIENTE
        </p>
        <h2 className="mb-6 font-fraunces text-[26px] text-[var(--ink)]">Adicionar cliente</h2>

        <div className="mb-4">
          <label className="mb-1 block font-sans text-[12px] text-[var(--muted)]">Nome</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 font-sans text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
            placeholder="Ana"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block font-sans text-[12px] text-[var(--muted)]">Contato</label>
          <input
            value={contato}
            onChange={(e) => setContato(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 font-sans text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
            placeholder="@instagram ou telefone"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block font-sans text-[12px] text-[var(--muted)]">
            Status do pedido
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusPedido("")}
              className={`rounded border px-3 py-1.5 font-sans text-[12px] ${
                statusPedido === ""
                  ? "border-[var(--secondary)] bg-[var(--secondary-light)] text-[var(--secondary-text)]"
                  : "border-[var(--line)] text-[var(--muted)]"
              }`}
            >
              Sem pedido
            </button>
            {statusOptions.map((s) => (
              <button
                key={s}
                onClick={() => setStatusPedido(s)}
                className={`rounded border px-3 py-1.5 font-sans text-[12px] ${
                  statusPedido === s
                    ? "border-[var(--secondary)] bg-[var(--secondary-light)] text-[var(--secondary-text)]"
                    : "border-[var(--line)] text-[var(--muted)]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block font-sans text-[12px] text-[var(--muted)]">
            Produto (opcional)
          </label>
          <select
            value={produtoId}
            onChange={(e) => selecionarProduto(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-sans text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:outline-none"
          >
            <option value="">Sem produto</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} · R$ {Number(p.preco_venda).toLocaleString("pt-BR")}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-1 block font-sans text-[12px] text-[var(--muted)]">
            Valor da venda (R$)
          </label>
          <input
            type="number"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 font-sans text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
            placeholder="0"
          />
        </div>

        <div className="mb-6">
          <label className="mb-1 block font-sans text-[12px] text-[var(--muted)]">Notas</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-[var(--line)] px-3 py-2 font-sans text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
          />
        </div>

        {erro && <p className="mb-3 font-sans text-[13px] text-[var(--danger)]">{erro}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 font-sans text-[14px] text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="rounded-xl bg-[var(--secondary)] px-5 py-2 font-sans text-[14px] font-semibold text-[var(--secondary-ink)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
