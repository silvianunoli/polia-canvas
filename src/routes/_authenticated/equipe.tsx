import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import { toastErro } from "@/lib/toast";
import { Users, Plus, Trash2, Crown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({
    meta: [
      { title: "Minha equipe · Pólia" },
      { name: "description", content: "Quem caminha com você no negócio." },
    ],
  }),
  component: EquipePage,
});

interface Membro {
  id: string;
  nome: string;
  email: string | null;
  papel: string;
  status: string;
  created_at: string;
}

const DEMO = [
  { nome: "Marina Costa", email: "marina@exemplo.com", papel: "membro" },
  { nome: "Júlia Reis", email: "julia@exemplo.com", papel: "lider" },
  { nome: "Pedro Alves", email: "pedro@exemplo.com", papel: "membro" },
];

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

function EquipePage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();

  const membrosQuery = useQuery({
    queryKey: ["equipe", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("equipe_membros")
        .select("id, nome, email, papel, status, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: true });
      return (data ?? []) as Membro[];
    },
  });

  const membros = useMemo(() => membrosQuery.data ?? [], [membrosQuery.data]);
  const ativos = membros.filter((m) => m.status === "ativo").length;
  const inativos = membros.length - ativos;

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState("membro");

  const invalidar = () => qc.invalidateQueries({ queryKey: ["equipe", userId] });

  // Sem checar { error } o mutationFn nunca "falha" — a mutation reporta sucesso, o form
  // limpa e a lista invalida como se tivesse gravado. Lança no erro pra cair no onErro.
  const onErro = (msg: string) => () => toastErro(msg);

  const adicionar = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) return;
      const { error } = await supabase.from("equipe_membros").insert({
        user_id: userId!,
        nome: nome.trim(),
        email: email.trim() || null,
        papel,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNome("");
      setEmail("");
      setPapel("membro");
      setAberto(false);
      invalidar();
    },
    onError: onErro("Não consegui adicionar a pessoa. Tenta de novo."),
  });

  const criarDemo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("equipe_membros")
        .insert(DEMO.map((d) => ({ ...d, user_id: userId! })));
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: onErro("Não consegui criar os exemplos. Tenta de novo."),
  });

  const alternarStatus = useMutation({
    mutationFn: async (m: Membro) => {
      const { error } = await supabase
        .from("equipe_membros")
        .update({ status: m.status === "ativo" ? "inativo" : "ativo" })
        .eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: onErro("Não consegui mudar o status. Tenta de novo."),
  });

  const alternarPapel = useMutation({
    mutationFn: async (m: Membro) => {
      const { error } = await supabase
        .from("equipe_membros")
        .update({ papel: m.papel === "lider" ? "membro" : "lider" })
        .eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: onErro("Não consegui mudar o papel. Tenta de novo."),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipe_membros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: onErro("Não consegui remover a pessoa. Tenta de novo."),
  });

  const filtrados = useMemo(() => {
    return membros.filter((m) => {
      if (filtroStatus && m.status !== filtroStatus) return false;
      if (busca && !m.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [membros, filtroStatus, busca]);

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <PainelNav navActive="/equipe" />

      <main className="mx-auto max-w-[900px] px-6 py-10 sm:px-8 sm:py-12">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 font-serif text-[36px] leading-tight text-[#1A1A2E] sm:text-[40px]">
              Minha equipe
            </h1>
            <p className="caveat-decorativo text-[#C96B3E]">quem caminha com você no negócio.</p>
          </div>
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-polia-terracota px-4 font-sans text-[14px] font-semibold text-polia-creme transition-colors hover:bg-[#B85A2D]"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Adicionar</span>
          </button>
        </div>

        {membros.length > 0 && (
          <p className="mb-5 font-sans text-[14px] text-[#1A1A2E] opacity-50">
            {ativos} {ativos === 1 ? "ativo" : "ativos"} · {inativos}{" "}
            {inativos === 1 ? "inativo" : "inativos"}
          </p>
        )}

        {/* Compositor */}
        {aberto && (
          <section className="mb-6 rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={80}
                placeholder="Nome"
                className="h-[46px] rounded-xl border border-[rgba(26,26,46,0.12)] px-4 font-sans text-[15px] text-[#1A1A2E] placeholder:text-[#1A1A2E] placeholder:opacity-30 focus:border-[#C96B3E] focus:outline-none"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={120}
                placeholder="E-mail (opcional)"
                className="h-[46px] rounded-xl border border-[rgba(26,26,46,0.12)] px-4 font-sans text-[15px] text-[#1A1A2E] placeholder:text-[#1A1A2E] placeholder:opacity-30 focus:border-[#C96B3E] focus:outline-none"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {[
                  { v: "membro", label: "Membro" },
                  { v: "lider", label: "Líder" },
                ].map((p) => (
                  <button
                    key={p.v}
                    type="button"
                    onClick={() => setPapel(p.v)}
                    className={
                      papel === p.v
                        ? "rounded-full bg-polia-terracota px-4 py-1.5 font-sans text-[13px] font-semibold text-polia-creme"
                        : "rounded-full border border-[rgba(26,26,46,0.15)] px-4 py-1.5 font-sans text-[13px] text-[#1A1A2E] opacity-70 hover:opacity-100"
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="rounded-xl border border-[rgba(26,26,46,0.12)] px-4 py-2 font-sans text-[13px] text-[#1A1A2E] hover:bg-[rgba(26,26,46,0.04)]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => adicionar.mutate()}
                  disabled={!nome.trim() || adicionar.isPending}
                  className="rounded-xl bg-polia-terracota px-4 py-2 font-sans text-[13px] font-semibold text-polia-creme hover:bg-[#B85A2D] disabled:opacity-40"
                >
                  Adicionar membro
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Lista / vazio */}
        {membrosQuery.isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-white/60" />
        ) : membros.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[rgba(26,26,46,0.12)] bg-white/50 px-6 py-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(201,107,62,0.1)]">
              <Users size={26} className="text-polia-terracota" />
            </div>
            <p className="mb-1.5 font-serif text-[20px] text-[#1A1A2E]">
              Você ainda está sozinha aqui
            </p>
            <p className="mx-auto mb-4 max-w-[400px] font-sans text-[14px] leading-relaxed text-[#1A1A2E] opacity-55">
              Adicione quem te ajuda no negócio: sócia, freelancer, assistente. Depois dá pra
              delegar cards do Planner pra cada pessoa.
            </p>
            <button
              type="button"
              onClick={() => criarDemo.mutate()}
              disabled={criarDemo.isPending}
              className="font-sans text-[13px] font-semibold text-[#C96B3E] hover:underline disabled:opacity-50"
            >
              + criar uma equipe de exemplo
            </button>
          </div>
        ) : (
          <>
            {/* Filtros */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="rounded-xl border border-[rgba(26,26,46,0.12)] bg-white px-4 py-2 font-sans text-[14px] text-[#1A1A2E] focus:border-[#C96B3E] focus:outline-none"
              >
                <option value="">Todos</option>
                <option value="ativo">Ativos</option>
                <option value="inativo">Inativos</option>
              </select>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome"
                className="h-10 flex-1 rounded-xl border border-[rgba(26,26,46,0.12)] bg-white px-4 font-sans text-[14px] text-[#1A1A2E] placeholder:text-[#1A1A2E] placeholder:opacity-35 focus:border-[#C96B3E] focus:outline-none"
              />
            </div>

            <div className="overflow-hidden rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white">
              <ul className="divide-y divide-[rgba(26,26,46,0.06)]">
                {filtrados.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-sans text-[13px] font-bold"
                      style={{
                        background: m.status === "ativo" ? "#C96B3E" : "rgba(26,26,46,0.12)",
                        color: m.status === "ativo" ? "#FDF8F5" : "#1A1A2E",
                      }}
                    >
                      {iniciais(m.nome)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-sans text-[15px] font-medium text-[#1A1A2E]">
                          {m.nome}
                        </p>
                        <button
                          type="button"
                          onClick={() => alternarPapel.mutate(m)}
                          title="Alternar papel"
                          className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-sans text-[11px] font-medium ${
                            m.papel === "lider"
                              ? "bg-[rgba(201,107,62,0.12)] text-[#C96B3E]"
                              : "bg-[rgba(26,26,46,0.05)] text-[#1A1A2E] opacity-70"
                          }`}
                        >
                          {m.papel === "lider" && <Crown size={11} />}
                          {m.papel === "lider" ? "Líder" : "Membro"}
                        </button>
                      </div>
                      {m.email && (
                        <p className="truncate font-sans text-[12.5px] text-[#1A1A2E] opacity-45">
                          {m.email}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => alternarStatus.mutate(m)}
                      title="Ativar/desativar"
                      className={`rounded-full px-2.5 py-1 font-sans text-[11px] font-medium ${
                        m.status === "ativo"
                          ? "bg-[rgba(45,106,79,0.1)] text-[#2D6A4F]"
                          : "bg-[rgba(26,26,46,0.06)] text-[#1A1A2E] opacity-50"
                      }`}
                    >
                      {m.status === "ativo" ? "Ativo" : "Inativo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Remover ${m.nome} da equipe?`)) remover.mutate(m.id);
                      }}
                      aria-label={`Remover ${m.nome}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[#1A1A2E] opacity-25 transition-all hover:bg-[rgba(201,64,122,0.1)] hover:text-[#C9407A] hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
                {filtrados.length === 0 && (
                  <li className="px-5 py-8 text-center font-sans text-[13px] text-[#1A1A2E] opacity-40">
                    Ninguém encontrado.
                  </li>
                )}
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
