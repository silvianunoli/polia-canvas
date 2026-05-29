import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/entregaveis")({
  beforeLoad: () => {
    throw redirect({ to: "/biblioteca" });
  },
});
