import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/comunicacao")({
  head: () => ({
    meta: [{ title: "Comunicação · Pólia" }],
  }),
  component: AdminComunicacao,
});

function AdminComunicacao() {
  const [contatos, setContatos] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("contatos").select("*").order("created_at", { ascending: false }).limit(100);
      setContatos(data ?? []);
    })();
  }, []);

  return (
    <>
      <h1 className="font-serif text-[#1A1A2E] text-[40px] mb-6">Comunicação</h1>

      <div className="mb-10">
        <h2 className="font-serif text-[#1A1A2E] text-[28px] mb-5">Mensagens recebidas</h2>
        <div className="space-y-3">
          {contatos.length === 0 && (
            <p className="font-sans text-[#1A1A2E] text-[13px] opacity-50">Nenhuma mensagem ainda.</p>
          )}
          {contatos.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl p-5 border border-[rgba(26,26,46,0.06)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-sans text-[#1A1A2E] text-[14px] font-medium">
                    {c.nome} · {c.assunto}
                  </p>
                  <p className="font-sans text-[#1A1A2E] text-[13px] opacity-50 mt-1 whitespace-pre-wrap">{c.mensagem}</p>
                </div>
                <a
                  href={`mailto:${c.email}?subject=Re: ${encodeURIComponent(c.assunto)}`}
                  className="font-sans text-[#C96B3E] text-[13px] hover:underline flex-shrink-0 ml-4"
                >
                  Responder →
                </a>
              </div>
              <p className="font-sans text-[#1A1A2E] text-[11px] opacity-30 mt-3">
                {new Date(c.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-7 border border-[rgba(26,26,46,0.06)]">
        <h2 className="font-serif text-[#1A1A2E] text-[28px] mb-2">Broadcast por email</h2>
        <p className="font-sans text-[#1A1A2E] text-[13px] opacity-50 mb-4">
          Em breve. A flag <code className="font-mono text-[12px]">broadcast_ativo</code> precisa estar ligada e o Resend configurado.
        </p>
      </div>
    </>
  );
}
