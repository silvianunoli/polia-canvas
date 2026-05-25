import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolvePostLoginPath } from "@/hooks/useSupabaseSession";
import { CosmicBackground } from "@/components/cosmic/CosmicBackground";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pólia" },
      {
        name: "description",
        content: "Pólia, plataforma guiada para mulheres empreendedoras brasileiras.",
      },
    ],
  }),
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session?.user) {
        const target = await resolvePostLoginPath(data.session.user.id);
        navigate({ to: target, replace: true });
      } else {
        navigate({ to: "/auth/login", replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <CosmicBackground />
      <div className="relative z-10 flex min-h-screen items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#C96B3E]" />
      </div>
    </div>
  );
}
