import { createFileRoute, redirect } from "@tanstack/react-router";

// O quadro de Pedidos morou em /planner/pedidos de 28/10/2026 até o mesmo dia,
// quando o Planner saiu das usuárias e os Pedidos ganharam rota própria. Fica
// o redirect pra link salvo, aba antiga do app e e-mail não quebrarem.
export const Route = createFileRoute("/_authenticated/planner/pedidos")({
  beforeLoad: () => {
    throw redirect({ to: "/pedidos", replace: true });
  },
});
