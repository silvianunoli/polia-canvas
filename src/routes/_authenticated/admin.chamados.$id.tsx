import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { logAcaoAdmin } from "@/lib/audit-log";

export const Route = createFileRoute("/_authenticated/admin/chamados/$id")({
  head: () => ({
    meta: [{ title: "Chamados · Pólia" }],
  }),
  component: AdminTicket,
});

function AdminTicket() {
  const { id } = Route.useParams();
  const [ticket, setTicket] = useState<Tables<"tickets"> | null>(null);
  const [mensagens, setMensagens] = useState<Tables<"ticket_messages">[]>([]);
  const [resposta, setResposta] = useState("");
  const [userNome, setUserNome] = useState("");

  const carregar = async () => {
    const { data: t } = await supabase.from("tickets").select("*").eq("id", id).maybeSingle();
    setTicket(t);
    if (t?.user_id) {
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", t.user_id)
        .maybeSingle();
      setUserNome(p?.full_name ?? "—");
    }
    const { data: msgs } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });
    setMensagens(msgs ?? []);
  };

  useEffect(() => {
    carregar();
  }, [id]);

  const enviarResposta = async () => {
    if (!resposta.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("ticket_messages").insert({
      ticket_id: id,
      author_id: u.user.id,
      author_role: "admin",
      body: resposta,
    });
    await supabase
      .from("tickets")
      .update({ status: "em_andamento" })
      .eq("id", id)
      .eq("status", "aberto");
    setResposta("");
    carregar();
  };

  const resolverTicket = async () => {
    await supabase
      .from("tickets")
      .update({ status: "resolvido", resolved_at: new Date().toISOString() })
      .eq("id", id);
    await logAcaoAdmin("resolver_chamado", id, { titulo: ticket?.title });
    carregar();
  };

  if (!ticket) return <p className="font-sans text-[var(--muted)]">Carregando…</p>;

  return (
    <div className="max-w-[760px]">
      <Link
        to="/admin/chamados"
        className="mb-3 inline-block font-sans text-[13px] text-[var(--secondary-text)] hover:underline"
      >
        ← Chamados
      </Link>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-cabinet text-[32px] text-[var(--ink)]">{ticket.title}</h1>
          <p className="font-sans text-[13px] text-[var(--muted)]">
            {userNome} · {ticket.module_ref ?? "sem contexto"} ·{" "}
            {new Date(ticket.created_at).toLocaleString("pt-BR")}
          </p>
        </div>
        {ticket.status !== "resolvido" && (
          <button
            onClick={resolverTicket}
            className="rounded-xl bg-[var(--secondary)] px-5 py-2 font-sans text-[14px] font-semibold text-[var(--secondary-ink)] transition-opacity hover:opacity-90"
          >
            Resolver
          </button>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-[var(--line)] bg-white p-5">
        <p className="whitespace-pre-wrap font-sans text-[14px] text-[var(--ink)]">
          {ticket.body}
        </p>
      </div>

      <div className="mb-6 space-y-4">
        {mensagens.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.author_role === "admin" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl p-5 ${
                msg.author_role === "admin"
                  ? "bg-[var(--ink)] text-white"
                  : "border border-[var(--line)] bg-white text-[var(--ink)]"
              }`}
            >
              <p className="mb-2 whitespace-pre-wrap font-sans text-[14px] leading-relaxed">
                {msg.body}
              </p>
              <p
                className="font-sans text-[11px]"
                style={{
                  color:
                    msg.author_role === "admin"
                      ? "rgba(255,255,255,0.55)"
                      : "var(--muted)",
                }}
              >
                {msg.author_role === "admin" ? "Você" : userNome} ·{" "}
                {new Date(msg.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
        ))}
      </div>

      {ticket.status !== "resolvido" && (
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
          <textarea
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            placeholder="Escreva sua resposta…"
            rows={4}
            className="mb-4 w-full resize-none font-sans text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
          />
          <div className="flex justify-end">
            <button
              onClick={enviarResposta}
              disabled={!resposta.trim()}
              className="rounded-xl bg-[var(--secondary)] px-6 py-2.5 font-sans text-[14px] font-semibold text-[var(--secondary-ink)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Enviar resposta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
