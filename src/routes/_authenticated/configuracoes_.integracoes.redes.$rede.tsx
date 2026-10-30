import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { finalizarConexaoRede } from "@/lib/redesSociais.functions";
import { NOME_REDE, ehRede } from "../../../supabase/functions/_shared/redesSociais.ts";
import { toastErro, toastSucesso } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { CHAVE_STATUS_REDES } from "@/components/configuracoes/CardRedesSociais";

// Volta da autorização do TikTok e do Instagram (Agenda das redes, ONE-154).
// Redirect cadastrado nos portais: /configuracoes/integracoes/redes/tiktok e
// /configuracoes/integracoes/redes/instagram. Fora do layout de Configurações (o
// "_" no nome do arquivo): troca o code por token e devolve para Integrações.

interface RetornoRedeSearch {
  code?: string;
  state?: string;
  error?: string;
}

export const Route = createFileRoute("/_authenticated/configuracoes_/integracoes/redes/$rede")({
  validateSearch: (search: Record<string, unknown>): RetornoRedeSearch => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    // TikTok devolve error=access_denied; Instagram, error=access_denied ou error_reason.
    error:
      typeof search.error === "string"
        ? search.error
        : typeof search.error_reason === "string"
          ? search.error_reason
          : undefined,
  }),
  head: () => ({ meta: [{ title: "Conectando a rede · Pólia One" }] }),
  component: RetornoRede,
});

function RetornoRede() {
  const { rede } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  // StrictMode roda o efeito duas vezes em dev; o code só vale uma.
  const jaRodou = useRef(false);
  const nome = ehRede(rede) ? NOME_REDE[rede] : "rede";

  useEffect(() => {
    if (jaRodou.current) return;
    jaRodou.current = true;
    const voltar = () => {
      qc.invalidateQueries({ queryKey: [CHAVE_STATUS_REDES] });
      navigate({ to: "/configuracoes", replace: true });
    };

    if (!ehRede(rede) || !search.code || !search.state || search.error) {
      toastErro(`A autorização do ${nome} não foi concluída. Tenta conectar de novo.`);
      voltar();
      return;
    }
    finalizarConexaoRede({ data: { rede, code: search.code, state: search.state } })
      .then((res) => {
        if (res.ok) {
          track("evento_rede_social_conectada", { rede });
          toastSucesso(
            res.usuario ? `${nome} conectado como @${res.usuario}.` : `${nome} conectado.`,
          );
        } else
          toastErro(res.error ?? `A Pólia One não conseguiu confirmar a conexão com o ${nome}.`);
        voltar();
      })
      .catch(() => {
        toastErro(`A Pólia One não conseguiu confirmar a conexão com o ${nome}.`);
        voltar();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PaginaLogada titulo={nome} eyebrow="Integrações">
      <p className="font-sans text-[var(--ink-soft)] text-[15px]" role="status" aria-live="polite">
        Conectando o {nome}...
      </p>
    </PaginaLogada>
  );
}
