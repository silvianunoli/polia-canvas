import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { toastErro } from "@/lib/toast";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/_authenticated/chamados/$id")({
  head: () => ({ meta: [{ title: "Chamado · Pólia" }] }),
  component: ChamadoDetalhe,
});

interface Ticket {
  id: string;
  title: string;
  body: string;
  status: "aberto" | "em_andamento" | "resolvido";
  created_at: string;
}

interface Mensagem {
  id: string;
  author_role: "user" | "admin";
  body: string;
  created_at: string;
}

function ChamadoDetalhe() {
  const { id } = Route.useParams();
  const { user } = useSupabaseSession();
  const userId = user?.id;

  // undefined = ainda buscando; null = buscou e não achou (id inválido ou não é seu).
  const [ticket, setTicket] = useState<Ticket | null | undefined>(undefined);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [resposta, setResposta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [initial, setInitial] = useState("P");
  const [streak, setStreak] = useState(0);

  const carregar = async () => {
    const [{ data: t }, { data: msgs }, { data: profile }] = await Promise.all([
      supabase
        .from("tickets")
        .select("id, title, body, status, created_at")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("ticket_messages")
        .select("id, author_role, body, created_at")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true }),
      userId
        ? supabase.from("profiles").select("full_name, streak").eq("id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setTicket((t as Ticket | null) ?? null);
    setMensagens((msgs as Mensagem[] | null) ?? []);
    if (profile) {
      setInitial((profile.full_name?.charAt(0) || "P").toUpperCase());
      setStreak(profile.streak ?? 0);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userId]);

  const enviarResposta = async () => {
    if (!resposta.trim() || !userId) return;
    setEnviando(true);
    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: id,
      author_id: userId,
      author_role: "user",
      body: resposta.trim(),
    });
    setEnviando(false);
    if (error) {
      toastErro("Não conseguimos enviar sua mensagem. Tenta de novo.");
      return;
    }
    // Reabre o chamado se já tinha sido marcado como resolvido e a usuária voltou a escrever.
    await supabase
      .from("tickets")
      .update({ status: "aberto" })
      .eq("id", id)
      .eq("status", "resolvido");
    track("chamado_respondido");
    setResposta("");
    await carregar();
  };

  if (ticket === undefined) {
    return (
      <PaginaLogada eyebrow="Chamado" titulo="Carregando…">
        <p className="text-[14px] text-[var(--muted)]">Buscando esse chamado.</p>
      </PaginaLogada>
    );
  }

  if (ticket === null) {
    return (
      <PaginaLogada eyebrow="Chamados" titulo="Não achei esse chamado.">
        <p className="text-[15px] text-[var(--ink-soft)]">
          <Link to="/chamados" className="text-[var(--secondary-text)] hover:underline">
            ← Voltar aos chamados
          </Link>
        </p>
      </PaginaLogada>
    );
  }

  return (
    <PaginaLogada
      eyebrow="Chamado"
      titulo={ticket.title}
      subtitulo={`${ticket.status === "resolvido" ? "Resolvido" : "Em aberto"} · aberto em ${new Date(ticket.created_at).toLocaleDateString("pt-BR")}`}
      acao={
        <Link to="/chamados" className={BTN_ACAO_CONTORNO}>
          ← Seus chamados
        </Link>
      }
    >
      <div>
        <div className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5">
          <p className="whitespace-pre-wrap font-sans text-[14px] text-[var(--ink)]">
            {ticket.body}
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {mensagens.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.author_role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl p-5 ${
                  msg.author_role === "user"
                    ? "bg-[var(--ink)] text-white"
                    : "border border-[var(--line)] bg-white text-[var(--ink)]"
                }`}
              >
                <p className="mb-2 whitespace-pre-wrap font-sans text-[14px] leading-relaxed">
                  {msg.body}
                </p>
                <p
                  className={`font-sans text-[11px] ${
                    msg.author_role === "user" ? "text-white/55" : "text-[var(--muted)]"
                  }`}
                >
                  {msg.author_role === "user" ? "Você" : "Suporte"} ·{" "}
                  {new Date(msg.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5">
          <textarea
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            placeholder="Escreva mais alguma coisa…"
            aria-label="Escreva sua mensagem"
            rows={4}
            className="mb-4 w-full resize-none font-sans text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
          />
          <div className="flex justify-end">
            <button
              onClick={enviarResposta}
              disabled={!resposta.trim() || enviando}
              className="rounded-xl bg-[var(--secondary)] px-6 py-2.5 font-sans text-[14px] font-semibold text-[var(--secondary-ink)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {enviando ? "Enviando…" : "Enviar"}
            </button>
          </div>
          {ticket.status === "resolvido" && (
            <p className="mt-3 font-sans text-[12px] text-[var(--muted)]">
              esse chamado já foi resolvido. Escrever aqui reabre ele.
            </p>
          )}
        </div>
      </div>
    </PaginaLogada>
  );
}
