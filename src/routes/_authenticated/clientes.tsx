import { useMemo, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Suas vendas e clientes — Pólia" },
      {
        name: "description",
        content:
          "Hub vivo de vendas e clientes: roteiro de fechamento, protocolo de cuidado e plano de conteúdo.",
      },
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
  created_at: string;
}

interface Entregavel {
  id: string;
  etapa: number;
  tipo: string;
  conteudo: Record<string, unknown> | null;
}

type TabId = "clientes" | "vendas" | "cuidado" | "conteudo";

function statusPedidoCor(status: StatusPedido) {
  switch (status) {
    case "Em produção":
      return "bg-[rgba(201,107,62,0.1)] text-[#C96B3E]";
    case "Entregue":
      return "bg-[rgba(44,106,79,0.1)] text-[#2D6A4F]";
    case "Em espera":
      return "bg-[rgba(200,169,110,0.15)] text-[#C8A96E]";
    case "Atrasado":
      return "bg-[rgba(201,64,122,0.1)] text-[#C9407A]";
  }
}

function ClientesPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [tabAtiva, setTabAtiva] = useState<TabId>("clientes");
  const [modalClienteAberto, setModalClienteAberto] = useState(false);

  const dadosQuery = useQuery({
    queryKey: ["clientes-hub", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [profileRes, progressRes, entregaveisRes, clientesRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select(
              "full_name, etapa_atual, streak, orbit_sales_unlocked, orbit_sales_active",
            )
            .eq("id", userId!)
            .maybeSingle(),
          supabase
            .from("user_progress")
            .select("etapa_atual")
            .eq("user_id", userId!)
            .maybeSingle(),
          supabase
            .from("entregaveis")
            .select("id, etapa, tipo, conteudo")
            .eq("user_id", userId!)
            .in("etapa", [7, 8, 9])
            .eq("status", "concluido"),
          (supabase.from("clientes" as never) as unknown as {
            select: (s: string) => {
              eq: (c: string, v: string) => {
                order: (
                  c: string,
                  o: { ascending: boolean },
                ) => Promise<{ data: Cliente[] | null }>;
              };
            };
          })
            .select("*")
            .eq("user_id", userId!)
            .order("created_at", { ascending: false }),
        ]);

      const clientes = ((clientesRes as { data: Cliente[] | null }).data ?? []) as Cliente[];

      return {
        profile: profileRes.data,
        etapaAtual:
          progressRes.data?.etapa_atual ?? profileRes.data?.etapa_atual ?? 1,
        entregaveis: (entregaveisRes.data ?? []) as Entregavel[],
        clientes,
      };
    },
  });

  const profile = dadosQuery.data?.profile;
  const entregaveis = dadosQuery.data?.entregaveis ?? [];
  const clientes = dadosQuery.data?.clientes ?? [];
  const etapaAtual = dadosQuery.data?.etapaAtual ?? 1;

  const orbitUnlocked = profile?.orbit_sales_unlocked ?? false;
  const orbitActive = profile?.orbit_sales_active ?? false;

  const roteiro = useMemo(
    () => entregaveis.find((e) => e.etapa === 7),
    [entregaveis],
  );
  const protocolo = useMemo(
    () => entregaveis.find((e) => e.etapa === 8),
    [entregaveis],
  );
  const plano = useMemo(
    () => entregaveis.find((e) => e.etapa === 9),
    [entregaveis],
  );

  const initial = (profile?.full_name?.charAt(0) || "P").toUpperCase();
  const streak = (profile as { streak?: number } | null)?.streak ?? 0;

  if (dadosQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#FDF8F5] flex items-center justify-center">
        <p className="font-handwritten text-[#1A1A2E] text-[18px] opacity-40">
          carregando...
        </p>
      </div>
    );
  }

  // ESTADO BLOQUEADO
  if (!orbitUnlocked) {
    return (
      <div className="min-h-screen bg-[#1A1A2E] flex flex-col items-center justify-center text-center px-8">
        <p className="font-accent text-[#C96B3E] text-[11px] tracking-[2px] uppercase mb-4">
          SUAS VENDAS E CLIENTES
        </p>
        <h1 className="font-serif text-[#FDF8F5] text-[48px] leading-tight mb-4 max-w-[520px]">
          Essa ferramenta entra em órbita quando você chegar na Etapa 7.
        </h1>
        <p className="font-sans text-[#D8D2CC] text-[16px] max-w-[440px] mb-8">
          Complete as etapas de Venda pra montar seu fluxo de vendas, protocolo
          de cuidado e plano de conteúdo.
        </p>
        <button
          onClick={() => navigate({ to: `/etapa/${etapaAtual}` as string })}
          className="bg-[#C96B3E] text-[#FDF8F5] font-sans font-semibold text-[16px] px-8 py-3.5 rounded-xl hover:bg-[#B85A2D] transition-colors"
        >
          Continuar minha jornada →
        </button>
        <p className="font-handwritten text-[#D8D2CC] text-[14px] mt-4 opacity-50">
          falta pouco.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <PainelNav initial={initial} streak={streak} navActive="/clientes" />

      {/* Cabeçalho */}
      <div className="px-12 pt-10">
        <div className="flex items-end justify-between mb-8 max-w-[1280px] mx-auto">
          <div>
            <p className="font-accent text-[#C96B3E] text-[11px] tracking-[2px] uppercase mb-2">
              SUAS VENDAS E CLIENTES
            </p>
            <h1 className="font-serif text-[#1A1A2E] text-[44px] leading-tight">
              Do primeiro contato ao sim.
            </h1>
            <p className="font-handwritten text-[#C96B3E] text-[17px] mt-2">
              {orbitActive
                ? "fluxo completo: vendas, cuidado e conteúdo."
                : "vendas e cuidado montados. conteúdo vem na Etapa 9."}
            </p>
          </div>
          <div className="w-[100px] h-[110px] border border-dashed border-[#C96B3E] rounded-2xl flex flex-col items-center justify-center gap-1 bg-[rgba(201,107,62,0.04)]">
            <span className="font-accent text-[#C96B3E] text-[8px] tracking-[1px] font-bold">
              RAPOSA
            </span>
            <span className="font-sans text-[#C96B3E] text-[8px] opacity-70">
              ANIMADA
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-12">
        <div className="flex gap-1 border-b border-[rgba(26,26,46,0.08)] max-w-[1280px] mx-auto">
          {(
            [
              { id: "clientes", label: "Clientes", bloqueado: false },
              { id: "vendas", label: "Fluxo de vendas", bloqueado: false },
              { id: "cuidado", label: "Protocolo de cuidado", bloqueado: false },
              {
                id: "conteudo",
                label: "Plano de conteúdo",
                bloqueado: !orbitActive,
              },
            ] as { id: TabId; label: string; bloqueado: boolean }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTabAtiva(tab.id)}
              className={`font-sans text-[14px] px-5 py-3 border-b-2 transition-colors ${
                tabAtiva === tab.id
                  ? "border-[#C96B3E] text-[#C96B3E] font-semibold"
                  : "border-transparent text-[#1A1A2E] opacity-50 hover:opacity-80"
              }`}
            >
              {tab.label}
              {tab.bloqueado && (
                <span className="font-sans text-[10px] ml-2 opacity-50">
                  · Etapa 9
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo das tabs */}
      <div className="px-12 py-10">
        <div className="max-w-[1280px] mx-auto">
          {tabAtiva === "clientes" && (
            <TabClientes
              clientes={clientes}
              onAdicionar={() => setModalClienteAberto(true)}
            />
          )}
          {tabAtiva === "vendas" && (
            <TabEntregavelE7
              entregavel={roteiro}
              onIrEtapa={() => navigate({ to: "/etapa/7" })}
            />
          )}
          {tabAtiva === "cuidado" && (
            <TabEntregavelE8
              entregavel={protocolo}
              onIrEtapa={() => navigate({ to: "/etapa/8" })}
            />
          )}
          {tabAtiva === "conteudo" && (
            <TabEntregavelE9
              entregavel={plano}
              bloqueado={!orbitActive}
              onIrEtapa={() => navigate({ to: "/etapa/9" })}
            />
          )}
        </div>
      </div>

      {modalClienteAberto && userId && (
        <ModalCliente
          userId={userId}
          onClose={() => setModalClienteAberto(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["clientes-hub", userId] });
            setModalClienteAberto(false);
          }}
        />
      )}
    </div>
  );
}

/* ============== TAB 1 — CLIENTES ============== */
function TabClientes({
  clientes,
  onAdicionar,
}: {
  clientes: Cliente[];
  onAdicionar: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-serif text-[#1A1A2E] text-[28px]">
            Suas clientes
          </h2>
          <p className="font-sans text-[#1A1A2E] text-[13px] opacity-50 mt-1">
            {clientes.length} cadastradas
          </p>
        </div>
        <button
          onClick={onAdicionar}
          className="font-sans text-[14px] font-semibold text-[#FDF8F5] bg-[#C96B3E] px-5 py-2.5 rounded-xl hover:bg-[#B85A2D] transition-colors"
        >
          + Adicionar cliente
        </button>
      </div>

      {clientes.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-[rgba(26,26,46,0.08)] rounded-2xl">
          <p className="font-handwritten text-[#1A1A2E] text-[18px] opacity-35">
            adicione sua primeira cliente aqui.
          </p>
        </div>
      ) : (
        clientes.map((cliente) => (
          <div
            key={cliente.id}
            className="bg-white rounded-xl p-5 border border-[rgba(26,26,46,0.06)] mb-3 flex items-center justify-between hover:border-[rgba(201,107,62,0.15)] transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[rgba(201,107,62,0.12)] flex items-center justify-center">
                <span className="font-sans font-semibold text-[#C96B3E] text-[16px]">
                  {cliente.nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-sans text-[#1A1A2E] text-[15px] font-semibold">
                  {cliente.nome}
                </p>
                <p className="font-sans text-[#1A1A2E] text-[12px] opacity-40">
                  {cliente.contato || "sem contato"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {cliente.status_pedido && (
                <span
                  className={`font-sans text-[11px] px-3 py-1 rounded-full ${statusPedidoCor(cliente.status_pedido)}`}
                >
                  {cliente.status_pedido}
                </span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ============== Card de entregável genérico ============== */
function CardEntregavel({
  selo,
  titulo,
  blocos,
  destaque,
}: {
  selo: string;
  titulo: string;
  blocos: { label: string; conteudo: string }[];
  destaque?: { label: string; texto: string };
}) {
  return (
    <div className="bg-white rounded-2xl p-8 border border-[rgba(26,26,46,0.06)] max-w-[760px]">
      <p className="font-accent text-[#C96B3E] text-[10px] tracking-[2px] uppercase mb-2">
        {selo}
      </p>
      <p className="font-serif text-[#1A1A2E] text-[20px] mb-6">{titulo}</p>
      {blocos.map((item, i) => (
        <div
          key={item.label}
          className={`mb-5 pb-5 ${
            i === blocos.length - 1
              ? "border-none mb-0 pb-0"
              : "border-b border-[rgba(26,26,46,0.06)]"
          }`}
        >
          <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 mb-2">
            {item.label}
          </p>
          <p className="font-sans text-[#1A1A2E] text-[15px] leading-relaxed">
            {item.conteudo}
          </p>
        </div>
      ))}
      {destaque && (
        <div className="mt-6 bg-[rgba(201,107,62,0.04)] border border-[rgba(201,107,62,0.15)] rounded-xl p-5">
          <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#C96B3E] mb-2">
            {destaque.label}
          </p>
          <p className="font-handwritten text-[#1A1A2E] text-[17px] leading-relaxed">
            "{destaque.texto}"
          </p>
        </div>
      )}
    </div>
  );
}

function EstadoVazioEntregavel({
  texto,
  ctaTexto,
  onClick,
}: {
  texto: string;
  ctaTexto: string;
  onClick: () => void;
}) {
  return (
    <div className="text-center py-16">
      <p className="font-sans text-[#1A1A2E] text-[15px] opacity-40 mb-4">
        {texto}
      </p>
      <button
        onClick={onClick}
        className="font-sans text-[#C96B3E] text-[14px] hover:underline"
      >
        {ctaTexto}
      </button>
    </div>
  );
}

/* ============== TAB 2 — E7 ============== */
function TabEntregavelE7({
  entregavel,
  onIrEtapa,
}: {
  entregavel?: Entregavel;
  onIrEtapa: () => void;
}) {
  if (!entregavel || !entregavel.conteudo) {
    return (
      <EstadoVazioEntregavel
        texto="Complete a Etapa 7 pra gerar seu roteiro de fechamento."
        ctaTexto="Ir pra Etapa 7 →"
        onClick={onIrEtapa}
      />
    );
  }
  const c = entregavel.conteudo as {
    passo_descoberta?: string;
    passo_decisao?: string;
    passo_fechamento?: string;
    mensagem_fechamento?: string;
  };
  return (
    <CardEntregavel
      selo="ENTREGÁVEL · ETAPA 7"
      titulo="Do primeiro contato ao sim"
      blocos={[
        { label: "COMO ELA TE DESCOBRE", conteudo: c.passo_descoberta || "" },
        { label: "O QUE A CONVENCE", conteudo: c.passo_decisao || "" },
        { label: "COMO VOCÊ FECHA", conteudo: c.passo_fechamento || "" },
      ]}
      destaque={{
        label: "SUA MENSAGEM DE FECHAMENTO",
        texto: c.mensagem_fechamento || "",
      }}
    />
  );
}

/* ============== TAB 3 — E8 ============== */
function TabEntregavelE8({
  entregavel,
  onIrEtapa,
}: {
  entregavel?: Entregavel;
  onIrEtapa: () => void;
}) {
  if (!entregavel || !entregavel.conteudo) {
    return (
      <EstadoVazioEntregavel
        texto="Complete a Etapa 8 pra gerar seu protocolo de cuidado."
        ctaTexto="Ir pra Etapa 8 →"
        onClick={onIrEtapa}
      />
    );
  }
  const c = entregavel.conteudo as {
    boas_vindas?: string;
    resolucao?: string;
    fidelizacao?: string;
    mensagem_pos_entrega?: string;
  };
  return (
    <CardEntregavel
      selo="ENTREGÁVEL · ETAPA 8"
      titulo="Seu protocolo de cuidado"
      blocos={[
        { label: "BOAS-VINDAS", conteudo: c.boas_vindas || "" },
        { label: "QUANDO ALGO DÁ ERRADO", conteudo: c.resolucao || "" },
        { label: "COMO FIDELIZA", conteudo: c.fidelizacao || "" },
      ]}
      destaque={{
        label: "MENSAGEM PÓS-ENTREGA",
        texto: c.mensagem_pos_entrega || "",
      }}
    />
  );
}

/* ============== TAB 4 — E9 ============== */
function TabEntregavelE9({
  entregavel,
  bloqueado,
  onIrEtapa,
}: {
  entregavel?: Entregavel;
  bloqueado: boolean;
  onIrEtapa: () => void;
}) {
  if (bloqueado || !entregavel || !entregavel.conteudo) {
    return (
      <EstadoVazioEntregavel
        texto="Complete a Etapa 9 pra gerar seu plano de conteúdo."
        ctaTexto="Ir pra Etapa 9 →"
        onClick={onIrEtapa}
      />
    );
  }
  const c = entregavel.conteudo as {
    tipos_conteudo?: string;
    gatilhos_parada?: string;
    ritmo_sugerido?: string;
    ideias?: string[];
  };
  return (
    <div className="bg-white rounded-2xl p-8 border border-[rgba(26,26,46,0.06)] max-w-[760px]">
      <p className="font-accent text-[#C96B3E] text-[10px] tracking-[2px] uppercase mb-2">
        ENTREGÁVEL · ETAPA 9
      </p>
      <p className="font-serif text-[#1A1A2E] text-[20px] mb-6">
        Seu plano de conteúdo
      </p>
      {[
        { label: "O QUE ELA QUER VER", conteudo: c.tipos_conteudo || "" },
        { label: "O QUE PARA O SCROLL", conteudo: c.gatilhos_parada || "" },
        { label: "SEU RITMO IDEAL", conteudo: c.ritmo_sugerido || "" },
      ].map((item) => (
        <div
          key={item.label}
          className="mb-5 pb-5 border-b border-[rgba(26,26,46,0.06)]"
        >
          <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 mb-2">
            {item.label}
          </p>
          <p className="font-sans text-[#1A1A2E] text-[15px] leading-relaxed">
            {item.conteudo}
          </p>
        </div>
      ))}
      <div className="mt-6 pt-2">
        <p className="font-accent text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 mb-4">
          3 IDEIAS DE CONTEÚDO PARA COMEÇAR
        </p>
        {(c.ideias ?? []).map((ideia, i) => (
          <div key={i} className="flex gap-3 mb-3">
            <span className="font-serif text-[#C96B3E] text-[18px] leading-none mt-0.5">
              {i + 1}
            </span>
            <p className="font-handwritten text-[#1A1A2E] text-[16px] leading-snug">
              {ideia}
            </p>
          </div>
        ))}
      </div>
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
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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

  const statusOptions: StatusPedido[] = [
    "Em espera",
    "Em produção",
    "Entregue",
    "Atrasado",
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(26,26,46,0.5)] px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-8 w-full max-w-[480px]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-accent text-[#C96B3E] text-[10px] tracking-[2px] uppercase mb-2">
          NOVA CLIENTE
        </p>
        <h2 className="font-serif text-[#1A1A2E] text-[26px] mb-6">
          Adicionar cliente
        </h2>

        <div className="mb-4">
          <label className="font-sans text-[12px] text-[#1A1A2E] opacity-60 block mb-1">
            Nome
          </label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full border border-[rgba(26,26,46,0.12)] rounded-lg px-3 py-2 font-sans text-[14px] text-[#1A1A2E] focus:outline-none focus:border-[#C96B3E]"
            placeholder="Ana"
          />
        </div>

        <div className="mb-4">
          <label className="font-sans text-[12px] text-[#1A1A2E] opacity-60 block mb-1">
            Contato
          </label>
          <input
            value={contato}
            onChange={(e) => setContato(e.target.value)}
            className="w-full border border-[rgba(26,26,46,0.12)] rounded-lg px-3 py-2 font-sans text-[14px] text-[#1A1A2E] focus:outline-none focus:border-[#C96B3E]"
            placeholder="@instagram ou telefone"
          />
        </div>

        <div className="mb-4">
          <label className="font-sans text-[12px] text-[#1A1A2E] opacity-60 block mb-1">
            Status do pedido
          </label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setStatusPedido("")}
              className={`font-sans text-[12px] px-3 py-1.5 rounded-full border ${
                statusPedido === ""
                  ? "border-[#C96B3E] text-[#C96B3E]"
                  : "border-[rgba(26,26,46,0.12)] text-[#1A1A2E] opacity-60"
              }`}
            >
              Sem pedido
            </button>
            {statusOptions.map((s) => (
              <button
                key={s}
                onClick={() => setStatusPedido(s)}
                className={`font-sans text-[12px] px-3 py-1.5 rounded-full border ${
                  statusPedido === s
                    ? "border-[#C96B3E] text-[#C96B3E]"
                    : "border-[rgba(26,26,46,0.12)] text-[#1A1A2E] opacity-60"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="font-sans text-[12px] text-[#1A1A2E] opacity-60 block mb-1">
            Notas
          </label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            className="w-full border border-[rgba(26,26,46,0.12)] rounded-lg px-3 py-2 font-sans text-[14px] text-[#1A1A2E] focus:outline-none focus:border-[#C96B3E] resize-none"
          />
        </div>

        {erro && (
          <p className="font-sans text-[13px] text-[#C9407A] mb-3">{erro}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="font-sans text-[14px] text-[#1A1A2E] opacity-60 hover:opacity-100 px-4 py-2"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="font-sans text-[14px] font-semibold text-[#FDF8F5] bg-[#C96B3E] px-5 py-2 rounded-xl hover:bg-[#B85A2D] transition-colors disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
