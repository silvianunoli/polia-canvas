import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_public/contato")({
  head: () => ({
    meta: [
      { title: "Contato · Pólia" },
      { name: "description", content: "Fala com a gente." },
    ],
  }),
  component: Contato,
});

const schema = z.object({
  nome: z.string().trim().min(2, "Coloca seu nome.").max(120),
  email: z.string().trim().email("Email inválido.").max(255),
  assunto: z.string().min(1, "Escolhe o assunto."),
  mensagem: z.string().trim().min(10, "Conta um pouco mais.").max(2000),
});

function Contato() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ nome, email, assunto, mensagem });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Confere os campos.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("contatos").insert({
      nome: parsed.data.nome,
      email: parsed.data.email,
      assunto: parsed.data.assunto,
      mensagem: parsed.data.mensagem,
    });
    if (error) {
      toast.error("Não deu pra enviar agora. Tenta direto em contato@polia.app");
    } else {
      setEnviado(true);
    }
    setLoading(false);
  }

  return (
    <>
      <section className="bg-[#1A1A2E] py-20 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <p className="font-sans font-semibold text-[#E89770] text-[12px] uppercase tracking-[0.18em] mb-4">
            Contato
          </p>
          <h1 className="font-serif text-[#FDF8F5] text-[40px] md:text-[52px] leading-tight">
            Fala com a gente.
          </h1>
        </div>
      </section>

      <section className="bg-[#FDF8F5] py-20">
        <div className="max-w-xl mx-auto px-6">
          {!enviado ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="font-sans font-semibold text-[#1A1A2E] text-[11px] uppercase tracking-wider mb-2 block">
                  Seu nome
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  maxLength={120}
                  className="w-full border border-[#1A1A2E]/15 rounded-xl px-5 py-4 font-sans text-[#1A1A2E] text-[15px] outline-none focus:border-[#C96B3E] transition-colors bg-white"
                />
              </div>
              <div>
                <label className="font-sans font-semibold text-[#1A1A2E] text-[11px] uppercase tracking-wider mb-2 block">
                  Seu email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={255}
                  className="w-full border border-[#1A1A2E]/15 rounded-xl px-5 py-4 font-sans text-[#1A1A2E] text-[15px] outline-none focus:border-[#C96B3E] transition-colors bg-white"
                />
              </div>
              <div>
                <label className="font-sans font-semibold text-[#1A1A2E] text-[11px] uppercase tracking-wider mb-2 block">
                  Assunto
                </label>
                <select
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                  required
                  className="w-full border border-[#1A1A2E]/15 rounded-xl px-5 py-4 font-sans text-[#1A1A2E] text-[15px] outline-none focus:border-[#C96B3E] transition-colors bg-white appearance-none"
                >
                  <option value="" disabled>Escolher assunto</option>
                  <option value="duvida">Dúvida sobre a Pólia</option>
                  <option value="problema">Problema técnico</option>
                  <option value="parceria">Parceria ou imprensa</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="font-sans font-semibold text-[#1A1A2E] text-[11px] uppercase tracking-wider mb-2 block">
                  Mensagem
                </label>
                <textarea
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  required
                  rows={5}
                  maxLength={2000}
                  className="w-full border border-[#1A1A2E]/15 rounded-xl px-5 py-4 font-sans text-[#1A1A2E] text-[15px] outline-none focus:border-[#C96B3E] transition-colors bg-white resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#C96B3E] text-[#FDF8F5] font-sans font-semibold text-[15px] py-4 rounded-xl hover:bg-[#B85A2D] transition-colors disabled:opacity-50"
              >
                {loading ? "Enviando…" : "Enviar mensagem"}
              </button>
            </form>
          ) : (
            <div className="text-center py-16">
              <p className="font-serif text-[#1A1A2E] text-[28px] mb-3">Mensagem recebida.</p>
              <p className="font-sans text-[#1A1A2E] text-[15px] opacity-60 mb-2">
                Respondemos em até 2 dias úteis.
              </p>
              <p className="font-handwritten text-[#C96B3E] text-[20px]">obrigada por escrever.</p>
            </div>
          )}

          <div className="mt-10 text-center">
            <p className="font-sans text-[#1A1A2E]/45 text-[13px] mb-1">Prefere email direto?</p>
            <a href="mailto:contato@polia.app" className="font-sans text-[#C96B3E] text-[14px] hover:underline">
              contato@polia.app
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
