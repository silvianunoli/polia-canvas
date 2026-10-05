import { createFileRoute } from "@tanstack/react-router";

import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { useAssistente } from "@/components/assistente/AssistenteContext";
import { ConversaAssistente } from "@/components/assistente/ConversaAssistente";
import { BTN_ACAO_CONTORNO } from "@/lib/botoes";

// Desde 05/10/2026 o Assistente vive no balão do canto inferior direito (saiu
// da sidebar). A rota fica pra links antigos e mostra a mesma conversa do
// balão, que mora no layout (AssistenteProvider).
export const Route = createFileRoute("/_authenticated/aimer")({
  head: () => ({
    meta: [
      { title: "Assistente · Pólia One" },
      {
        name: "description",
        content: "Tira dúvida sobre a Pólia One e sobre o seu negócio.",
      },
    ],
  }),
  component: AimerPage,
});

function AimerPage() {
  const { mensagens, novaConversa } = useAssistente();
  return (
    <PaginaLogada
      largura="larga"
      eyebrow="Assistente"
      titulo="Converse com a Pólia One."
      subtitulo="Dúvida de como usar a Pólia One, ou do negócio. Ela não inventa número."
      acao={
        mensagens.length > 0 ? (
          <button type="button" onClick={novaConversa} className={BTN_ACAO_CONTORNO}>
            Nova conversa
          </button>
        ) : undefined
      }
    >
      <ConversaAssistente variante="pagina" />
    </PaginaLogada>
  );
}
