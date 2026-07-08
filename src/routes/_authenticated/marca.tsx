import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import { CamposDoc, FerramentaVazia, useCamposPlanejamento } from "@/components/planejamento/CamposDoc";
import { CAMPOS_FERRAMENTA } from "@/lib/planejamento";

export const Route = createFileRoute("/_authenticated/marca")({
  head: () => ({
    meta: [
      { title: "Marca · Pólia" },
      { name: "description", content: "A identidade do negócio, escrita por quem o toca." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .maybeSingle();
    if (profile && profile.onboarding_completed === false) {
      throw redirect({ to: "/painel" });
    }
  },
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
        .select("full_name, business_name, streak")
        .eq("id", userId!)
        .maybeSingle();
      return data as { full_name: string | null; business_name: string | null; streak: number | null } | null;
    },
  });
  const camposQuery = useCamposPlanejamento(userId);

  const profile = perfilQuery.data;
  const initial = (profile?.full_name?.charAt(0) || "P").toUpperCase();
  const streak = profile?.streak ?? 0;
  const mapa = camposQuery.data ?? new Map<string, string>();
  const campos = CAMPOS_FERRAMENTA["/marca"];
  const temAlgo = campos.some((c) => mapa.has(c));

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <PainelNav initial={initial} streak={streak} navActive="/marca" />

      <div className="mx-auto max-w-[720px] px-6 py-12 md:px-10">
        <header className="mb-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
            Marca
          </p>
          <h1 className="font-fraunces mt-1 text-[clamp(28px,5vw,40px)] leading-[1.1] text-[var(--ink)]">
            {profile?.business_name || "Sua marca"}
          </h1>
          <p className="mt-2 text-[1rem] text-[var(--ink-soft)]">
            A identidade do negócio, escrita por quem o toca.
          </p>
        </header>

        {camposQuery.isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface)]" />
            ))}
          </div>
        ) : temAlgo ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6 md:p-8">
            <CamposDoc mapa={mapa} campos={campos} />
          </div>
        ) : (
          <FerramentaVazia
            moduloN={1}
            texto="Sua marca é construída no Módulo 1 do Planejamento: propósito, missão, valores e voz. Comece por lá."
          />
        )}
      </div>
    </div>
  );
}
