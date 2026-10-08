import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { MessagesSquare } from "lucide-react";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { BlockError } from "@/components/ui/BlockError";
import { track } from "@/lib/analytics";
import { ordenarPorUltimaAtividade, rotuloStatusChamado } from "@/lib/chamados";

export const Route = createFileRoute("/_authenticated/chamados/")({
  head: () => ({
    meta: [
      { title: "Chamados · Pólia One" },
      { name: "description", content: "Suas conversas com o suporte da Pólia One." },
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

const STATUS_COR: Record<Ticket["status"], string> = {
  aberto: "bg-[var(--accent)] text-[var(--accent-ink)]",
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
      // QA-36: mensagem nova não mexe em tickets.updated_at (a cliente não pode
      // editar o chamado, só reabrir), então a ordem sai da última mensagem.
      const { data, error } = await supabase
        .from("tickets")
        .select("id, title, status, priority, created_at, updated_at, ticket_messages(created_at)")
        .eq("user_id", userId!);
      // Leitura que falha não pode virar "Nenhum chamado ainda".
      if (error) throw error;
      return ordenarPorUltimaAtividade(
        (data ?? []) as unknown as (Ticket & {
          ticket_messages: { created_at: string }[] | null;
        })[],
      );
    },
  });

  const tickets = dadosQuery.data ?? [];

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
          <p className="py-16 text-center font-sans text-[15px] text-[var(--muted)]">Carregando…</p>
        ) : dadosQuery.isError ? (
          <BlockError
            message="A Pólia One não conseguiu abrir os seus chamados agora. Eles continuam guardados, é só a leitura que falhou."
            onRetry={() => void dadosQuery.refetch()}
          />
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
                    {t.ultimaMensagem ? ` · última mensagem em ${fmtData(t.ultimaMensagem)}` : ""}
                    {t.priority === "urgente" ? " · urgente" : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-3 py-1 font-sans text-[11px] font-medium ${STATUS_COR[t.status] ?? STATUS_COR.aberto}`}
                >
                  {rotuloStatusChamado(t.status)}
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
      // Nunca a mensagem crua do banco: vinha em inglês ou técnica.
      console.error("chamados: falha ao abrir", error);
      setErro("A Pólia One não conseguiu abrir o chamado. Tenta de novo.");
      return;
    }
    track("chamado_aberto", { urgente });
    onSaved();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Abrir chamado"
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !podeSalvar}
            className={BTN_ACAO}
          >
            {salvando ? "Enviando..." : "Abrir chamado"}
          </button>
        </>
      }
    >
      <div className="mb-4">
        <Campo label="Título" required>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={120}
            autoFocus
            placeholder="ex: não consigo exportar meus clientes"
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
          />
        </Campo>
      </div>

      <div className="mb-4">
        <Campo label="O que está acontecendo" required>
          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            rows={5}
            maxLength={4000}
            placeholder="conta com o máximo de detalhe que puder"
            className="w-full resize-none rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
          />
        </Campo>
      </div>

      <label className="mb-2 flex items-center gap-2 text-[13px] text-[var(--ink-soft)]">
        <input
          type="checkbox"
          checked={urgente}
          onChange={(e) => setUrgente(e.target.checked)}
          className="h-4 w-4 rounded border-[var(--line)]"
        />
        É urgente: travou algo que preciso agora
      </label>

      {erro && (
        <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
          {erro}
        </p>
      )}
    </Modal>
  );
}
