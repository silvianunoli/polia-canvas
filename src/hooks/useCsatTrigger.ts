import { useEffect, useState } from "react";
import {
  csatFlagAtiva,
  enviarFeedback,
  marcarCsatMostrado,
  podeMostrarCsat,
  type CsatScore,
  type CsatTriggerType,
} from "@/lib/csat";

const DELAY_ANTES_DE_MOSTRAR_MS = 1500;

// Orquestra se/quando o card de CSAT aparece pra um gatilho+contexto: checa a
// flag remota e o dedupe local, dá um respiro pra transição de tela assentar,
// e só marca "mostrado" quando o card de fato aparece na tela.
export function useCsatTrigger(triggerType: CsatTriggerType, contextRef: string, condicao = true) {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    if (!condicao) return;
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      if (!podeMostrarCsat(contextRef)) return;
      const ativa = await csatFlagAtiva();
      if (cancelado || !ativa) return;
      timer = setTimeout(() => {
        if (cancelado) return;
        marcarCsatMostrado(contextRef);
        setMostrar(true);
      }, DELAY_ANTES_DE_MOSTRAR_MS);
    })();

    return () => {
      cancelado = true;
      if (timer) clearTimeout(timer);
    };
  }, [triggerType, contextRef, condicao]);

  const fechar = () => setMostrar(false);

  const enviar = async (score: CsatScore, comment?: string) => {
    setMostrar(false);
    await enviarFeedback(triggerType, contextRef, score, comment);
  };

  return { mostrar, fechar, enviar };
}
