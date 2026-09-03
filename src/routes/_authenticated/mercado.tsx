import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import {
  CamposDoc,
  FerramentaVazia,
  useCamposPlanejamento,
} from "@/components/planejamento/CamposDoc";
import { CAMPOS_FERRAMENTA } from "@/lib/planejamento";

export const Route = createFileRoute("/_authenticated/mercado")({
  head: () => ({
    meta: [
      { title: "Mapa de Mercado · Pólia" },
      { name: "description", content: "Quem é a sua cliente, o mercado e o seu lugar nele." },
    ],
  }),
  component: MercadoPage,
});

function MercadoPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;

  const perfilQuery = useQuery({
    queryKey: ["mercado-perfil", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, streak")
        .eq("id", userId!)
        .maybeSingle();
      return data as { full_name: string | null; streak: number | null } | null;
    },
  });
  const camposQuery = useCamposPlanejamento(userId);

  const profile = perfilQuery.data;
  const initial = (profile?.full_name?.charAt(0) || "P").toUpperCase();
  const streak = profile?.streak ?? 0;
  const mapa = camposQuery.data ?? new Map<string, string>();
  const campos = CAMPOS_FERRAMENTA["/mercado"];
  const temAlgo = campos.some((c) => mapa.has(c));

  return (
    <PaginaLogada
      eyebrow="Mapa de Mercado"
      titulo="Quem a marca serve."
      subtitulo="Sua cliente, o mercado e o seu lugar nele, pra consultar quando criar conteúdo, produto ou campanha."
    >
      <div>
        {camposQuery.isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface)]"
              />
            ))}
          </div>
        ) : temAlgo ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6 md:p-8">
            <CamposDoc mapa={mapa} campos={campos} />
          </div>
        ) : (
          <FerramentaVazia
            moduloN={2}
            texto="Seu mapa de mercado é construído no Módulo 2 do Planejamento: quem é a sua cliente, dores, sonhos e concorrência. Comece por lá."
          />
        )}
      </div>
    </PaginaLogada>
  );
}
