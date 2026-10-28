import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/platform";

/**
 * true dentro do app Android (Capacitor). Começa falso e só é confirmado
 * depois de montar: o servidor não sabe que é o app, então decidir na própria
 * renderização quebraria a hidratação (mesmo motivo de useAppEntryGate).
 */
export function useAppNativo(): boolean {
  const [nativo, setNativo] = useState(false);
  useEffect(() => setNativo(isNativeApp()), []);
  return nativo;
}
