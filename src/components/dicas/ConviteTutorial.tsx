import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { Modal } from "@/components/ui/Modal";
import { useDicasVistas } from "@/hooks/useDicasVistas";
import { track } from "@/lib/analytics";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { toastInfo } from "@/lib/toast";
import { TUTORIAL_ROTA, marcarConviteAberto, rotaAceitaConvite } from "@/lib/tutorial";

/**
 * Convite pro tutorial narrado no primeiro acesso (07/10/2026, pedido da Sil):
 * assistir agora ou deixar pra depois. Aparece uma vez por conta, em qualquer
 * tela logada fora do onboarding (depois do onboarding a usuária cai na
 * Calculadora, não no Painel). Responder, fechar ou Esc marcam "tutorial" em
 * `profiles.dicas_vistas`; o tour de 3 balões do Painel espera essa resposta.
 */
export function ConviteTutorial({ pathname }: { pathname: string }) {
  const { mostrar, marcar } = useDicasVistas();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const pendente = mostrar("tutorial");

  useEffect(() => {
    if (aberto || !pendente || !rotaAceitaConvite(pathname)) return;
    // Deixa a tela de destino assentar antes do modal, pra ele não piscar por
    // cima do carregamento.
    const t = window.setTimeout(() => {
      marcarConviteAberto();
      setAberto(true);
      void track("tutorial_convite_exibido", { tela: pathname });
    }, 600);
    return () => window.clearTimeout(t);
  }, [aberto, pendente, pathname]);

  function responder(como: "assistir" | "depois") {
    setAberto(false);
    marcar("tutorial");
    void track(como === "assistir" ? "tutorial_convite_aceito" : "tutorial_convite_adiado");
    if (como === "assistir") {
      void navigate({ to: TUTORIAL_ROTA });
    } else {
      toastInfo("O tutorial fica no menu, em Tutorial. Dá pra assistir quando quiser.");
    }
  }

  return (
    <Modal
      open={aberto}
      onOpenChange={(abrir) => {
        if (!abrir) responder("depois");
      }}
      title="Quer ver a Pólia One por dentro?"
      description="Um tutorial narrado de 5 minutos passa por cada tela, do Planejamento ao Calendário. Dá pra assistir agora ou depois: ele fica no menu, em Tutorial."
      footer={
        <>
          <button type="button" onClick={() => responder("depois")} className={BTN_ACAO_CONTORNO}>
            Ver depois
          </button>
          <button type="button" onClick={() => responder("assistir")} className={BTN_ACAO}>
            Assistir agora
            <span aria-hidden="true">→</span>
          </button>
        </>
      }
    />
  );
}
