import { useEffect, useState } from "react";

/**
 * Detecta perda/volta de conexão via eventos online/offline do browser.
 * Começa sempre `true` (otimista) de propósito: se este código está
 * rodando, o browser acabou de baixar o HTML/JS pela rede com sucesso —
 * ou seja, é logicamente impossível estar offline nesse exato momento.
 * `navigator.onLine` no mount é não-confiável (flapping conhecido em vários
 * browsers/SOs bem na hora do reload) e causava a tela de "sem conexão"
 * piscar em todo F5, mesmo com internet normal. Só reagimos a mudança real
 * de conectividade durante a sessão via os eventos.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
