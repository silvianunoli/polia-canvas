import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import { conversarComGuia } from "@/lib/coach.functions";
import { Send, Eraser } from "lucide-react";

export const Route = createFileRoute("/_authenticated/guia")({
  head: () => ({
    meta: [
      { title: "Sua guia · Pólia" },
      { name: "description", content: "Uma companheira pra pensar o seu negócio junto com você." },
    ],
  }),
  component: GuiaPage,
});

interface Mensagem {
  id: string;
  papel: string;
  conteudo: string;
  created_at: string;
}

function GuiaAvatar({ size = 36 }: { size?: number }) {
  const [erro, setErro] = useState(false);
  if (erro) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full bg-[rgba(201,107,62,0.15)]"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <span style={{ fontSize: size * 0.55, lineHeight: 1 }}>🦊</span>
      </div>
    );
  }
  return (
    <img
      src="/fox-orientando.png"
      alt=""
      aria-hidden="true"
      onError={() => setErro(true)}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}

function GuiaPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const conversar = useServerFn(conversarComGuia);

  const msgsQuery = useQuery({
    queryKey: ["coach-msgs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("coach_mensagens")
        .select("id, papel, conteudo, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: true });
      return (data ?? []) as Mensagem[];
    },
  });

  const mensagens = msgsQuery.data ?? [];
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pendenteUser, setPendenteUser] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens.length, enviando]);

  const enviar = async () => {
    const texto = input.trim();
    if (!texto || enviando || !userId) return;
    setInput("");
    setErro(null);
    setPendenteUser(texto);
    setEnviando(true);

    try {
      await supabase
        .from("coach_mensagens")
        .insert({ user_id: userId, papel: "user", conteudo: texto });

      const historico = mensagens.slice(-30).map((m) => ({
        papel: m.papel as "user" | "guia",
        conteudo: m.conteudo,
      }));

      const r = await conversar({ data: { mensagem: texto, historico } });

      if (r.resposta) {
        await supabase
          .from("coach_mensagens")
          .insert({ user_id: userId, papel: "guia", conteudo: r.resposta });
      } else {
        setErro(r.error ?? "Não consegui responder agora.");
      }
    } catch (e) {
      console.error(e);
      setErro("Algo deu errado ao falar com a guia.");
    } finally {
      await qc.invalidateQueries({ queryKey: ["coach-msgs", userId] });
      setPendenteUser(null);
      setEnviando(false);
    }
  };

  const limpar = async () => {
    if (!userId) return;
    if (!window.confirm("Apagar toda a conversa com a guia?")) return;
    await supabase.from("coach_mensagens").delete().eq("user_id", userId);
    qc.invalidateQueries({ queryKey: ["coach-msgs", userId] });
    setErro(null);
  };

  const vazio = mensagens.length === 0 && !pendenteUser && !enviando;

  return (
    <div className="flex h-[100dvh] flex-col bg-[#FDF8F5]">
      <PainelNav navActive="/guia" />

      <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-4 pt-5 sm:px-6">
        {/* Cabeçalho compacto */}
        <div className="mb-4 flex items-center gap-3 border-b border-[rgba(26,26,46,0.08)] pb-4">
          <GuiaAvatar size={44} />
          <div className="flex-1">
            <h1 className="font-serif text-[22px] leading-tight text-[#1A1A2E]">Sua guia</h1>
            <p className="caveat-decorativo text-[14px] text-[#C96B3E]">
              a gente pensa o seu negócio junto.
            </p>
          </div>
          {mensagens.length > 0 && (
            <button
              type="button"
              onClick={limpar}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-sans text-[12px] text-[#1A1A2E] opacity-40 transition-opacity hover:bg-[rgba(26,26,46,0.05)] hover:opacity-70"
            >
              <Eraser size={14} /> <span className="hidden sm:inline">limpar</span>
            </button>
          )}
        </div>

        {/* Mensagens */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
          {vazio && (
            <Bolha papel="guia">
              oi, eu sou a sua guia aqui na Pólia. me conta o que tá na sua cabeça hoje sobre o
              negócio — uma dúvida, uma decisão, um perrengue. a gente pensa junto.
            </Bolha>
          )}

          {mensagens.map((m) => (
            <Bolha key={m.id} papel={m.papel === "guia" ? "guia" : "user"}>
              {m.conteudo}
            </Bolha>
          ))}

          {pendenteUser && <Bolha papel="user">{pendenteUser}</Bolha>}
          {enviando && <Pensando />}
          {erro && (
            <div className="ml-12 max-w-[80%] rounded-2xl bg-[rgba(201,64,122,0.08)] px-4 py-2.5 font-sans text-[13.5px] text-[#C9407A]">
              {erro}
            </div>
          )}
          <div ref={fimRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-[rgba(26,26,46,0.08)] py-3">
          <div className="flex items-end gap-2 rounded-2xl border border-[rgba(26,26,46,0.12)] bg-white p-2 focus-within:border-[#C96B3E] focus-within:shadow-[0_0_0_3px_rgba(201,107,62,0.08)]">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar();
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder="escreva pra sua guia…"
              className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 font-sans text-[15px] text-[#1A1A2E] placeholder:text-[#1A1A2E] placeholder:opacity-35 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void enviar()}
              disabled={!input.trim() || enviando}
              aria-label="Enviar mensagem"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-polia-terracota text-polia-creme transition-colors hover:bg-[#B85A2D] disabled:opacity-40"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="mt-1.5 text-center font-sans text-[11px] text-[#1A1A2E] opacity-30">
            a guia pode se enganar. confie no seu olhar sobre o seu negócio.
          </p>
        </div>
      </main>
    </div>
  );
}

function Bolha({ papel, children }: { papel: "user" | "guia"; children: React.ReactNode }) {
  if (papel === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-polia-terracota px-4 py-2.5 font-sans text-[15px] leading-relaxed text-polia-creme">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <GuiaAvatar size={36} />
      <div className="max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-tl-md bg-white px-4 py-2.5 font-sans text-[15px] leading-relaxed text-[#1A1A2E] shadow-[0_1px_2px_rgba(26,26,46,0.04)]">
        {children}
      </div>
    </div>
  );
}

function Pensando() {
  return (
    <div className="flex items-center gap-3">
      <GuiaAvatar size={36} />
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(26,26,46,0.04)]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-[#C96B3E]"
            style={{
              animation: "polia-pulse-dot 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
