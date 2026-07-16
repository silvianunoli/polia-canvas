import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { isNativeApp } from "@/lib/platform";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

const DISMISS_KEY = "polia-app-entry-gate-dismissed";

// App Android/iOS, tela Home: quem já tem sessão pula direto pro painel (sem
// perguntar nada); quem não tem vê o modal "já é usuária?" uma vez por
// abertura do app (sessionStorage — reseta ao reabrir o app do zero). No
// site normal (web) isso não existe, a Home aparece igual sempre.
//
// "native" começa falso de propósito e só é confirmado depois do mount: o
// servidor nunca sabe que é o app (sem header próprio), então SSR sempre
// assume web — checar Capacitor durante a própria renderização quebraria a
// hidratação.
export function useAppEntryGate() {
  const { user, loading } = useSupabaseSession();
  const router = useRouter();
  const [native, setNative] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setNative(isNativeApp());
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!native || loading || !user) return;
    router.navigate({ to: "/painel", replace: true });
  }, [native, loading, user, router]);

  const explorar = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return {
    mostrarModal: native && !loading && !user && !dismissed,
    // enquanto a sessão carrega ou ela vai ser mandada pro painel, some com a
    // Home pra não piscar conteúdo de marketing antes do redirect.
    escondendoHome: native && (loading || !!user),
    explorar,
  };
}
