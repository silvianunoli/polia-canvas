import { createFileRoute, redirect } from "@tanstack/react-router";

// "Marca Viva" virou "Marca" (handoff 2026-07-03). Redirect permanente.
export const Route = createFileRoute("/_authenticated/marca-viva")({
  beforeLoad: () => {
    throw redirect({ to: "/marca" });
  },
});
