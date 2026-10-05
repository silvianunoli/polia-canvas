import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { DocumentoFerramenta } from "@/components/planejamento/DocumentoFerramenta";
import { useCamposPlanejamento } from "@/hooks/useCamposPlanejamento";
import { CAMPOS_FERRAMENTA } from "@/lib/planejamento";
import { BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { LinkInterno } from "@/components/ui/LinkInterno";

export const Route = createFileRoute("/_authenticated/mercado")({
  head: () => ({
    meta: [
      { title: "Mapa de Mercado · Pólia One" },
      { name: "description", content: "Quem é a sua cliente, o mercado e o seu lugar nele." },
    ],
  }),
  component: MercadoPage,
});

function MercadoPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;

  const camposQuery = useCamposPlanejamento(userId);

  const mapa = camposQuery.data ?? new Map<string, string>();
  const campos = CAMPOS_FERRAMENTA["/mercado"];
  const temAlgo = campos.some((c) => mapa.has(c));

  return (
    <PaginaLogada
      eyebrow="Mapa de Mercado"
      titulo="Quem a marca serve."
      subtitulo="Sua cliente, o mercado e o seu lugar nele, pra consultar quando criar conteúdo, produto ou campanha."
      acao={
        <LinkInterno href="/planejamento" className={BTN_ACAO_CONTORNO}>
          <ArrowLeft size={15} aria-hidden="true" /> Planejamento
        </LinkInterno>
      }
    >
      <DocumentoFerramenta
        carregando={camposQuery.isLoading}
        temAlgo={temAlgo}
        mapa={mapa}
        campos={campos}
        moduloN={2}
        tituloVazio="Seu mapa de mercado ainda não está escrito."
        textoVazio="Seu mapa de mercado é construído no Módulo 2 do Planejamento: quem é a sua cliente, dores, sonhos e concorrência. Comece por lá."
      />
    </PaginaLogada>
  );
}
