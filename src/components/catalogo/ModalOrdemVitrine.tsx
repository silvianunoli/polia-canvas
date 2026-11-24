import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { BlockError } from "@/components/ui/BlockError";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { toastErro } from "@/lib/toast";
import {
  CHAVE_PRODUTOS_CATALOGO,
  moverNaLista,
  salvarOrdemDaVitrine,
  useProdutosDoCatalogo,
  type ProdutoDoCatalogo,
} from "./dados";

const BTN_SETA =
  "flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] hover:border-[var(--secondary-text)] focus-visible:outline-2 focus-visible:outline-[var(--secondary-text)] disabled:opacity-40 disabled:pointer-events-none";

/**
 * Ordem da Vitrine online aberta de Produtos (pedido da Sil, 22/11/2026: a
 * ordem também mora no cadastro de produtos). Mesma lista e mesma gravação
 * (produtos.catalogo_ordem) da tela Vitrine online; cada seta salva na hora.
 */
export function ModalOrdemVitrine({ userId, onClose }: { userId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useProdutosDoCatalogo(userId, true);
  const [ordenando, setOrdenando] = useState(false);
  const naVitrine = (q.data ?? []).filter((p) => p.noCatalogo);
  const fora = (q.data ?? []).filter((p) => !p.noCatalogo);

  const mover = async (indice: number, direcao: -1 | 1) => {
    const nova = moverNaLista(naVitrine, indice, direcao);
    const chave = [CHAVE_PRODUTOS_CATALOGO, userId];
    const antes = qc.getQueryData<ProdutoDoCatalogo[]>(chave);
    qc.setQueryData<ProdutoDoCatalogo[]>(chave, [...nova.map((p, i) => ({ ...p, ordem: i + 1 })), ...fora]);
    setOrdenando(true);
    const r = await salvarOrdemDaVitrine(nova.map((p) => p.id));
    setOrdenando(false);
    if (r.error) {
      qc.setQueryData(chave, antes);
      toastErro(r.error);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(n) => !n && onClose()}
      title="Ordem na Vitrine online"
      description="Use as setas pra escolher quem aparece primeiro na loja. Cada mudança salva na hora."
      footer={
        <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
          Fechar
        </button>
      }
    >
      {q.isError ? (
        <BlockError message="A Pólia One não conseguiu abrir os produtos agora." onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <p className="text-[14px] text-[var(--muted)]">Carregando os produtos…</p>
      ) : !naVitrine.length ? (
        <p className="text-[14px] text-[var(--ink-soft)]">
          Nenhum produto na vitrine ainda. Abra um produto, marque “Mostrar na Vitrine online” e salve.
        </p>
      ) : (
        <ol
          className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-[var(--surface)]"
          aria-label="Produtos na vitrine, na ordem em que aparecem"
        >
          {naVitrine.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 p-3">
              <span className="w-6 text-right text-[13px] font-medium text-[var(--muted)]">{i + 1}º</span>
              <button
                type="button"
                className={BTN_SETA}
                onClick={() => void mover(i, -1)}
                disabled={ordenando || i === 0}
                aria-label={`Subir ${p.nome} na vitrine`}
              >
                <ArrowUp size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={BTN_SETA}
                onClick={() => void mover(i, 1)}
                disabled={ordenando || i === naVitrine.length - 1}
                aria-label={`Descer ${p.nome} na vitrine`}
              >
                <ArrowDown size={16} aria-hidden="true" />
              </button>
              <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--ink)]">{p.nome}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-[13px] text-[var(--muted)]">
        Categoria e fotos de cada produto ficam em{" "}
        <LinkInterno href="/catalogo" className="font-medium text-[var(--secondary-text)] hover:underline">
          Vitrine online
        </LinkInterno>
        .
      </p>
    </Modal>
  );
}
