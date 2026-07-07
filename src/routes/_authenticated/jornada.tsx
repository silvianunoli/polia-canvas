import { createFileRoute, redirect } from "@tanstack/react-router";

// "Jornada" virou "Planejamento" (handoff 2026-07-03). Redirect permanente.
export const Route = createFileRoute("/_authenticated/jornada")({
  beforeLoad: () => {
    throw redirect({ to: "/planejamento" });
  },
});
