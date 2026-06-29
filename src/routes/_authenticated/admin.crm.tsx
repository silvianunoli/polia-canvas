import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/crm")({
  head: () => ({
    meta: [{ title: "CRM · Pólia" }],
  }),
  component: AdminCRM,
});

interface Cliente {
  id: string;
  full_name: string | null;
  etapa_atual: number | null;
  plano: string | null;
  onboarding_completed: boolean | null;
  updated_at: string;
  created_at: string;
}

interface Convite {
  id: string;
  nome: string;
  email: string;
  tipo_negocio: string | null;
  criado_em: string;
}

type StatusKey = "lead" | "ativa" | "morna" | "sumida";

function statusKey(c: Cliente): StatusKey {
  if (!c.onboarding_completed) return "lead";
  const dias = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86_400_000);
  if (dias <= 7) return "ativa";
  if (dias > 30) return "sumida";
  return "morna";
}

const STATUS_META: Record<StatusKey, { label: string; bg: string; cor: string }> = {
  lead: { label: "Lead", bg: "rgba(184,134,46,0.12)", cor: "#B8862E" },
  ativa: { label: "Ativa", bg: "rgba(45,106,79,0.1)", cor: "#2D6A4F" },
  morna: { label: "Morna", bg: "rgba(26,26,46,0.06)", cor: "#1A1A2E" },
  sumida: { label: "Sumida", bg: "rgba(201,64,122,0.1)", cor: "#C9407A" },
};

function AdminCRM() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: profs }, { data: espera }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,full_name,etapa_atual,plano,onboarding_completed,updated_at,created_at")
          .order("updated_at", { ascending: false })
          .limit(300),
        supabase
          .from("lista_espera")
          .select("id, nome, email, tipo_negocio, criado_em")
          .order("criado_em", { ascending: false })
          .limit(300),
      ]);
      setClientes((profs ?? []) as Cliente[]);
      setConvites((espera ?? []) as Convite[]);
    })();
  }, []);

  const contagem = useMemo(() => {
    const c: Record<StatusKey, number> = { lead: 0, ativa: 0, morna: 0, sumida: 0 };
    clientes.forEach((cl) => c[statusKey(cl)]++);
    return c;
  }, [clientes]);

  const filtrados = useMemo(() => {
    return clientes.filter((c) => {
      if (filtroStatus && statusKey(c) !== filtroStatus) return false;
      if (busca && !c.full_name?.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [clientes, filtroStatus, busca]);

  return (
    <>
      <h1 className="mb-1 font-serif text-[40px] text-[#1A1A2E]">CRM</h1>
      <p className="mb-6 font-sans text-[14px] text-[#1A1A2E] opacity-50">
        Suas clientes da Pólia e quem está na fila do beta.
      </p>

      <Tabs defaultValue="clientes">
        <TabsList className="mb-6 bg-[rgba(26,26,46,0.04)]">
          <TabsTrigger value="clientes">Clientes · {clientes.length}</TabsTrigger>
          <TabsTrigger value="convites">Convites · {convites.length}</TabsTrigger>
        </TabsList>

        {/* CLIENTES */}
        <TabsContent value="clientes">
          {/* KPI pills */}
          <div className="mb-5 flex flex-wrap gap-2">
            <KpiPill
              label="Total"
              valor={clientes.length}
              ativo={filtroStatus === ""}
              onClick={() => setFiltroStatus("")}
            />
            {(["lead", "ativa", "morna", "sumida"] as StatusKey[]).map((k) => (
              <KpiPill
                key={k}
                label={STATUS_META[k].label}
                valor={contagem[k]}
                cor={STATUS_META[k].cor}
                ativo={filtroStatus === k}
                onClick={() => setFiltroStatus(filtroStatus === k ? "" : k)}
              />
            ))}
          </div>

          <input
            type="text"
            placeholder="Buscar por nome"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="mb-5 w-full rounded-xl border border-[rgba(26,26,46,0.12)] bg-white px-4 py-2 font-sans text-[14px] text-[#1A1A2E] focus:border-[#C96B3E] focus:outline-none sm:max-w-[320px]"
          />

          <div className="overflow-x-auto rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-[rgba(26,26,46,0.06)]">
                  {["Cliente", "Status", "Plano", "Etapa", "Cadastro", "Ações"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left font-mono text-[9px] uppercase tracking-[1.5px] text-[#1A1A2E] opacity-40"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => {
                  const st = STATUS_META[statusKey(c)];
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-[rgba(26,26,46,0.04)] hover:bg-[rgba(26,26,46,0.02)]"
                    >
                      <td className="px-5 py-3 font-sans text-[14px] text-[#1A1A2E]">
                        {c.full_name ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="rounded-full px-2.5 py-1 font-sans text-[11px] font-medium"
                          style={{ background: st.bg, color: st.cor }}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-[rgba(26,26,46,0.05)] px-2 py-1 font-mono text-[10px] uppercase tracking-[1px] text-[#1A1A2E] opacity-70">
                          {c.plano ?? "beta"}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-sans text-[13px] text-[#1A1A2E] opacity-60">
                        E{c.etapa_atual ?? 1}
                      </td>
                      <td className="px-5 py-3 font-sans text-[13px] text-[#1A1A2E] opacity-50">
                        {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            navigate({ to: "/admin/usuarios/$id", params: { id: c.id } })
                          }
                          className="font-sans text-[13px] text-[#C96B3E] hover:underline"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-8 text-center font-sans text-[13px] text-[#1A1A2E] opacity-40"
                    >
                      Nenhuma cliente encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* CONVITES (lista de espera do beta) */}
        <TabsContent value="convites">
          <p className="mb-4 font-sans text-[13px] text-[#1A1A2E] opacity-55">
            Quem entrou na lista de espera e ainda não está usando a Pólia.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-[rgba(26,26,46,0.06)]">
                  {["Nome", "E-mail", "Tipo de negócio", "Entrou na fila"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left font-mono text-[9px] uppercase tracking-[1.5px] text-[#1A1A2E] opacity-40"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {convites.map((v) => (
                  <tr key={v.id} className="border-b border-[rgba(26,26,46,0.04)]">
                    <td className="px-5 py-3 font-sans text-[14px] text-[#1A1A2E]">{v.nome}</td>
                    <td className="px-5 py-3 font-sans text-[13px] text-[#1A1A2E] opacity-70">
                      {v.email}
                    </td>
                    <td className="px-5 py-3 font-sans text-[13px] text-[#1A1A2E] opacity-60">
                      {v.tipo_negocio ?? "—"}
                    </td>
                    <td className="px-5 py-3 font-sans text-[13px] text-[#1A1A2E] opacity-50">
                      {new Date(v.criado_em).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
                {convites.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-8 text-center font-sans text-[13px] text-[#1A1A2E] opacity-40"
                    >
                      Ninguém na fila ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function KpiPill({
  label,
  valor,
  cor,
  ativo,
  onClick,
}: {
  label: string;
  valor: number;
  cor?: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 transition-colors ${
        ativo
          ? "border-[#C96B3E] bg-[rgba(201,107,62,0.06)]"
          : "border-[rgba(26,26,46,0.1)] bg-white"
      }`}
    >
      <span className="font-serif text-[18px] leading-none" style={{ color: cor ?? "#1A1A2E" }}>
        {valor}
      </span>
      <span className="font-sans text-[13px] text-[#1A1A2E] opacity-65">{label}</span>
    </button>
  );
}
