import { useEffect } from "react";

/**
 * Garante padrão "{Seção} · Pólia" em document.title.
 * Não substitui o head() da rota — só ajusta o título visível no browser
 * após hidratação (útil pra páginas que mudam título dinamicamente).
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const final = title.includes("Pólia") ? title : `${title} · Pólia`;
    const prev = document.title;
    document.title = final;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
