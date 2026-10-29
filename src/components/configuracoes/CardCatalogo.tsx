import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { desligarCatalogo, ligarCatalogo, statusCatalogo } from "@/lib/catalogo.functions";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { BTN_MIUDO } from "@/lib/botoes";
import { toastErro, toastSucesso } from "@/lib/toast";

// Card do catálogo online em Configurações > Integrações (ONE-148, fase 1).
// Uma ação: ligar o domínio do catálogo aos Pedidos. Só no Pro.

const CHAVE_STATUS_CATALOGO = "status-catalogo";

export function CardCatalogo({ userId }: { userId: string | undefined }) {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: [CHAVE_STATUS_CATALOGO, userId],
    enabled: !!userId,
    queryFn: () => statusCatalogo(),
  });
  const st = statusQuery.data;
  const [dominio, setDominio] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoDesligar, setConfirmandoDesligar] = useState(false);
  const recarregar = () => queryClient.invalidateQueries({ queryKey: [CHAVE_STATUS_CATALOGO, userId] });

  const ligar = useMutation({
    mutationFn: () => ligarCatalogo({ data: { dominio } }),
    onSuccess: (res) => {
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setErro(null);
      setDominio("");
      recarregar();
      toastSucesso(`Catálogo ligado. Os pedidos de ${res.dominio} entram em Pedidos, em A fazer.`);
    },
    onError: () => setErro("A Pólia One não conseguiu ligar o catálogo agora."),
  });

  const desligar = useMutation({
    mutationFn: () => desligarCatalogo(),
    onSuccess: (res) => {
      if (!res.ok) {
        toastErro(res.error);
        return;
      }
      setConfirmandoDesligar(false);
      recarregar();
      toastSucesso("Catálogo desligado dos Pedidos.");
    },
    onError: () => toastErro("A Pólia One não conseguiu desligar o catálogo agora."),
  });

  if (!st) return null;

  return (
    <>
      <div className="p-4 border border-[var(--line)] rounded-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-sans text-[var(--ink)] text-[14px] font-medium mb-0.5">
              Catálogo online
              {st.ligado && st.dominio ? ` · ${st.dominio}` : ""}
            </p>
            <p className="font-sans text-[var(--ink-soft)] text-[12px]">
              {st.ligado
                ? "ligado · cada pedido confirmado no catálogo entra em Pedidos, em A fazer"
                : "o pedido confirmado no catálogo entra em Pedidos, com a cliente, as peças e a variação de cada uma"}
            </p>
          </div>
          {!st.ligado && !st.liberado ? (
            <LinkInterno
              href={`/upgrade?rota=${encodeURIComponent("/configuracoes")}&tier=projete`}
              className={BTN_MIUDO}
            >
              <Lock size={13} aria-hidden="true" /> Abre no Pro
            </LinkInterno>
          ) : st.ligado ? (
            <button
              type="button"
              onClick={() => setConfirmandoDesligar(true)}
              className={`${BTN_MIUDO} hover:border-[var(--danger)] hover:text-[var(--danger)]`}
            >
              Desligar
            </button>
          ) : null}
        </div>

        {!st.ligado && st.liberado && (
          <form
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setErro(null);
              ligar.mutate();
            }}
          >
            <label className="flex-1 min-w-[200px] font-sans text-[12px] text-[var(--ink-soft)]">
              Domínio do catálogo
              <input
                value={dominio}
                onChange={(e) => setDominio(e.target.value)}
                placeholder="suamarca.com.br"
                inputMode="url"
                autoComplete="off"
                aria-invalid={!!erro}
                aria-describedby={erro ? "catalogo-erro" : undefined}
                className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--secondary-text)]"
              />
            </label>
            <button type="submit" disabled={ligar.isPending || !dominio.trim()} className={BTN_MIUDO}>
              {ligar.isPending ? "Ligando..." : "Ligar aos Pedidos"}
            </button>
          </form>
        )}
        {erro && (
          <p id="catalogo-erro" className="font-sans text-[var(--danger)] text-[12px] mt-2" role="alert">
            {erro}
          </p>
        )}
        {!st.ligado && st.liberado && (
          <p className="font-sans text-[var(--ink-soft)] text-[12px] mt-3">
            O catálogo continua mandando a cliente pro WhatsApp da loja, como sempre. Ligado, a Pólia
            também guarda o pedido aqui, mesmo quando a cliente não chega a enviar a mensagem.
          </p>
        )}
      </div>
      <ConfirmarAcao
        open={confirmandoDesligar}
        onOpenChange={setConfirmandoDesligar}
        titulo="Desligar o catálogo dos Pedidos?"
        descricao="Os pedidos novos do catálogo param de entrar na Pólia One e seguem só pelo WhatsApp. Os que já entraram continuam em Pedidos."
        textoConfirmar="Desligar"
        textoCarregando="Desligando..."
        destrutivo
        carregando={desligar.isPending}
        onConfirmar={() => desligar.mutateAsync()}
      />
    </>
  );
}
