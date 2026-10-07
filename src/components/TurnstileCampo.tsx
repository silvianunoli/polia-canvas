import { useCallback, useEffect, useState } from "react";
import { useTurnstile } from "@/hooks/useTurnstile";
import { TurnstileWidget } from "@/components/TurnstileWidget";

// Anti-robô das telas de conta (FUN-03). O useTurnstile desenha o widget uma vez,
// no mount de quem chama; no login o formulário troca (entrar / recuperar) e o
// widget sumia junto. Aqui o widget nasce com o próprio campo: cada formulário
// que aparece na tela ganha o seu, e o token sobe pra página.

/** Token atual e um jeito de pedir token novo depois de cada tentativa. */
export function useCaptcha() {
  const [token, setToken] = useState<string | null>(null);
  const [pedidoDeReset, setPedidoDeReset] = useState(0);
  const resetar = useCallback(() => {
    setToken(null);
    setPedidoDeReset((n) => n + 1);
  }, []);
  return { token, setToken, resetar, pedidoDeReset };
}

export function TurnstileCampo({ captcha }: { captcha: ReturnType<typeof useCaptcha> }) {
  const ts = useTurnstile();
  const { setToken, pedidoDeReset } = captcha;

  useEffect(() => {
    setToken(ts.token);
  }, [ts.token, setToken]);

  useEffect(() => {
    if (pedidoDeReset > 0) ts.reset();
    // ts.reset muda a cada render; só o pedido importa aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoDeReset]);

  return <TurnstileWidget containerRef={ts.containerRef} />;
}
