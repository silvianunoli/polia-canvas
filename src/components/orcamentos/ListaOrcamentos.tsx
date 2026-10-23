import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Vazio } from "@/components/layout/Vazio";
import { BlockError } from "@/components/ui/BlockError";
import { MenuOpcoes } from "@/components/ui/MenuOpcoes";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { BTN_ACAO, BTN_MIUDO_ACAO } from "@/lib/botoes";
import { fmt } from "@/components/produtos/tipos";
import { dataISOLocal, hojeISO } from "@/lib/data.functions";
import { toastErro, toastSucesso } from "@/lib/toast";
import { track } from "@/lib/analytics";
import {
  ROTULO_SITUACAO,
  mensagemWhatsApp,
  podeVirarVenda,
  situacaoDoOrcamento,
  type Orcamento,
  type SituacaoOrcamento,
} from "@/lib/orcamentos";
import { ModalRegistrarVenda } from "@/components/vendas/ModalRegistrarVenda";
import {
  cancelarOrcamento,
  chaveOrcamentos,
  excluirOrcamento,
  linkDoOrcamento,
  useIdentidadeMarca,
  useOrcamentos,
} from "./dados";
import { ModalOrcamento } from "./ModalOrcamento";

const COR_SITUACAO: Record<SituacaoOrcamento, string> = {
  enviado: "border-[var(--line)] bg-white text-[var(--ink-soft)]",
  aprovado: "border-transparent bg-[var(--secondary-light)] text-[var(--ink)]",
  convertido: "border-transparent bg-[var(--surface)] text-[var(--ink-soft)]",
  cancelado: "border-[var(--line)] bg-white text-[var(--muted)]",
  vencido: "border-[var(--line)] bg-white text-[var(--muted)]",
};

/** dd/mm do dia local (created_at vem em UTC; depois das 21h viraria o dia seguinte). */
const diaMes = (isoOuData: string) =>
  (isoOuData.length > 10 ? dataISOLocal(new Date(isoOuData)) : isoOuData)
    .split("-")
    .reverse()
    .slice(0, 2)
    .join("/");

/**
 * Aba Orçamentos em Vendas (ONE-129). Aprovado pela cliente vem primeiro e é
 * o único com "Virar venda" à vista: é o que pede ação. Os outros têm a ação no
 * menu. Virar venda grava a venda e marca o orçamento numa transação só
 * (converter_orcamento).
 */
export function ListaOrcamentos({
  userId,
  novoAberto,
  onNovoAbertoChange,
  onVendaRegistrada,
}: {
  userId: string;
  /** O botão "+ Novo orçamento" mora no cabeçalho da página. */
  novoAberto: boolean;
  onNovoAbertoChange: (aberto: boolean) => void;
  onVendaRegistrada: () => void;
}) {
  const qc = useQueryClient();
  const query = useOrcamentos(userId);
  const identidade = useIdentidadeMarca(userId);
  const hoje = hojeISO();
  const [base, setBase] = useState<Orcamento | null>(null);
  const [virando, setVirando] = useState<Orcamento | null>(null);
  const [cancelar, setCancelar] = useState<Orcamento | null>(null);
  const [excluir, setExcluir] = useState<Orcamento | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const lista = useMemo(() => {
    const ordem: Record<SituacaoOrcamento, number> = {
      aprovado: 0,
      enviado: 1,
      vencido: 2,
      convertido: 3,
      cancelado: 4,
    };
    return [...(query.data ?? [])].sort(
      (a, b) =>
        ordem[situacaoDoOrcamento(a, hoje)] - ordem[situacaoDoOrcamento(b, hoje)] ||
        b.createdAt.localeCompare(a.createdAt),
    );
  }, [query.data, hoje]);

  const recarregar = () => qc.invalidateQueries({ queryKey: chaveOrcamentos(userId) });

  const copiar = async (o: Orcamento) => {
    try {
      await navigator.clipboard.writeText(linkDoOrcamento(o.linkToken));
      toastSucesso(`Link do orçamento nº ${o.numero} copiado.`);
    } catch {
      toastErro("O navegador não deixou copiar. Abra como a cliente vê e copie o endereço.");
    }
  };

  const whatsapp = (o: Orcamento) => {
    const texto = mensagemWhatsApp({
      marca: identidade.data?.nome || null,
      numero: o.numero,
      clienteNome: o.clienteNome,
      link: linkDoOrcamento(o.linkToken),
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  };

  const confirmarCancelar = async () => {
    if (!cancelar) return;
    setOcupado(true);
    const { error } = await cancelarOrcamento(cancelar.id);
    setOcupado(false);
    if (error) {
      console.error("orcamento_cancelar", error);
      toastErro("A Pólia One não conseguiu cancelar o orçamento. Tenta de novo.");
      return;
    }
    track("orcamento_cancelado");
    setCancelar(null);
    recarregar();
  };

  const confirmarExcluir = async () => {
    if (!excluir) return;
    setOcupado(true);
    const { error } = await excluirOrcamento(excluir.id);
    setOcupado(false);
    if (error) {
      console.error("orcamento_excluir", error);
      toastErro("A Pólia One não conseguiu excluir o orçamento. Tenta de novo.");
      return;
    }
    track("orcamento_excluido");
    setExcluir(null);
    recarregar();
  };

  const fecharModalOrcamento = () => {
    onNovoAbertoChange(false);
    setBase(null);
  };

  return (
    <div>
      <p className="mb-4 text-[13px] text-[var(--muted)]">
        A cliente abre pelo link, vê os itens e aprova. Aprovado vem primeiro na lista.
      </p>

      {query.isError ? (
        <div role="alert">
          <BlockError
            message="A Pólia One não conseguiu ler os orçamentos agora. Nada foi perdido, é só a leitura que falhou."
            onRetry={() => void query.refetch()}
          />
        </div>
      ) : query.isLoading ? (
        <div
          className="h-24 animate-pulse rounded-xl border border-[var(--line)] bg-white motion-reduce:animate-none"
          aria-busy="true"
          aria-label="Carregando orçamentos"
        />
      ) : lista.length === 0 ? (
        <Vazio
          icone={FileText}
          titulo="Nenhum orçamento ainda."
          texto="Monte com os produtos do catálogo, mande o link no WhatsApp e a cliente aprova por lá."
          acao={
            <button type="button" onClick={() => onNovoAbertoChange(true)} className={BTN_ACAO}>
              + Novo orçamento
            </button>
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-white">
          {lista.map((o) => {
            const situacao = situacaoDoOrcamento(o, hoje);
            const itensResumo = o.itens
              .map((i) => `${i.quantidade}x ${i.produto_nome}${i.variacao ? ` ${i.variacao}` : ""}`)
              .join(", ");
            return (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[15px] text-[var(--ink)]">
                    <span>
                      Nº {o.numero}
                      {o.clienteNome ? ` · ${o.clienteNome}` : ""}
                    </span>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] ${COR_SITUACAO[situacao]}`}
                    >
                      {ROTULO_SITUACAO[situacao]}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--muted)]">
                    {itensResumo} · criado em {diaMes(o.createdAt)} · vale até {diaMes(o.validade)}
                  </p>
                  {situacao === "aprovado" && (
                    <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                      {o.aprovadoEm ? `Aprovado em ${diaMes(o.aprovadoEm)}. ` : ""}
                      Combine o pagamento e a entrega e clique em Virar venda.
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <p className="font-cabinet text-[18px] tabular-nums text-[var(--ink)]">
                    {fmt(o.total)}
                  </p>
                  {situacao === "aprovado" && (
                    <button
                      type="button"
                      onClick={() => setVirando(o)}
                      aria-label={`Virar venda o orçamento nº ${o.numero}`}
                      className={BTN_MIUDO_ACAO}
                    >
                      Virar venda
                    </button>
                  )}
                  <MenuOpcoes
                    align="end"
                    ariaLabel={`Opções do orçamento nº ${o.numero}`}
                    itens={[
                      ...(podeVirarVenda(o) && situacao !== "aprovado"
                        ? [{ label: "Virar venda", onClick: () => setVirando(o) }]
                        : []),
                      { label: "Copiar link", onClick: () => void copiar(o) },
                      ...(situacao === "enviado"
                        ? [{ label: "Mandar no WhatsApp", onClick: () => whatsapp(o) }]
                        : []),
                      {
                        label: "Ver como a cliente vê",
                        onClick: () =>
                          window.open(linkDoOrcamento(o.linkToken), "_blank", "noopener"),
                      },
                      {
                        label: "Duplicar e ajustar",
                        onClick: () => {
                          setBase(o);
                          onNovoAbertoChange(true);
                        },
                      },
                      ...(podeVirarVenda(o)
                        ? [{ label: "Cancelar orçamento", onClick: () => setCancelar(o) }]
                        : []),
                      { label: "Excluir", onClick: () => setExcluir(o), destrutivo: true },
                    ]}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {novoAberto && (
        <ModalOrcamento
          userId={userId}
          base={base ?? undefined}
          onClose={fecharModalOrcamento}
          onCriado={() => void recarregar()}
        />
      )}

      {virando && (
        <ModalRegistrarVenda
          userId={userId}
          prefill={{
            clienteId: virando.clienteId ?? undefined,
            clienteNome: virando.clienteNome ?? undefined,
            orcamentoId: virando.id,
            desconto: virando.desconto,
            frete: virando.frete,
            itens: virando.itens
              .filter((i) => i.produto_id)
              .map((i) => ({
                produtoId: i.produto_id!,
                skuId: i.sku_id,
                quantidade: i.quantidade,
                preco: i.preco_unitario,
              })),
          }}
          onClose={() => setVirando(null)}
          onSaved={() => {
            setVirando(null);
            track("orcamento_virou_venda");
            void recarregar();
            onVendaRegistrada();
          }}
        />
      )}

      <ConfirmarAcao
        open={!!cancelar}
        onOpenChange={(open) => !open && setCancelar(null)}
        titulo={`Cancelar o orçamento nº ${cancelar?.numero ?? ""}`}
        descricao="O link continua abrindo, mas mostra que o orçamento foi cancelado e não deixa aprovar."
        textoConfirmar="Cancelar orçamento"
        textoCancelar="Manter orçamento"
        destrutivo
        carregando={ocupado}
        textoCarregando="Cancelando…"
        onConfirmar={confirmarCancelar}
      />
      <ConfirmarAcao
        open={!!excluir}
        onOpenChange={(open) => !open && setExcluir(null)}
        titulo={`Excluir o orçamento nº ${excluir?.numero ?? ""}`}
        descricao="O link para de abrir. A venda que saiu dele, se saiu, continua em Vendas."
        textoConfirmar="Excluir"
        textoCancelar="Manter"
        destrutivo
        carregando={ocupado}
        textoCarregando="Excluindo…"
        onConfirmar={confirmarExcluir}
      />
    </div>
  );
}
