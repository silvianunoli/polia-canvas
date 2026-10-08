import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { DocumentoFerramenta } from "@/components/planejamento/DocumentoFerramenta";
import { useCamposPlanejamento } from "@/hooks/useCamposPlanejamento";
import { CAMPOS_FERRAMENTA } from "@/lib/planejamento";
import { BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { BlockError } from "@/components/ui/BlockError";

export const Route = createFileRoute("/_authenticated/marca")({
  head: () => ({
    meta: [
      { title: "Marca · Pólia One" },
      { name: "description", content: "A identidade do negócio, escrita por quem o toca." },
    ],
  }),
  component: MarcaPage,
});

function MarcaPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;

  const perfilQuery = useQuery({
    queryKey: ["marca-perfil", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, business_name")
        .eq("id", userId!)
        .maybeSingle();
      return data as {
        full_name: string | null;
        business_name: string | null;
      } | null;
    },
  });
  const camposQuery = useCamposPlanejamento(userId);

  const profile = perfilQuery.data;
  const mapa = camposQuery.data ?? new Map<string, string>();
  const campos = CAMPOS_FERRAMENTA["/marca"];
  const temAlgo = campos.some((c) => mapa.has(c));

  return (
    <PaginaLogada
      eyebrow="Marca"
      titulo={profile?.business_name || "Sua marca"}
      subtitulo="A identidade do negócio, escrita por quem o toca."
      acao={
        <LinkInterno href="/planejamento" className={BTN_ACAO_CONTORNO}>
          <ArrowLeft size={15} aria-hidden="true" /> Planejamento
        </LinkInterno>
      }
    >
      {camposQuery.isError ? (
        <div role="alert">
          <BlockError
            message="A Pólia One não conseguiu ler a sua marca agora. Nada foi perdido, é só a leitura que falhou."
            onRetry={() => void camposQuery.refetch()}
          />
        </div>
      ) : (
        <DocumentoFerramenta
          carregando={camposQuery.isLoading}
          temAlgo={temAlgo}
          mapa={mapa}
          campos={campos}
          moduloN={1}
          tituloVazio="Sua marca ainda não está escrita."
          textoVazio="Sua marca é construída no Módulo 1 do Planejamento: propósito, missão, valores e voz. Comece por lá."
        />
      )}
    </PaginaLogada>
  );
}
