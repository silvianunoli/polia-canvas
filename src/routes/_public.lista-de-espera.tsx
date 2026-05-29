import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_public/lista-de-espera")({
  head: () => ({
    meta: [
      { title: "Lista de espera · Pólia" },
      { name: "description", content: "Seja uma das primeiras. Garanta acesso prioritário ao lançamento da Pólia em maio de 2026." },
      { property: "og:title", content: "Lista de espera · Pólia" },
      { property: "og:description", content: "Entre antes. Preço menor pra sempre." },
    ],
  }),
  component: ListaEspera,
});

const schema = z.object({
  nome: z.string().trim().min(2, "Coloca seu nome.").max(120),
  email: z.string().trim().email("Email inválido.").max(255),
  tipo: z.string().min(1, "Escolhe uma opção."),
});

function ListaEspera() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [tipo, setTipo] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ nome, email, tipo });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Confere os campos.");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("lista_espera")
      .insert({ nome: parsed.data.nome, email: parsed.data.email, tipo_negocio: parsed.data.tipo });

    if (error) {
      if (error.code === "23505") {
        toast.error("Esse email já está na lista. Você está dentro.");
        setEnviado(true);
      } else {
        toast.error("Não deu pra entrar agora. Tenta de novo em alguns minutos.");
      }
    } else {
      setEnviado(true);
    }
    setLoading(false);
  }

  return (
    <section className="relative bg-[#1A1A2E] py-24 md:py-32 overflow-hidden min-h-[80vh] flex items-center">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#C96B3E]/20 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#C9407A]/15 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-xl mx-auto px-6 w-full">
        <p className="font-sans font-semibold text-[#E89770] text-[12px] uppercase tracking-[0.18em] mb-4 text-center">
          Lista de espera
        </p>
        <h1 className="font-serif text-[#FDF8F5] text-[40px] md:text-[52px] leading-tight text-center mb-6">
          Seja uma das primeiras.
        </h1>
        <p className="font-sans text-[#FDF8F5]/70 text-[16px] leading-relaxed text-center mb-10">
          A Pólia abre pra um grupo pequeno em maio de 2026. Quem estiver na lista entra primeiro — e com o menor preço possível, pra sempre.
        </p>

        {!enviado ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Seu nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              maxLength={120}
              className="w-full bg-white/8 border border-white/12 rounded-xl px-5 py-4 font-sans text-[#FDF8F5] text-[15px] placeholder-white/30 outline-none focus:border-[#C96B3E] transition-colors"
            />
            <input
              type="email"
              placeholder="Seu melhor email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={255}
              className="w-full bg-white/8 border border-white/12 rounded-xl px-5 py-4 font-sans text-[#FDF8F5] text-[15px] placeholder-white/30 outline-none focus:border-[#C96B3E] transition-colors"
            />
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              required
              className="w-full bg-white/8 border border-white/12 rounded-xl px-5 py-4 font-sans text-[#FDF8F5] text-[15px] outline-none focus:border-[#C96B3E] transition-colors appearance-none"
            >
              <option value="" disabled className="bg-[#1A1A2E]">O que você faz?</option>
              <option value="artesanato" className="bg-[#1A1A2E]">Artesanato / trabalho manual</option>
              <option value="alimentacao" className="bg-[#1A1A2E]">Alimentação artesanal</option>
              <option value="moda" className="bg-[#1A1A2E]">Moda / costura / têxtil</option>
              <option value="digital" className="bg-[#1A1A2E]">Produto ou serviço digital</option>
              <option value="outro" className="bg-[#1A1A2E]">Outro</option>
            </select>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#C96B3E] text-[#FDF8F5] font-sans font-semibold text-[15px] py-4 rounded-xl hover:bg-[#B85A2D] transition-colors disabled:opacity-50"
            >
              {loading ? "Entrando…" : "Entrar na lista"}
            </button>
          </form>
        ) : (
          <div className="text-center py-10">
            <p className="font-serif text-[#FDF8F5] text-[32px] mb-4">Você está na lista.</p>
            <p className="font-sans text-[#FDF8F5]/70 text-[16px] mb-3">
              Vamos te avisar por email quando a Pólia abrir. Pode fechar essa aba.
            </p>
            <p className="font-handwritten text-[#E89770] text-[22px]">até breve.</p>
          </div>
        )}

        <p className="font-sans text-[#FDF8F5]/40 text-[12px] mt-6 text-center">
          Sem spam. Sem compartilhamento. Só um aviso quando chegar a hora.
        </p>
      </div>
    </section>
  );
}
