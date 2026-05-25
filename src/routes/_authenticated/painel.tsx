import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoutModal } from "@/components/cosmic/LogoutModal";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [{ title: "Painel — Pólia" }],
  }),
  component: PainelPage,
});

function PainelPage() {
  const { user } = useSupabaseSession();
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    setLoggingOut(false);
    setShowLogout(false);
    navigate({ to: "/auth/login" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="font-serif text-[24px] text-foreground">Pólia</h1>
          <button
            type="button"
            onClick={() => setShowLogout(true)}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 font-sans text-[14px] text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="font-handwritten text-[28px] text-polia-terracota">
          Oi, {user?.user_metadata?.full_name?.split(" ")[0] ?? "boas-vindas"}.
        </p>
        <h2 className="mt-2 font-serif text-[44px] text-foreground">Seu painel.</h2>
        <p className="mt-3 font-sans text-[16px] text-muted-foreground">
          Em breve, sua jornada aparece aqui.
        </p>
      </main>

      <LogoutModal
        open={showLogout}
        onCancel={() => setShowLogout(false)}
        onConfirm={handleLogout}
        loading={loggingOut}
      />
    </div>
  );
}
