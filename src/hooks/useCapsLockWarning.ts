import { useState, type KeyboardEvent } from "react";

// Aviso de Caps Lock: hint, não erro (--muted). Some sozinho quando desliga.
export function useCapsLockWarning() {
  const [ligado, setLigado] = useState(false);
  const onKeyUp = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) setLigado(e.getModifierState("CapsLock"));
  };
  return { ligado, onKeyUp };
}
