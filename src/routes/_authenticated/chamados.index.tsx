import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { MessagesSquare } from "lucide-react";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { BTN_ACAO } from "@/lib/botoes";
import { toastErro } from "@/lib/toast";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/_authenticated/chamados/")({
  head: () => ({
    meta: [
      { title: "Chamados · Pólia" },
      { name: "description", content: "Suas conversas com o suporte da Pólia." },
    ],
  }),
  component: ChamadosPage,
});

interface Ticket {
  id: string;
  title: string;
  status: "aberto" | "em_andamento" | "resolvido";
  priority: "normal" | "urgente";
  created_at: string;
  updated_at: string;
}

const STATUS_LABEL: Record<Ticket["status"], string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
};

const STATUS_COR: Record<Ticket["status"], string> = {
  aberto: "bg-[var(--highlight)] text-[var(--highlight-ink)]",
  em_andamento: "bg-[var(--secondary-light)] text-[var(--secondary-text)]",
  resolvido: "bg-[var(--line)] text-[var(--ink-soft)]",
};

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function ChamadosPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const [modalAberto, setModalAberto] = useState(false);

  const dadosQuery = useQuery({
    queryKey: ["chamados-hub", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: profile }, { data: tickets }] = await Promise.all([
        supabase.from("profiles").select("full_name, streak").eq("id", userId!).maybeSingle(),
        supabase
          .from("tickets")
          .select("id, title, status, priority, created_at, updated_at")
          .eq("user_id", userId!)
          .order("updated_at", { ascending: false }),
      ]);
      return {
        profile: profile as { full_name: string | null; streak: number | null } | null,
        tickets: (tickets ?? []) as Ticket[],
      };
    },
  });

  const profile = dadosQuery.data?.profile;
  const tickets = dadosQuery.data?.tickets ?? [];
  const initial = (profile?.full_name?.charAt(0) || "P").toUpperCase();
  const streak = profile?.streak ?? 0;

  return (
    <PaginaLogada
      largura="larga"
      eyebrow="Seus chamados"
      titulo="Fala com o suporte."
      subtitulo={
        <>
          Pra dúvida rápida, o formulário de{" "}
          <a href="/ajuda#contato" className="text-[var(--secondary-text)] hover:underline">
            ajuda
          </a>{" "}
          já resolve. Chamado é pra acompanhar algo com ida e volta.
        </>
      }
      acao={
        <button onClick={() => setModalAberto(true)} className={BTN_ACAO}>
          + Abrir chamado
        </button>
      }
    >
      <div>
        {dadosQuery.isLoading ? (
          <p className="py-16 text-center font-fraunces italic text-[15px] text-[var(--muted)]">
            carregando…
          </p>
        ) : tickets.length === 0 ? (
          <Vazio
            icone={MessagesSquare}
            titulo="Nenhum chamado ainda."
            texto="Chamado é pra coisa que precisa de acompanhamento, com ida e volta registrada. Dúvida rápida se resolve na Ajuda."
            acao={
              <button onClick={() => setModalAberto(true)} className={BTN_ACAO}>
                Abrir o primeiro chamado
              </button>
            }
          />
        ) : (
          <div>
            {tickets.map((t) => (
              <Link
                key={t.id}
                to="/chamados/$id"
                params={{ id: t.id }}
                className="mb-3 flex items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-white p-5 no-underline transition-colors hover:border-[var(--secondary)] hover:bg-[var(--secondary-light)]"
              >
                <div className="min-w-0">
                  <p className="truncate font-sans text-[15px] font-semibold text-[var(--ink)]">
                    {t.title}
                  </p>
                  <p className="mt-0.5 font-sans text-[12px] text-[var(--muted)]">
                    aberto em {fmtData(t.created_at)}
                    {t.priority === "urgente" ? " · urgente" : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-3 py-1 font-sans text-[11px] font-medium ${STATUS_COR[t.status]}`}
                >
                  {STATUS_LABEL[t.status]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {modalAberto && userId && (
        <ModalNovoChamado
          userId={userId}
          onClose={() => setModalAberto(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["chamados-hub", userId] });
            setModalAberto(false);
          }}
        />
      )}
    </PaginaLogada>
  );
}

function ModalNovoChamado({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [urgente, setUrgente] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeSalvar = titulo.trim().length > 0 && corpo.trim().length > 0;

  const salvar = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    setErro(null);
    const { error } = await supabase.from("tickets").insert({
      user_id: userId,
      title: titulo.trim(),
      body: corpo.trim(),
      priority: urgente ? "urgente" : "normal",
    });
    setSalvando(false);
    if (error) {
      setErro(error.message || "Não consegui abrir o chamado. Tenta de novo.");
      return;
    }
    track("chamado_aberto", { urgente });
    onSaved();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="polia-v3 fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-5 text-[24px] text-[var(--ink)]">Abrir chamado</h2>

        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Título</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={120}
            autoFocus
            placeholder="ex: não consigo exportar meus clientes"
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">
            O que está acontecendo
          </label>
          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            rows={5}
            maxLength={4000}
            placeholder="conta com o máximo de detalhe que puder"
            className="w-full resize-none rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
          />
        </div>

        <label className="mb-6 flex items-center gap-2 text-[13px] text-[var(--ink-soft)]">
          <input
            type="checkbox"
            checked={urgente}
            onChange={(e) => setUrgente(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--line)]"
          />
          É urgente: travou algo que preciso agora
        </label>

        {erro && <p className="mb-3 text-[13px] text-[var(--danger)]">{erro}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[14px] text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando || !podeSalvar}
            className="rounded-xl bg-[var(--secondary)] px-5 py-2 text-[14px] font-medium text-[var(--secondary-ink)] hover:opacity-90 disabled:opacity-50"
          >
            {salvando ? "Enviando..." : "Abrir chamado"}
          </button>
        </div>
      </div>
    </div>
  );
}
