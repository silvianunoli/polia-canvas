import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { PlayerTutorial } from "@/components/tutorial/PlayerTutorial";

// O tour narrado de 5 minutos, inteiro. Até 28/10/2026 era o próprio
// /como-usar; agora /como-usar lista um tutorial por ferramenta e o tour fica
// aqui pra quem prefere ver tudo de uma vez. A versão pública é /tutorial/tour.
export const Route = createFileRoute("/_authenticated/como-usar/tour")({
  head: () => ({ meta: [{ title: "Tour completo · Tutorial · Pólia One" }] }),
  component: TourCompletoPage,
});

function TourCompletoPage() {
  return (
    <PaginaLogada
      eyebrow="Tutorial"
      titulo="A Pólia One por dentro"
      subtitulo="O tour narrado de 5 minutos por todas as telas. Os capítulos embaixo do vídeo levam direto pra parte que interessa."
      largura="larga"
    >
      <Link
        to="/como-usar"
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-[var(--secondary-text)] no-underline hover:underline"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Todos os tutoriais
      </Link>
      <PlayerTutorial origem="app" />
    </PaginaLogada>
  );
}
