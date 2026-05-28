import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/chamados/$id")({
  component: AdminTicket,
});

function AdminTicket() {
  const { id } = Route.useParams();
  const [ticket, setTicket] = useState<any>(null);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [resposta, setResposta] = useState("");
  const [userNome, setUserNome] = useState("");

  const carregar = async () => {
    const { data: t } = await supabase.from("tickets").select("*").eq("id", id).maybeSingle();
    setTicket(t);
    if (t?.user_id) {
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", t.user_id).maybeSingle();
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
    await supabase.from("tickets").update({ status: "em_andamento" }).eq("id", id).eq("status", "aberto");
    setResposta("");
    carregar();
  };

  const resolverTicket = async () => {
    await supabase.from("tickets").update({ status: "resolvido", resolved_at: new Date().toISOString() }).eq("id", id);
    carregar();
  };

  if (!ticket) return <p className="font-sans text-[#1A1A2E] opacity-50">Carregando…</p>;

  return (
    <div className="max-w-[760px]">
      <Link to="/admin/chamados" className="font-sans text-[#C96B3E] text-[13px] hover:underline mb-3 inline-block">
        ← Chamados
      </Link>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-[#1A1A2E] text-[32px]">{ticket.title}</h1>
          <p className="font-sans text-[#1A1A2E] text-[13px] opacity-40">
            {userNome} · {ticket.module_ref ?? "sem contexto"} · {new Date(ticket.created_at).toLocaleString("pt-BR")}
          </p>
        </div>
        {ticket.status !== "resolvido" && (
          <button
            onClick={resolverTicket}
            className="bg-[#2D6A4F] text-[#FDF8F5] font-sans text-[14px] rounded-xl px-5 py-2 hover:bg-[#1E5038] transition-colors"
          >
            Resolver
          </button>
        )}
      </div>

      <div className="bg-white border border-[rgba(26,26,46,0.06)] rounded-2xl p-5 mb-6">
        <p className="font-sans text-[14px] text-[#1A1A2E] whitespace-pre-wrap">{ticket.body}</p>
      </div>

      <div className="space-y-4 mb-6">
        {mensagens.map((msg) => (
          <div key={msg.id} className={`flex ${msg.author_role === "admin" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl p-5 ${
                msg.author_role === "admin"
                  ? "bg-[#1A1A2E] text-[#FDF8F5]"
                  : "bg-white border border-[rgba(26,26,46,0.06)] text-[#1A1A2E]"
              }`}
            >
              <p className="font-sans text-[14px] leading-relaxed mb-2 whitespace-pre-wrap">{msg.body}</p>
              <p className={`font-sans text-[11px] ${msg.author_role === "admin" ? "opacity-40" : "opacity-30"}`}>
                {msg.author_role === "admin" ? "Você" : userNome} · {new Date(msg.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
        ))}
      </div>

      {ticket.status !== "resolvido" && (
        <div className="bg-white rounded-2xl p-5 border border-[rgba(26,26,46,0.06)]">
          <textarea
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            placeholder="Escreva sua resposta…"
            rows={4}
            className="w-full font-sans text-[#1A1A2E] text-[14px] outline-none resize-none mb-4"
          />
          <div className="flex justify-end">
            <button
              onClick={enviarResposta}
              disabled={!resposta.trim()}
              className="bg-[#C96B3E] text-[#FDF8F5] font-sans font-semibold text-[14px] px-6 py-2.5 rounded-xl hover:bg-[#B85A2D] transition-colors disabled:opacity-50"
            >
              Enviar resposta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
