import { createFileRoute } from "@tanstack/react-router";
import { TelaEntradaApp } from "@/components/app/TelaEntradaApp";

// Porta de entrada do app Android (AND-10): o capacitor.config.ts abre aqui.
// Não é página de busca, fica fora do índice e do sitemap.
export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }, { title: "Pólia One" }],
  }),
  component: TelaEntradaApp,
});
