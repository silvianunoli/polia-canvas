import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import {
  confirmarConexaoTiktok,
  desconectarTiktok,
  finalizarConexaoTiktok,
} from "@/lib/tiktokShop.functions";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { toastErro, toastSucesso } from "@/lib/toast";
import { track } from "@/lib/analytics";

// Volta da autorização do TikTok Shop (Redirect URL cadastrada no app do Partner
// Center). Fora do layout de Configurações (o "_" no nome do arquivo): é só uma
// parada que troca o code por token e devolve a usuária para a seção Integrações.
// Quando a autorização começou no TikTok (sem state), a loja só liga à conta
// depois que ela confirma aqui, vendo o nome da loja.

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
  const [lojaParaConfirmar, setLojaParaConfirmar] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const voltar = () => {
    qc.invalidateQueries({ queryKey: ["tiktok-status"] });
    navigate({ to: "/configuracoes", replace: true });
  };

  useEffect(() => {
    if (jaRodou.current) return;
    jaRodou.current = true;

    if (!search.code) {
      toastErro("A autorização do TikTok Shop não foi concluída. Tenta conectar de novo.");
      voltar();
      return;
    }
    finalizarConexaoTiktok({ data: { code: search.code, state: search.state } })
      .then((res) => {
        if (res.ok && res.confirmar) {
          setLojaParaConfirmar(res.lojaNome ?? "sem nome");
          return;
        }
        if (res.ok) {
          track("evento_tiktok_conectado");
          toastSucesso("TikTok Shop conectado.");
        } else
          toastErro(
            res.error ?? "A Pólia One não conseguiu confirmar a conexão com o TikTok Shop.",
          );
        voltar();
      })
      .catch(() => {
        toastErro("A Pólia One não conseguiu confirmar a conexão com o TikTok Shop.");
        voltar();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmar = async () => {
    setSalvando(true);
    try {
      const res = await confirmarConexaoTiktok();
      if (res.ok) {
        track("evento_tiktok_conectado", { origem: "tiktok" });
        toastSucesso("TikTok Shop conectado.");
      } else toastErro(res.error ?? "A Pólia One não conseguiu conectar agora.");
    } catch {
      toastErro("A Pólia One não conseguiu conectar agora.");
    }
    voltar();
  };

  const cancelar = async () => {
    setSalvando(true);
    try {
      await desconectarTiktok();
    } finally {
      voltar();
    }
  };

  if (lojaParaConfirmar) {
    return (
      <PaginaLogada titulo="Conectar o TikTok Shop?" eyebrow="Integrações">
        <p className="font-sans text-[var(--ink-soft)] text-[15px] mb-6">
          O TikTok autorizou a loja{" "}
          <strong className="text-[var(--ink)]">{lojaParaConfirmar}</strong>. Conectando, os pedidos
          pagos dessa loja passam a entrar em Vendas nesta conta da Pólia One.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={confirmar} disabled={salvando} className={BTN_ACAO}>
            {salvando ? "Conectando..." : "Conectar esta loja"}
          </button>
          <button
            type="button"
            onClick={cancelar}
            disabled={salvando}
            className={BTN_ACAO_CONTORNO}
          >
            Cancelar
          </button>
        </div>
      </PaginaLogada>
    );
  }

  return (
    <PaginaLogada titulo="TikTok Shop" eyebrow="Integrações">
      <p className="font-sans text-[var(--ink-soft)] text-[15px]" role="status" aria-live="polite">
        Conectando o TikTok Shop...
      </p>
    </PaginaLogada>
  );
}
