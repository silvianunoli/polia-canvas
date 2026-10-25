import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import {
  desconectarMercadoLivre,
  iniciarConexaoMercadoLivre,
  statusConexaoMercadoLivre,
} from "@/lib/mercadoLivre.functions";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { BTN_MIUDO } from "@/lib/botoes";
import { toastErro, toastSucesso } from "@/lib/toast";

// Card do Mercado Livre em Configurações > Integrações (Fase 3c, VND-30). Só no
// Pro; some quando o servidor não tem as credenciais. Plano §6.1 e §6.2.
// "A Pólia cuida do estoque" entra na 3c.4.

export const CHAVE_STATUS_ML = "mercado-livre-status";

export function CardMercadoLivre({ userId }: { userId: string | undefined }) {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: [CHAVE_STATUS_ML, userId],
    enabled: !!userId,
    queryFn: () => statusConexaoMercadoLivre(),
  });
  const ml = statusQuery.data?.configurado ? statusQuery.data : null;
  const [confirmandoDesconectar, setConfirmandoDesconectar] = useState(false);

  const conectar = useMutation({
    mutationFn: () => iniciarConexaoMercadoLivre(),
    onSuccess: (res) => {
      if (res.error || !res.url) {
        toastErro(res.error ?? "A Pólia One não conseguiu conectar com o Mercado Livre agora.");
        return;
      }
      window.location.href = res.url;
    },
    onError: () => toastErro("A Pólia One não conseguiu iniciar a conexão com o Mercado Livre."),
  });

  const desconectar = useMutation({
    mutationFn: () => desconectarMercadoLivre(),
    onSuccess: (res) => {
      if (!res.ok) {
        toastErro(res.error ?? "A Pólia One não conseguiu desconectar agora.");
        return;
      }
      setConfirmandoDesconectar(false);
      queryClient.invalidateQueries({ queryKey: [CHAVE_STATUS_ML, userId] });
      toastSucesso("Mercado Livre desconectado.");
    },
    onError: () => toastErro("A Pólia One não conseguiu desconectar agora."),
  });

  if (!ml) return null;

  return (
    <>
      <div className="p-4 border border-[var(--line)] rounded-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-sans text-[var(--ink)] text-[14px] font-medium mb-0.5">
              Mercado Livre
              {ml.conectada && ml.lojaNome ? ` · ${ml.lojaNome}` : ""}
            </p>
            <p className="font-sans text-[var(--ink-soft)] text-[12px]">
              {ml.conectada
                ? ml.ultimoSync
                  ? `conectada · última sincronização ${new Date(ml.ultimoSync).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
                  : "conectada · os pedidos começam a chegar depois que os anúncios forem ligados"
                : "pedidos pagos viram venda na Pólia, com a tarifa e o frete que o Mercado Livre cobrou"}
            </p>
          </div>
          {!ml.conectada && !ml.liberado ? (
            <LinkInterno
              href={`/upgrade?rota=${encodeURIComponent("/configuracoes")}&tier=projete`}
              className={BTN_MIUDO}
            >
              <Lock size={13} aria-hidden="true" /> Abre no Pro
            </LinkInterno>
          ) : ml.conectada ? (
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
              {conectar.isPending ? "Conectando..." : ml.erro ? "Conectar de novo" : "Conectar"}
            </button>
          )}
        </div>
        {ml.erro && !ml.conectada && (
          <p className="font-sans text-[var(--danger)] text-[12px] mt-2" role="alert">
            {ml.erro}
          </p>
        )}
        {!ml.conectada && (
          <ul className="font-sans text-[var(--ink-soft)] text-[12px] mt-3 space-y-1">
            <li>A Pólia importa: anúncios, pedidos, tarifas, frete e quantidades.</li>
            <li>
              A Pólia não faz: criar anúncio, responder compradora, guardar dados de quem comprou.
            </li>
            <li>Antes de conectar: entrar com a conta dona da loja, não com a de colaboradora.</li>
          </ul>
        )}
        {ml.conectada && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="font-sans text-[var(--ink-soft)] text-[12px]">
              {ml.anunciosLigados === 0
                ? "Nenhum anúncio ligado a produto da Pólia ainda."
                : `${ml.anunciosLigados} ${ml.anunciosLigados === 1 ? "anúncio ligado" : "anúncios ligados"} a produtos da Pólia.`}
            </p>
            <LinkInterno
              href="/configuracoes/integracoes/mercado-livre/anuncios"
              className={BTN_MIUDO}
            >
              Ligar anúncios
            </LinkInterno>
          </div>
        )}
      </div>
      <ConfirmarAcao
        open={confirmandoDesconectar}
        onOpenChange={(aberto) => {
          if (!desconectar.isPending) setConfirmandoDesconectar(aberto);
        }}
        titulo="Desconectar o Mercado Livre?"
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
