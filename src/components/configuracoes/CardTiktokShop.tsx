import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Lock } from "lucide-react";
import {
  alternarCuidaEstoqueTiktok,
  desconectarTiktok,
  iniciarConexaoTiktok,
  statusConexaoTiktok,
} from "@/lib/tiktokShop.functions";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { Switch } from "@/components/ui/switch";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { BTN_MIUDO } from "@/lib/botoes";
import { toastErro, toastSucesso } from "@/lib/toast";
import { CHAVE_STATUS_TIKTOK } from "@/hooks/useCanaisConectados";
import { GUIA_VENDEDORA } from "./guiasVendedora";

// Card do TikTok Shop (VND-05). Saiu de Configurações > Integrações pra tela
// Marketplaces em 24/11/2026 (ONE-255), igual ao do Mercado Livre. Só no Pro;
// some quando o servidor não tem as credenciais.

export function CardTiktokShop({ userId }: { userId: string | undefined }) {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: [CHAVE_STATUS_TIKTOK, userId],
    enabled: !!userId,
    queryFn: () => statusConexaoTiktok(),
  });
  const tiktok = statusQuery.data?.configurado ? statusQuery.data : null;
  const [confirmandoDesconectar, setConfirmandoDesconectar] = useState(false);

  const conectar = useMutation({
    mutationFn: () => iniciarConexaoTiktok(),
    onSuccess: (res) => {
      if (res.error || !res.url) {
        toastErro(res.error ?? "A Pólia One não conseguiu conectar com o TikTok Shop agora.");
        return;
      }
      window.location.href = res.url;
    },
    onError: () => toastErro("A Pólia One não conseguiu iniciar a conexão com o TikTok Shop."),
  });

  const cuidaEstoque = useMutation({
    mutationFn: (ligar: boolean) => alternarCuidaEstoqueTiktok({ data: { ligar } }),
    onSuccess: (res, ligar) => {
      if (!res.ok) {
        toastErro(res.error ?? "A Pólia One não conseguiu salvar agora.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: [CHAVE_STATUS_TIKTOK, userId] });
      toastSucesso(
        ligar
          ? "A Pólia passa a cuidar do estoque do TikTok. As quantidades sobem em até 1 minuto."
          : "O estoque do TikTok volta a ser cuidado só no TikTok.",
      );
    },
    onError: () => toastErro("A Pólia One não conseguiu salvar agora."),
  });

  const desconectar = useMutation({
    mutationFn: () => desconectarTiktok(),
    onSuccess: (res) => {
      if (!res.ok) {
        toastErro(res.error ?? "A Pólia One não conseguiu desconectar agora.");
        return;
      }
      setConfirmandoDesconectar(false);
      queryClient.invalidateQueries({ queryKey: [CHAVE_STATUS_TIKTOK, userId] });
      toastSucesso("TikTok Shop desconectado.");
    },
    onError: () => toastErro("A Pólia One não conseguiu desconectar agora."),
  });

  if (!tiktok) return null;

  return (
    <>
      <div className="p-4 border border-[var(--line)] rounded-xl bg-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-sans text-[var(--ink)] text-[14px] font-medium mb-0.5">
              TikTok Shop
              {tiktok.conectada && tiktok.lojaNome ? ` · ${tiktok.lojaNome}` : ""}
            </p>
            <p className="font-sans text-[var(--ink-soft)] text-[12px]">
              {tiktok.conectada
                ? tiktok.ultimoSync
                  ? `conectada · última sincronização ${new Date(tiktok.ultimoSync).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
                  : "conectada · os pedidos começam a chegar depois que os anúncios forem ligados"
                : "pedidos pagos viram venda na Pólia e o estoque fica igual nos dois lugares"}
            </p>
          </div>
          {!tiktok.conectada && !tiktok.liberado ? (
            <LinkInterno
              href={`/upgrade?rota=${encodeURIComponent("/produtos/anuncios")}&tier=projete`}
              className={BTN_MIUDO}
            >
              <Lock size={13} aria-hidden="true" /> Abre no Pro
            </LinkInterno>
          ) : tiktok.conectada ? (
            <button
              type="button"
              onClick={() => setConfirmandoDesconectar(true)}
              className={`${BTN_MIUDO} hover:border-[var(--danger)] hover:text-[var(--danger)]`}
            >
              Desconectar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => conectar.mutate()}
              disabled={conectar.isPending}
              className={BTN_MIUDO}
            >
              {conectar.isPending ? "Conectando..." : tiktok.erro ? "Conectar de novo" : "Conectar"}
            </button>
          )}
        </div>
        {tiktok.erro && !tiktok.conectada && (
          <p className="font-sans text-[var(--danger)] text-[12px] mt-2" role="alert">
            {tiktok.erro}
          </p>
        )}
        {!tiktok.conectada && (
          <>
            <ul className="font-sans text-[var(--ink-soft)] text-[12px] mt-3 space-y-1">
              <li>
                Antes de conectar: ter a loja aprovada no TikTok Shop, com conta de vendedora.
              </li>
              <li>A Pólia importa: anúncios, pedidos e quantidades.</li>
              <li>
                A Pólia não faz: criar anúncio, responder compradora, guardar dados de quem comprou.
              </li>
            </ul>
            {GUIA_VENDEDORA.tiktok_shop && (
              <a
                href={GUIA_VENDEDORA.tiktok_shop}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-[12px] font-medium text-[var(--secondary-text)] hover:underline"
              >
                Como abrir a conta de vendedora no TikTok Shop
                <ExternalLink size={12} aria-hidden="true" />
                <span className="sr-only">(abre em outra aba)</span>
              </a>
            )}
          </>
        )}
        {tiktok.conectada && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="font-sans text-[var(--ink-soft)] text-[12px]">
              {tiktok.anunciosLigados === 0
                ? "Nenhum anúncio ligado a produto da Pólia ainda."
                : `${tiktok.anunciosLigados} ${tiktok.anunciosLigados === 1 ? "anúncio ligado" : "anúncios ligados"} a produtos da Pólia.`}
            </p>
            <LinkInterno href="/produtos/anuncios/tiktok" className={BTN_MIUDO}>
              Ligar anúncios
            </LinkInterno>
          </div>
        )}
        {tiktok.conectada && (
          <div className="mt-3 flex items-start justify-between gap-4 border-t border-[var(--line)] pt-3">
            <div>
              <p className="font-sans text-[var(--ink)] text-[13px] font-medium mb-0.5">
                A Pólia cuida do estoque
              </p>
              <p className="font-sans text-[var(--ink-soft)] text-[12px]">
                Toda venda, entrada ou ajuste na Pólia atualiza a quantidade dos anúncios ligados no
                TikTok.
              </p>
            </div>
            <Switch
              checked={tiktok.cuidaEstoque}
              disabled={cuidaEstoque.isPending}
              onCheckedChange={(ligar) => cuidaEstoque.mutate(ligar)}
              aria-label="A Pólia cuida do estoque do TikTok Shop"
            />
          </div>
        )}
      </div>
      <ConfirmarAcao
        open={confirmandoDesconectar}
        onOpenChange={(aberto) => {
          if (!desconectar.isPending) setConfirmandoDesconectar(aberto);
        }}
        titulo="Desconectar o TikTok Shop?"
        descricao="Os pedidos param de chegar e as ligações entre anúncios e produtos são apagadas. As vendas que já entraram continuam na Pólia."
        textoConfirmar="Desconectar"
        textoCarregando="Desconectando..."
        destrutivo
        carregando={desconectar.isPending}
        onConfirmar={() => desconectar.mutateAsync()}
      />
    </>
  );
}
