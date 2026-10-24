import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { finalizarConexaoTiktok } from "@/lib/tiktokShop.functions";
import { toastErro, toastSucesso } from "@/lib/toast";
import { track } from "@/lib/analytics";

// Volta da autorização do TikTok Shop (Redirect URL cadastrada no app do Partner
// Center). Fora do layout de Configurações (o "_" no nome do arquivo): é só uma
// parada que troca o code por token e devolve a usuária para a seção Integrações.

interface RetornoTiktokSearch {
  code?: string;
  state?: string;
}

export const Route = createFileRoute("/_authenticated/configuracoes_/integracoes/tiktok")({
  validateSearch: (search: Record<string, unknown>): RetornoTiktokSearch => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
  }),
  head: () => ({ meta: [{ title: "Conectando o TikTok Shop · Pólia One" }] }),
  component: RetornoTiktok,
});

function RetornoTiktok() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  // StrictMode roda o efeito duas vezes em dev; o code do TikTok só vale uma.
  const jaRodou = useRef(false);

  useEffect(() => {
    if (jaRodou.current) return;
    jaRodou.current = true;
    const voltar = () => navigate({ to: "/configuracoes", replace: true });

    if (!search.code || !search.state) {
      toastErro("A autorização do TikTok Shop não foi concluída. Tenta conectar de novo.");
      voltar();
      return;
    }
    finalizarConexaoTiktok({ data: { code: search.code, state: search.state } })
      .then((res) => {
        if (res.ok) {
          track("evento_tiktok_conectado");
          toastSucesso("TikTok Shop conectado.");
        } else
          toastErro(
            res.error ?? "A Pólia One não conseguiu confirmar a conexão com o TikTok Shop.",
          );
      })
      .catch(() => toastErro("A Pólia One não conseguiu confirmar a conexão com o TikTok Shop."))
      .finally(() => {
        qc.invalidateQueries({ queryKey: ["tiktok-status"] });
        voltar();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PaginaLogada titulo="TikTok Shop" eyebrow="Integrações">
      <p className="font-sans text-[var(--ink-soft)] text-[15px]" role="status" aria-live="polite">
        Conectando o TikTok Shop...
      </p>
    </PaginaLogada>
  );
}
