import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Copy, Sparkles } from "lucide-react";

import { BTN_ACAO } from "@/lib/botoes";
import { useAssistente } from "./AssistenteContext";

const EXEMPLOS = [
  "Como eu preencho o Planejamento?",
  "Meu preço cobre os custos?",
  "Por que sobrou tão pouco esse mês?",
];

/**
 * A conversa do Assistente. `painel` é o balão flutuante (estreito, rola por
 * dentro); `pagina` é a rota /aimer (larga, rola a página).
 */
export function ConversaAssistente({
  variante,
  autoFocus = false,
}: {
  variante: "painel" | "pagina";
  autoFocus?: boolean;
}) {
  const { mensagens, pergunta, setPergunta, enviando, tetoAtingido, enviar, tentarDeNovo } =
    useAssistente();
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const painel = variante === "painel";

  // Mensagem nova empurra a conversa pra baixo: sem isso ela nascia atrás da
  // caixa de texto.
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens, enviando]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  const copiar = async (id: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoId(id);
      setTimeout(() => setCopiadoId(null), 1500);
    } catch {
      // Clipboard indisponível não é crítico: a resposta continua na tela.
    }
  };

  const bolhaMax = painel ? "max-w-[88%]" : "max-w-[min(80%,68ch)]";
  const bolhaPad = painel ? "p-3.5" : "p-5";

  return (
    <div className={painel ? "flex min-h-0 flex-1 flex-col" : "flex flex-col"}>
      <div className={painel ? "min-h-0 flex-1 overflow-y-auto px-4 pb-3" : ""}>
        {/* Aviso de conteúdo gerado por IA: sempre visível, em todos os estados. */}
        <p
          className={`font-sans leading-[1.5] text-[var(--muted)] ${
            painel ? "pt-3 text-[12px]" : "mt-2 max-w-[64ch] text-[14px]"
          }`}
        >
          As respostas são geradas por inteligência artificial. Os números vêm dos dados registrados
          aqui; o texto é escrito pela IA e pode errar. Vale conferir antes de decidir.
        </p>

        {mensagens.length === 0 ? (
          <div
            className={`rounded-2xl border border-[var(--line)] bg-white ${painel ? "mt-3 p-4" : "mt-5 p-5"}`}
          >
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--secondary-light)]">
              <Sparkles size={18} className="text-[var(--secondary-text)]" aria-hidden="true" />
            </span>
            <p
              className={`leading-relaxed text-[var(--ink)] ${painel ? "text-[15px]" : "text-[16px]"}`}
            >
              Pergunte o que quiser sobre como usar a Pólia One, ou sobre o negócio.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {EXEMPLOS.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    setPergunta(ex);
                    textareaRef.current?.focus();
                  }}
                  className="min-h-11 rounded-xl border border-[var(--line)] px-4 py-2 text-left text-[13px] text-[var(--ink-soft)] transition-colors hover:border-[var(--secondary)] hover:bg-[var(--surface)]"
                >
                  {ex}
                </button>
              ))}
            </div>
            <Link
              to="/como-usar"
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
            >
              Prefere ver? O tutorial mostra cada tela em 5 minutos
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <div
            className={`space-y-3 ${painel ? "mt-3" : "mt-5 flex-1 space-y-4"}`}
            role="log"
            aria-live="polite"
            aria-label="Conversa com a Pólia One"
          >
            {mensagens.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.autor === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`${bolhaMax} ${bolhaPad} rounded-2xl ${
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
                        msg.autor === "user" ? "text-white/70" : "text-[var(--muted)]"
                      }`}
                    >
                      {msg.autor === "user" ? "Você" : "Pólia One"} ·{" "}
                      {msg.hora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {msg.autor === "aimer" && !msg.erro && (
                      <button
                        type="button"
                        onClick={() => copiar(msg.id, msg.texto)}
                        aria-label="Copiar resposta"
                        className="relative flex items-center gap-1 text-[11px] text-[var(--muted)] before:absolute before:-inset-3 before:content-[''] hover:text-[var(--ink-soft)]"
                      >
                        <Copy size={11} aria-hidden="true" />
                        {copiadoId === msg.id ? "copiado" : "copiar"}
                      </button>
                    )}
                  </div>
                  {msg.erro && (
                    <button
                      type="button"
                      onClick={tentarDeNovo}
                      className="relative mt-2 text-[13px] font-medium text-[var(--secondary-text)] underline before:absolute before:-inset-3 before:content-['']"
                    >
                      Tentar de novo
                    </button>
                  )}
                  {/* O degrau oferecido vem do plano (avisoTetoAssistente): Grátis
                      vê o Premium, Premium vê o Pro, Pro e beta não veem link. */}
                  {tetoAtingido && msg.autor === "aimer" && msg.upgrade && (
                    <Link
                      to="/upgrade"
                      search={{ rota: "/aimer", tier: msg.upgrade.tier }}
                      className="relative mt-2 inline-block text-[13px] font-medium text-[var(--secondary-text)] no-underline before:absolute before:-inset-3 before:content-[''] hover:underline"
                    >
                      {msg.upgrade.rotulo}
                    </Link>
                  )}
                </div>
              </div>
            ))}
            {enviando && (
              <div className="flex justify-start">
                <div
                  className={`${bolhaMax} ${bolhaPad} rounded-2xl border border-[var(--line)] bg-white`}
                >
                  <p className="font-sans text-[14px] text-[var(--muted)]">
                    A Pólia One está pensando…
                  </p>
                </div>
              </div>
            )}
            <div ref={fimRef} />
          </div>
        )}
      </div>

      <div
        className={
          painel
            ? "border-t border-[var(--line)] bg-white p-3"
            : "sticky bottom-6 mt-8 rounded-2xl border border-[var(--line)] bg-white p-4"
        }
      >
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
          placeholder="Pergunte pra Pólia One…"
          aria-label="Escreva sua pergunta pra Pólia One"
          rows={2}
          disabled={enviando || tetoAtingido}
          className="mb-2 w-full resize-none font-sans text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] disabled:opacity-60"
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
  );
}
