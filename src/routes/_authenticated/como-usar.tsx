import { createFileRoute } from "@tanstack/react-router";

import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { PlayerTutorial } from "@/components/tutorial/PlayerTutorial";

// O tutorial dentro da área logada, com o menu à vista. A versão pública (sem
// login, pra divulgar) mora em /tutorial (routes/tutorial.tsx).
export const Route = createFileRoute("/_authenticated/como-usar")({
  head: () => ({ meta: [{ title: "Tutorial · Pólia One" }] }),
  component: ComoUsarPage,
});

function ComoUsarPage() {
  return (
    <PaginaLogada
      eyebrow="Ajuda"
      titulo="A Pólia One por dentro"
      subtitulo="Um tour narrado de 5 minutos por todas as telas. Os capítulos embaixo do vídeo levam direto pra parte que interessa."
      largura="larga"
    >
      <PlayerTutorial origem="app" />
    </PaginaLogada>
  );
}
