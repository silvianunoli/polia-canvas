import { createFileRoute } from "@tanstack/react-router";

import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { ChamadaTour } from "@/components/tutorial/ChamadaTour";
import { ListaTutoriais } from "@/components/tutorial/ListaTutoriais";

// Tutoriais dentro da área logada (28/10/2026, pedido da Sil: um por
// ferramenta, "não um vídeo só"). Cada linha abre /como-usar/$slug; o tour de
// 5 minutos mora em /como-usar/tour. A versão pública é /tutorial.
export const Route = createFileRoute("/_authenticated/como-usar/")({
  head: () => ({ meta: [{ title: "Tutoriais · Pólia One" }] }),
  component: ComoUsarPage,
});

function ComoUsarPage() {
  return (
    <PaginaLogada
      eyebrow="Ajuda"
      titulo="Tutoriais da Pólia One"
      subtitulo="Um tutorial curto pra cada ferramenta: o clipe narrado da tela e o passo a passo pra seguir junto."
      largura="larga"
    >
      <ListaTutoriais base="/como-usar" />
      <ChamadaTour base="/como-usar" />
    </PaginaLogada>
  );
}
