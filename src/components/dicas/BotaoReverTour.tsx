import { useNavigate } from "@tanstack/react-router";

import { useDicasVistas } from "@/hooks/useDicasVistas";

/** Desmarca o tour e leva pro Painel, onde ele abre de novo. */
export function BotaoReverTour({ className }: { className?: string }) {
  const { esquecer } = useDicasVistas();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        esquecer("tour");
        void navigate({ to: "/painel" });
      }}
      className={className}
    >
      Rever o tour
    </button>
  );
}
