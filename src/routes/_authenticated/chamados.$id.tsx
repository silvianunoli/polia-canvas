import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { MessageCircle } from "lucide-react";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
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

  const carregar = async () => {
    const [{ data: t }, { data: msgs }] = await Promise.all([
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
    ]);
    setTicket((t as Ticket | null) ?? null);
    setMensagens((msgs as Mensagem[] | null) ?? []);
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
      toastErro("A Pólia não conseguiu enviar sua mensagem. Tenta de novo.");
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
      <PaginaLogada eyebrow="Chamados" titulo="A Pólia não achou esse chamado.">
        <p className="text-[15px] text-[var(--ink-soft)]">
          <Link
            to="/chamados"
            className="inline-flex min-h-11 items-center text-[var(--secondary-text)] hover:underline"
          >
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

        {/* Chamado recém-aberto não tinha resposta nenhuma e o espaço entre o
            corpo e a caixa de texto ficava mudo. Sem botão de propósito: a
            ação é o textarea logo abaixo. */}
        {mensagens.length === 0 ? (
          <div className="mt-6">
            <Vazio
              icone={MessageCircle}
              titulo="Ainda sem resposta por aqui."
              texto="A Pólia responde em até um dia útil. Se lembrar de mais alguma coisa, escreve abaixo que entra no mesmo chamado."
            />
          </div>
        ) : (
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
        )}

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
              type="button"
              onClick={enviarResposta}
              disabled={!resposta.trim() || enviando}
              className={BTN_ACAO}
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
