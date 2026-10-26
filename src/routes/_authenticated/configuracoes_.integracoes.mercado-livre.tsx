import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { CHAVE_STATUS_ML } from "@/hooks/useCanaisConectados";
import { finalizarConexaoMercadoLivre } from "@/lib/mercadoLivre.functions";
import { toastErro, toastSucesso } from "@/lib/toast";
import { track } from "@/lib/analytics";

// Volta da autorização do Mercado Livre (URI de redirecionamento cadastrada no
// app do DevCenter). Fora do layout de Configurações (o "_" no nome do arquivo):
// só troca o code por token e devolve a usuária para a seção Integrações.
// Sem state, ou com state que não é dela, a conexão é recusada. Conectou: vai
// direto para Ligar anúncios, o próximo passo (VND-39); falhou: volta para Integrações.

interface RetornoMlSearch {
  code?: string;
  state?: string;
}

export const Route = createFileRoute("/_authenticated/configuracoes_/integracoes/mercado-livre")({
  validateSearch: (search: Record<string, unknown>): RetornoMlSearch => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
  }),
  head: () => ({ meta: [{ title: "Conectando o Mercado Livre · Pólia One" }] }),
  component: RetornoMercadoLivre,
});

function RetornoMercadoLivre() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  // StrictMode roda o efeito duas vezes em dev; o code do Mercado Livre só vale uma.
  const jaRodou = useRef(false);

  useEffect(() => {
    if (jaRodou.current) return;
    jaRodou.current = true;
    const voltar = (conectou = false) => {
      qc.invalidateQueries({ queryKey: [CHAVE_STATUS_ML] });
      navigate({
        to: conectou ? "/produtos/anuncios/mercado-livre" : "/configuracoes",
        replace: true,
      });
    };

    if (!search.code || !search.state) {
      toastErro("A autorização do Mercado Livre não foi concluída. Tenta conectar de novo.");
      voltar();
      return;
    }
    finalizarConexaoMercadoLivre({ data: { code: search.code, state: search.state } })
      .then((res) => {
        if (res.ok) {
          track("evento_mercado_livre_conectado");
          toastSucesso("Mercado Livre conectado. Agora liga os anúncios aos produtos da Pólia.");
        } else
          toastErro(
            res.error ?? "A Pólia One não conseguiu confirmar a conexão com o Mercado Livre.",
          );
        voltar(res.ok);
      })
      .catch(() => {
        toastErro("A Pólia One não conseguiu confirmar a conexão com o Mercado Livre.");
        voltar();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PaginaLogada titulo="Mercado Livre" eyebrow="Integrações">
      <p className="font-sans text-[var(--ink-soft)] text-[15px]" role="status" aria-live="polite">
        Conectando o Mercado Livre...
      </p>
    </PaginaLogada>
  );
}
