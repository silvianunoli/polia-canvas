import { createFileRoute, redirect } from "@tanstack/react-router";

// "Etapa" virou "Módulo" dentro do Planejamento (handoff 2026-07-03).
// Redirect permanente /etapa/$n → /planejamento/modulo/$n.
export const Route = createFileRoute("/_authenticated/etapa/$n")({
  beforeLoad: ({ params }) => {
    const n = Number(params.n);
    const alvo = Number.isInteger(n) && n >= 1 && n <= 6 ? String(n) : "1";
    throw redirect({ to: "/planejamento/modulo/$n", params: { n: alvo } });
  },
});
