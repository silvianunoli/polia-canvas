import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { isNativeApp } from "@/lib/platform";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

// App Android/iOS, tela Home: a home de marketing não aparece dentro do app.
// Quem já tem sessão pula direto pra aba Hoje (AND-07); quem não tem vai pra
// tela de entrada do app, /app (AND-10, 07/11/2026, substitui o modal "já é
// usuária?"). O app novo já abre em /app; isto cobre o APK antigo, que abre
// na raiz, e quem sai da conta e cai na home. No site normal (web) nada muda.
//
// "native" começa falso de propósito e só é confirmado depois do mount: o
// servidor nunca sabe que é o app (sem header próprio), então SSR sempre
// assume web — checar Capacitor durante a própria renderização quebraria a
// hidratação.
export function useAppEntryGate() {
  const { user, loading } = useSupabaseSession();
  const router = useRouter();
  const [native, setNative] = useState(false);

  useEffect(() => {
    setNative(isNativeApp());
  }, []);

  useEffect(() => {
    if (!native || loading) return;
    router.navigate({ to: user ? "/hoje" : "/app", replace: true });
  }, [native, loading, user, router]);

  return {
    // No app a Home some sempre: ela só existe ali pelo tempo do redirect.
    escondendoHome: native,
  };
}
