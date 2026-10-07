import { useEffect, useRef, useState } from "react";

import { track } from "@/lib/analytics";
import { BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { htmlEmbutido, lerMensagemTutorial } from "@/lib/tutorial";

/**
 * O tutorial narrado num iframe, usado na tela do app (/como-usar) e na página
 * pública (/tutorial). O HTML do vídeo entra no código como texto (import
 * "?raw" num chunk separado, só baixado quando a tela abre) e vai pro iframe
 * por srcDoc. Ele NÃO mora em public/: com run_worker_first, um .html solto lá
 * voltava 404 em produção (07/10/2026). O iframe avisa a própria altura por
 * postMessage, pra a página rolar inteira em vez de ter rolagem dentro do vídeo.
 */
export function PlayerTutorial({ origem }: { origem: "app" | "site" }) {
  const [html, setHtml] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [altura, setAltura] = useState<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let vivo = true;
    setErro(false);
    import("@/assets/tutorial/tutorial.html?raw")
      .then((m) => {
        if (vivo) setHtml(htmlEmbutido(m.default));
      })
      .catch(() => {
        if (vivo) setErro(true);
      });
    return () => {
      vivo = false;
    };
  }, [tentativa]);

  useEffect(() => {
    function aoReceber(e: MessageEvent) {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      const msg = lerMensagemTutorial(e.data);
      if (!msg) return;
      if (msg.tipo === "altura") setAltura(msg.altura);
      else
        void track(msg.evento === "play" ? "tutorial_play" : "tutorial_assistido_ate_o_fim", {
          origem,
        });
    }
    window.addEventListener("message", aoReceber);
    return () => window.removeEventListener("message", aoReceber);
  }, [origem]);

  if (erro) {
    return (
      <div className="rounded-xl border border-[var(--line)] bg-white p-6">
        <p className="text-[15px] text-[var(--ink)]">
          A Pólia One não conseguiu carregar o tutorial agora.
        </p>
        <p className="mt-1 text-[14px] text-[var(--muted)]">
          Pode ter sido a conexão. Tenta de novo em alguns segundos.
        </p>
        <button
          type="button"
          onClick={() => setTentativa((n) => n + 1)}
          className={`${BTN_ACAO_CONTORNO} mt-4`}
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  if (!html) {
    return (
      <div
        aria-busy="true"
        aria-label="Carregando o tutorial"
        className="aspect-video w-full animate-pulse rounded-2xl bg-[var(--surface)]"
      />
    );
  }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      title="Tutorial narrado da Pólia One"
      allow="autoplay; fullscreen"
      allowFullScreen
      className="block w-full border-0"
      style={altura ? { height: altura } : { aspectRatio: "16 / 11" }}
    />
  );
}
