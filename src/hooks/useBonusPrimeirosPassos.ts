import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTestePro } from "@/hooks/useTestePro";
import { track } from "@/lib/analytics";
import { DIAS_BONUS_PASSOS, podeGanharBonus } from "@/lib/testePro";
import { toastSucesso } from "@/lib/toast";

/**
 * Bônus dos primeiros passos (ONE-136): +7 dias no teste do Pro aberto.
 * Montado no layout da área logada e pedido a cada troca de tela: o último
 * passo pode acontecer na Calculadora ou no Planejamento, e quem fecha o
 * passo no último dia não pode depender de voltar ao Painel antes do cron.
 * Quem confere os passos e decide é resgatar_bonus_primeiros_passos(), que
 * devolve null quando ainda falta algo.
 */
export function useBonusPrimeirosPassos(pathname: string) {
  const qc = useQueryClient();
  const teste = useTestePro();
  const pode = podeGanharBonus(teste.data ?? null);
  const ultimoPedido = useRef<string | null>(null);
  const pedindo = useRef(false);

  useEffect(() => {
    if (!pode || pedindo.current || ultimoPedido.current === pathname) return;
    ultimoPedido.current = pathname;
    pedindo.current = true;
    void (async () => {
      const { data, error } = await supabase.rpc("resgatar_bonus_primeiros_passos");
      pedindo.current = false;
      if (error) {
        console.error("bonus_primeiros_passos", error);
        return;
      }
      if (!data) return;
      const ate = new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      // Mais tempo que o padrão: é a única vez que ela lê por que o teste cresceu.
      toastSucesso(
        `Os três primeiros passos estão feitos. O teste do Pro ganhou mais ${DIAS_BONUS_PASSOS} dias e vai até ${ate}.`,
        { duracaoMs: 8000 },
      );
      track("bonus_primeiros_passos", { dias: DIAS_BONUS_PASSOS });
      void qc.invalidateQueries({ queryKey: ["teste-pro"] });
    })();
  }, [pode, pathname, qc]);
}
