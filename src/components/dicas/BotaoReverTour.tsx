import { useNavigate } from "@tanstack/react-router";

import { useDicasVistas } from "@/hooks/useDicasVistas";

/**
 * Desmarca as boas-vindas e o tour e leva pro Painel, onde o "Assim a Pólia One
 * funciona" abre de novo. Até 31/10/2026 desmarcava só o tour, porque era o
 * balão do Planejamento que abria; com o Planejamento fora da Pólia One, o
 * Painel não monta mais o balão e o botão ficaria sem efeito.
 */
export function BotaoReverTour({ className }: { className?: string }) {
  const { esquecer } = useDicasVistas();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        // As duas gravações entram na mesma fila do hook, uma depois da outra.
        esquecer("tour");
        esquecer("boas-vindas");
        void navigate({ to: "/painel" });
      }}
      className={className}
    >
      Rever o tour
    </button>
  );
}
