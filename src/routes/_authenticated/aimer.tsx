import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Copy } from "lucide-react";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { perguntarAimer, MENSAGENS_CANONICAS } from "@/lib/aimer.functions";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/_authenticated/aimer")({
  head: () => ({
    meta: [
      { title: "Aimer · Pólia" },
      {
        name: "description",
        content: "Tira dúvida sobre a Pólia e sobre o seu negócio com a Aimer.",
      },
    ],
  }),
  component: AimerPage,
});

interface Mensagem {
  id: string;
  autor: "user" | "aimer";
  texto: string;
  hora: Date;
  erro?: boolean;
}

const EXEMPLOS = [
  "Como eu preencho o Planejamento?",
  "Meu preço cobre os custos?",
  "Por que sobrou tão pouco esse mês?",
];

function novoId(): string {
  return crypto.randomUUID();
}

function AimerPage() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [pergunta, setPergunta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [tetoAtingido, setTetoAtingido] = useState(false);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const enviar = async (textoForcado?: string) => {
    const texto = (textoForcado ?? pergunta).trim();
    if (!texto || enviando) return;

    const idUsuaria = novoId();
    const historico = mensagens.slice(-10).map((m) => ({ autor: m.autor, texto: m.texto }));

    setMensagens((prev) => [...prev, { id: idUsuaria, autor: "user", texto, hora: new Date() }]);
    setPergunta("");
    setEnviando(true);
    setTetoAtingido(false);

    try {
      const resultado = await perguntarAimer({ data: { pergunta: texto, historico } });
      if (resultado.ok) {
        setMensagens((prev) => [
          ...prev,
          { id: novoId(), autor: "aimer", texto: resultado.texto, hora: new Date() },
        ]);
        track("aimer_pergunta_respondida");
      } else if (resultado.motivo === "teto_atingido") {
        setTetoAtingido(true);
        setMensagens((prev) => [
          ...prev,
          {
            id: novoId(),
            autor: "aimer",
            texto: MENSAGENS_CANONICAS.tetoAtingido,
            hora: new Date(),
          },
        ]);
      } else if (resultado.motivo === "fora_de_escopo") {
        setMensagens((prev) => [
          ...prev,
          {
            id: novoId(),
            autor: "aimer",
            texto: MENSAGENS_CANONICAS.foraDeEscopo,
            hora: new Date(),
          },
        ]);
      } else if (resultado.motivo === "manutencao") {
        setMensagens((prev) => [
          ...prev,
          { id: novoId(), autor: "aimer", texto: MENSAGENS_CANONICAS.manutencao, hora: new Date() },
        ]);
      } else {
        setMensagens((prev) => [
          ...prev,
          {
            id: novoId(),
            autor: "aimer",
            texto: MENSAGENS_CANONICAS.falhaIa,
            hora: new Date(),
            erro: true,
          },
        ]);
      }
    } catch {
      setMensagens((prev) => [
        ...prev,
        {
          id: novoId(),
          autor: "aimer",
          texto: MENSAGENS_CANONICAS.falhaIa,
          hora: new Date(),
          erro: true,
        },
      ]);
    } finally {
      setEnviando(false);
    }
  };

  const tentarDeNovo = (ultimaPerguntaTexto: string) => {
    setMensagens((prev) => prev.filter((m) => !m.erro));
    void enviar(ultimaPerguntaTexto);
  };

  const copiar = async (id: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoId(id);
      setTimeout(() => setCopiadoId(null), 1500);
    } catch {
      // Clipboard indisponível não é crítico — a resposta continua na tela pra selecionar manualmente.
    }
  };

  const novaConversa = () => {
    setMensagens([]);
    setTetoAtingido(false);
  };

  const ultimaPergunta = [...mensagens].reverse().find((m) => m.autor === "user")?.texto ?? "";

  return (
    <PaginaLogada
      largura="larga"
      eyebrow="Aimer"
      titulo="Converse com a Aimer."
      subtitulo="Dúvida de como usar a Pólia, ou do negócio. Ela não inventa número."
      acao={
        mensagens.length > 0 ? (
          <button type="button" onClick={novaConversa} className={BTN_ACAO_CONTORNO}>
            Nova conversa
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col">
        {mensagens.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-[var(--line)] bg-white p-6">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--secondary-light)]">
              <Sparkles size={18} className="text-[var(--secondary-text)]" aria-hidden="true" />
            </span>
            <p className="text-[16px] leading-relaxed text-[var(--ink)]">
              Pergunte o que quiser sobre como usar a Pólia, ou sobre o negócio.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {EXEMPLOS.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setPergunta(ex)}
                  className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-left text-[13px] text-[var(--ink-soft)] hover:border-[var(--secondary)] hover:bg-[var(--surface)]"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-8 flex-1 space-y-4">
            {mensagens.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.autor === "user" ? "justify-end" : "justify-start"}`}
              >
                {/* A caixa da conversa é larga, mas a bolha trava em 68ch: linha
                    de 110 caracteres faz o olho perder onde estava ao voltar. */}
                <div
                  className={`max-w-[min(80%,68ch)] rounded-2xl p-5 ${
                    msg.autor === "user"
                      ? "bg-[var(--ink)] text-white"
                      : msg.erro
                        ? "border border-[var(--danger)] bg-white text-[var(--ink)]"
                        : "border border-[var(--line)] bg-white text-[var(--ink)]"
                  }`}
                >
                  <p className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed">
                    {msg.texto}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p
                      className={`font-sans text-[11px] ${
                        msg.autor === "user" ? "text-white/55" : "text-[var(--muted)]"
                      }`}
                    >
                      {msg.autor === "user" ? "Você" : "Aimer"} ·{" "}
                      {msg.hora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {msg.autor === "aimer" && !msg.erro && (
                      <button
                        type="button"
                        onClick={() => copiar(msg.id, msg.texto)}
                        aria-label="Copiar resposta"
                        className="flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-[var(--ink-soft)]"
                      >
                        <Copy size={11} aria-hidden="true" />
                        {copiadoId === msg.id ? "copiado" : "copiar"}
                      </button>
                    )}
                  </div>
                  {msg.erro && (
                    <button
                      type="button"
                      onClick={() => tentarDeNovo(ultimaPergunta)}
                      className="mt-2 text-[13px] font-medium text-[var(--secondary-text)] underline"
                    >
                      Tentar de novo
                    </button>
                  )}
                  {tetoAtingido &&
                    msg.autor === "aimer" &&
                    msg.texto === MENSAGENS_CANONICAS.tetoAtingido && (
                      <Link
                        to="/upgrade"
                        search={{ rota: "/aimer", tier: "controle" }}
                        className="mt-2 inline-block text-[13px] font-medium text-[var(--secondary-text)] no-underline"
                      >
                        Conhecer o Controle
                      </Link>
                    )}
                </div>
              </div>
            ))}
            {enviando && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl border border-[var(--line)] bg-white p-5">
                  <p className="font-sans text-[14px] text-[var(--muted)]">
                    A Aimer está pensando…
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="sticky bottom-6 mt-6 rounded-2xl border border-[var(--line)] bg-white p-5">
          <textarea
            ref={textareaRef}
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void enviar();
              }
            }}
            placeholder="Pergunte pra Aimer…"
            aria-label="Escreva sua pergunta pra Aimer"
            rows={3}
            disabled={enviando || tetoAtingido}
            className="mb-4 w-full resize-none font-sans text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] disabled:opacity-60"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void enviar()}
              disabled={enviando || !pergunta.trim() || tetoAtingido}
              className={BTN_ACAO}
            >
              {enviando ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </div>
      </div>
    </PaginaLogada>
  );
}
