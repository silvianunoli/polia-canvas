import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { useDicasVistas } from "@/hooks/useDicasVistas";
import { track } from "@/lib/analytics";
import { BTN_ACAO } from "@/lib/botoes";
import { BOAS_VINDAS } from "@/lib/dicas";
import { toastInfo } from "@/lib/toast";

/**
 * Primeiro acesso ao Painel (11/10/2026, ONE-112, aprovado pela Sil): no lugar
 * do convite pro vídeo de 5 minutos, o ciclo da Pólia One em três linhas e um
 * botão só. O vídeo continua no menu, em Tutorial.
 *
 * Só aparece pra quem ainda não viu o tour: conta antiga, que já passou pelo
 * tour de três balões, não recebe as boas-vindas de novo. Fechar, Esc ou
 * qualquer botão marcam "boas-vindas"; aí o balão do tour assume e aponta o
 * Planejamento (TourBoasVindas espera essa marca).
 */
export function BoasVindas() {
  const { mostrar, marcar } = useDicasVistas();
  const pendente = mostrar("boas-vindas") && mostrar("tour");
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!pendente || aberto) return;
    // Deixa o Painel assentar antes do modal, pra ele não piscar por cima do
    // carregamento.
    const t = window.setTimeout(() => {
      setAberto(true);
      void track("boas_vindas_exibido");
    }, 500);
    return () => window.clearTimeout(t);
  }, [pendente, aberto]);

  function responder(como: "comecar" | "tutorial" | "fechar") {
    setAberto(false);
    marcar("boas-vindas");
    void track("boas_vindas_respondido", { como });
    if (como === "tutorial") {
      toastInfo("O tutorial fica no menu, em Tutorial. Dá pra assistir quando quiser.");
    }
  }

  return (
    <Modal
      open={aberto}
      onOpenChange={(abrir) => {
        if (!abrir) responder("fechar");
      }}
      title={BOAS_VINDAS.titulo}
      footer={
        <>
          <button
            type="button"
            onClick={() => responder("tutorial")}
            className="inline-flex min-h-11 items-center px-2 text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
          >
            {BOAS_VINDAS.secundaria}
          </button>
          <button type="button" onClick={() => responder("comecar")} className={BTN_ACAO}>
            {BOAS_VINDAS.acao}
            <span aria-hidden="true">→</span>
          </button>
        </>
      }
    >
      <ol className="space-y-3">
        {BOAS_VINDAS.ciclo.map((linha, i) => (
          <li key={linha} className="flex gap-3 text-[14px] leading-relaxed text-[var(--ink-soft)]">
            <span
              aria-hidden="true"
              className="font-cabinet flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--secondary-light)] text-[14px] text-[var(--ink)]"
            >
              {i + 1}
            </span>
            <span className="pt-0.5">{linha}</span>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
