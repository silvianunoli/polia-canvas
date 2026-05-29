import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/vendas-e-clientes")({
  beforeLoad: () => {
    throw redirect({ to: "/clientes" });
  },
});
