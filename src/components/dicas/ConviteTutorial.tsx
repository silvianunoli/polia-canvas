import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { Modal } from "@/components/ui/Modal";
import { PlayerTutorial } from "@/components/tutorial/PlayerTutorial";
import { useDicasVistas } from "@/hooks/useDicasVistas";
import { track } from "@/lib/analytics";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { toastInfo } from "@/lib/toast";
import { TUTORIAL_ROTA, marcarConviteAberto, rotaAceitaConvite } from "@/lib/tutorial";

/**
 * Convite pro tutorial narrado no primeiro acesso (07/10/2026, pedido da Sil):
 * assistir agora ou pular. Aparece uma vez por conta. Responder, fechar ou Esc
 * marcam "tutorial" em `profiles.dicas_vistas`; o tour de 3 balões do Painel
 * espera essa resposta.
 *
 * Desde 09/10/2026 (pedido da Sil) ele abre também na tela de boas-vindas do
 * onboarding (`naEntrada`), a primeira coisa que ela vê. Ali as outras telas
 * ainda estão fechadas (o guard manda tudo pro onboarding até ele terminar),
 * então "Assistir agora" toca o vídeo na própria tela, num modal largo, em vez
 * de ir pra /como-usar. Fora do onboarding segue como era: abre em qualquer
 * tela logada aceita por rotaAceitaConvite.
 */
export function ConviteTutorial({
  pathname,
  naEntrada = false,
}: {
  pathname: string;
  naEntrada?: boolean;
}) {
  const { mostrar, marcar } = useDicasVistas();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [assistindo, setAssistindo] = useState(false);
  const pendente = mostrar("tutorial");
  const podeAbrir = naEntrada || rotaAceitaConvite(pathname);

  useEffect(() => {
    if (aberto || !pendente || !podeAbrir) return;
    // Deixa a tela de destino assentar antes do modal, pra ele não piscar por
    // cima do carregamento.
    const t = window.setTimeout(() => {
      marcarConviteAberto();
      setAberto(true);
      void track("tutorial_convite_exibido", { tela: pathname });
    }, 600);
    return () => window.clearTimeout(t);
  }, [aberto, pendente, podeAbrir, pathname]);

  function responder(como: "assistir" | "pular") {
    setAberto(false);
    marcar("tutorial");
    void track(como === "assistir" ? "tutorial_convite_aceito" : "tutorial_convite_adiado", {
      tela: pathname,
    });
    if (como === "pular") {
      toastInfo("O tutorial fica no menu, em Tutorial. Dá pra assistir quando quiser.");
    } else if (naEntrada) {
      setAssistindo(true);
    } else {
      void navigate({ to: TUTORIAL_ROTA });
    }
  }

  return (
    <>
      <Modal
        open={aberto}
        onOpenChange={(abrir) => {
          if (!abrir) responder("pular");
        }}
        title="Quer ver a Pólia One por dentro?"
        description="Um tutorial narrado de 5 minutos passa por cada tela, do Planejamento ao Calendário. Dá pra assistir agora ou pular: ele fica no menu, em Tutorial."
        footer={
          <>
            <button type="button" onClick={() => responder("pular")} className={BTN_ACAO_CONTORNO}>
              Pular
            </button>
            <button type="button" onClick={() => responder("assistir")} className={BTN_ACAO}>
              Assistir agora
              <span aria-hidden="true">→</span>
            </button>
          </>
        }
      />
      {naEntrada && (
        <Modal
          open={assistindo}
          onOpenChange={setAssistindo}
          largura="larga"
          title="A Pólia One por dentro"
          footer={
            <button type="button" onClick={() => setAssistindo(false)} className={BTN_ACAO}>
              Fechar e começar
            </button>
          }
        >
          {assistindo && <PlayerTutorial origem="app" />}
        </Modal>
      )}
    </>
  );
}
