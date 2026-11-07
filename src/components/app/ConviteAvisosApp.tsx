import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

import { BTN_ACAO } from "@/lib/botoes";
import { adiarConvitePush, ativarPush, precisaConvitePush } from "@/lib/push";
import { toastErro, toastSucesso } from "@/lib/toast";

/**
 * Convite pros avisos no celular, na aba Hoje do app (ONE-188, 07/11/2026).
 * Explica pra que servem antes do pedido do Android, que só abre no toque em
 * "Quero receber os avisos". "Agora não" esconde por 7 dias. Fora do app, ou
 * com a permissão já decidida, não aparece.
 */
export function ConviteAvisosApp() {
  const [visivel, setVisivel] = useState(false);
  const [ligando, setLigando] = useState(false);

  useEffect(() => {
    let ativo = true;
    void precisaConvitePush()
      .then((precisa) => {
        if (ativo) setVisivel(precisa);
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, []);

  async function ligar() {
    setLigando(true);
    try {
      const estado = await ativarPush();
      if (estado === "ativo") {
        toastSucesso("Avisos ligados. Em Configurações dá pra escolher quais.");
      } else {
        toastSucesso("Os avisos ficaram desligados. Dá pra ligar depois em Configurações.");
      }
      setVisivel(false);
    } catch {
      toastErro("A Pólia One não conseguiu ligar os avisos agora. Tenta de novo em instantes.");
    } finally {
      setLigando(false);
    }
  }

  function agoraNao() {
    adiarConvitePush();
    setVisivel(false);
  }

  if (!visivel) return null;

  return (
    <section
      aria-labelledby="convite-avisos-titulo"
      className="rounded-2xl border border-[var(--line)] bg-white p-4"
    >
      <div className="flex items-start gap-3">
        <Bell size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--ink)]" />
        <div>
          <h2
            id="convite-avisos-titulo"
            className="font-accent text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]"
          >
            Avisos no celular
          </h2>
          <p className="mt-1 text-[15px] leading-relaxed text-[var(--ink-soft)]">
            A Pólia One avisa das entregas de amanhã, lembra de registrar as vendas do dia e manda o
            resumo da semana.
          </p>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Depois do toque, o Android pergunta se pode mandar notificações.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className={BTN_ACAO} onClick={ligar} disabled={ligando}>
          {ligando ? "Ligando..." : "Quero receber os avisos"}
        </button>
        <button
          type="button"
          onClick={agoraNao}
          disabled={ligando}
          className="inline-flex min-h-11 items-center px-3 text-[14px] font-medium text-[var(--secondary-text)] hover:underline disabled:opacity-60"
        >
          Agora não
        </button>
      </div>
    </section>
  );
}
