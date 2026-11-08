import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { CHAVE_STATUS_ENVIO } from "@/components/configuracoes/CardEnvioLoja";
import { finalizarConexaoMelhorEnvio } from "@/lib/envioLoja.functions";
import { toastErro, toastSucesso } from "@/lib/toast";

// Volta da autorização do Melhor Envio (endereço de retorno cadastrado no aplicativo da
// Área Dev). Fora do layout de Configurações: só troca o code pelo token e devolve a dona
// para Configurações. Sem state, ou com state que não é dela, a conexão é recusada.

interface RetornoMeSearch {
  code?: string;
  state?: string;
}

export const Route = createFileRoute("/_authenticated/configuracoes_/integracoes/melhor-envio")({
  validateSearch: (search: Record<string, unknown>): RetornoMeSearch => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
  }),
  head: () => ({ meta: [{ title: "Conectando o Melhor Envio · Pólia One" }] }),
  component: RetornoMelhorEnvio,
});

function RetornoMelhorEnvio() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  // StrictMode roda o efeito duas vezes em dev; o code só vale uma.
  const jaRodou = useRef(false);

  useEffect(() => {
    if (jaRodou.current) return;
    jaRodou.current = true;
    const voltar = () => {
      qc.invalidateQueries({ queryKey: [CHAVE_STATUS_ENVIO] });
      navigate({ to: "/configuracoes", replace: true });
    };
    if (!search.code || !search.state) {
      toastErro("A autorização do Melhor Envio não foi concluída. Tenta conectar de novo.");
      voltar();
      return;
    }
    finalizarConexaoMelhorEnvio({ data: { code: search.code, state: search.state } })
      .then((res) => {
        if (res.ok) toastSucesso("Melhor Envio conectado. Confira o envio da loja em Integrações.");
        else toastErro(res.error ?? "A Pólia One não conseguiu confirmar a conexão com o Melhor Envio.");
        voltar();
      })
      .catch(() => {
        toastErro("A Pólia One não conseguiu confirmar a conexão com o Melhor Envio.");
        voltar();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PaginaLogada titulo="Melhor Envio" eyebrow="Integrações">
      <p className="font-sans text-[var(--ink-soft)] text-[15px]" role="status" aria-live="polite">
        Conectando o Melhor Envio...
      </p>
    </PaginaLogada>
  );
}
