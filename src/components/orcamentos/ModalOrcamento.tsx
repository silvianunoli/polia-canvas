import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { fmt, num } from "@/components/produtos/tipos";
import { hojeISO } from "@/lib/data.functions";
import { track } from "@/lib/analytics";
import { emNegociacao } from "@/lib/statusCliente";
import {
  VALIDADE_PADRAO_DIAS,
  mensagemWhatsApp,
  somarDias,
  totaisDoOrcamento,
  validarOrcamento,
  type ErroOrcamento,
  type ItemOrcamento,
  type Orcamento,
} from "@/lib/orcamentos";
import { useProdutosComEstoque, type ProdutoVendavel } from "@/components/vendas/dados";
import { ItemDaVenda, type LinhaItem } from "@/components/vendas/ModalRegistrarVenda";
import { criarOrcamento, linkDoOrcamento, useIdentidadeMarca } from "./dados";

/** Mesma regra do Registrar venda: produto com variação nomeada pede a escolha. */
const temVariacoes = (p: ProdutoVendavel | undefined) =>
  (p?.skus ?? []).some((s) => s.variacao != null);

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

const ERRO_TEXTO: Record<ErroOrcamento, string> = {
  sem_itens: "Escolha pelo menos um produto.",
  item_sem_produto: "Escolha o produto de cada item.",
  quantidade_invalida: "A quantidade precisa ser um número inteiro maior que zero.",
  preco_invalido: "Confira o preço dos itens.",
  desconto_maior: "O desconto ficou maior que o valor dos itens.",
  valor_negativo: "Desconto e frete não podem ser negativos.",
  validade_passada: "A validade precisa ser hoje ou depois.",
};

export interface PrefillOrcamento {
  clienteId: string;
  clienteNome: string;
  clienteContato?: string | null;
  /** Status atual da cliente: em negociação, vira "Orçamento enviado". */
  clienteStatus?: string | null;
}

/**
 * Monta o orçamento e entrega o link (ONE-129). Depois de salvar, o modal
 * vira a tela de envio: copiar, mandar no WhatsApp ou abrir a página.
 */
export function ModalOrcamento({
  userId,
  prefill,
  base,
  onClose,
  onCriado,
}: {
  userId: string;
  prefill?: PrefillOrcamento;
  /** "Duplicar e ajustar": começa com os itens e valores de outro orçamento. */
  base?: Orcamento;
  onClose: () => void;
  onCriado: () => void;
}) {
  const produtosQuery = useProdutosComEstoque(userId);
  const produtos = useMemo(() => produtosQuery.data ?? [], [produtosQuery.data]);
  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);
  const identidade = useIdentidadeMarca(userId);

  const clientesQuery = useQuery({
    queryKey: ["clientes-nomes", userId],
    enabled: !prefill,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome")
        .eq("user_id", userId)
        .order("nome", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const hoje = hojeISO();
  const [clienteNome, setClienteNome] = useState(prefill?.clienteNome ?? base?.clienteNome ?? "");
  const [itens, setItens] = useState<LinhaItem[]>(() =>
    base
      ? base.itens
          .filter((i) => i.produto_id)
          .map((i, idx) => ({
            chave: idx + 1,
            produtoId: i.produto_id!,
            skuId: i.sku_id ?? "",
            quantidade: String(i.quantidade),
            preco: String(i.preco_unitario),
          }))
      : [{ chave: 1, produtoId: "", skuId: "", quantidade: "1", preco: "" }],
  );
  const [proximaChave, setProximaChave] = useState(() => (base?.itens.length ?? 1) + 1);
  const [desconto, setDesconto] = useState(base?.desconto ? String(base.desconto) : "");
  const [frete, setFrete] = useState(base?.frete ? String(base.frete) : "");
  const [validade, setValidade] = useState(() => somarDias(hoje, VALIDADE_PADRAO_DIAS));
  const [observacao, setObservacao] = useState(base?.observacao ?? "");
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criado, setCriado] = useState<Orcamento | null>(null);

  const clienteId = useMemo(() => {
    if (prefill) return prefill.clienteId;
    if (base?.clienteId && clienteNome === base.clienteNome) return base.clienteId;
    const alvo = clienteNome.trim().toLocaleLowerCase("pt-BR");
    if (!alvo) return null;
    const achadas = (clientesQuery.data ?? []).filter(
      (c) => c.nome.trim().toLocaleLowerCase("pt-BR") === alvo,
    );
    return achadas.length === 1 ? achadas[0].id : null;
  }, [clienteNome, clientesQuery.data, prefill, base?.clienteId, base?.clienteNome]);

  const itensOrcamento: ItemOrcamento[] = itens
    .filter((i) => i.produtoId)
    .map((i) => {
      const p = porId.get(i.produtoId);
      const sku = p?.skus.find((s) => s.id === i.skuId);
      return {
        produto_id: i.produtoId,
        sku_id: i.skuId || null,
        produto_nome: p?.nome ?? "",
        variacao: sku?.variacao ?? null,
        quantidade: Number(i.quantidade),
        preco_unitario: Math.round(num(i.preco) * 100) / 100,
      };
    });
  const valores = {
    itens: itensOrcamento,
    desconto: num(desconto),
    frete: num(frete),
    validade,
  };
  const faltaVariacao = itens.some(
    (i) => i.produtoId && temVariacoes(porId.get(i.produtoId)) && !i.skuId,
  );
  const faltaPreco = itens.some((i) => i.produtoId && i.preco.trim() === "");
  const problema: ErroOrcamento | null = faltaPreco
    ? "preco_invalido"
    : validarOrcamento(valores, hoje);
  const { total } = totaisDoOrcamento(valores);

  const atualizarItem = (chave: number, mudanca: Partial<LinhaItem>) =>
    setItens((atual) =>
      atual.map((i) => {
        if (i.chave !== chave) return i;
        const novo = { ...i, ...mudanca };
        if (mudanca.produtoId !== undefined && mudanca.produtoId !== i.produtoId) {
          const p = porId.get(mudanca.produtoId);
          novo.skuId = "";
          novo.preco = p && p.precoVenda > 0 ? String(p.precoVenda) : "";
        }
        return novo;
      }),
    );

  const salvar = async () => {
    setTentou(true);
    if (problema || faltaVariacao) return;
    setSalvando(true);
    setErro(null);
    const { orcamento, error } = await criarOrcamento(userId, {
      clienteId,
      clienteNome: clienteNome.trim() || null,
      itens: itensOrcamento,
      desconto: valores.desconto,
      frete: valores.frete,
      validade,
      observacao: observacao.trim() || null,
    });
    if (error || !orcamento) {
      setSalvando(false);
      setErro("A Pólia One não conseguiu criar o orçamento. Tenta de novo.");
      return;
    }
    // Cliente ainda no começo da conversa passa pra "Orçamento enviado".
    if (prefill && (!prefill.clienteStatus || emNegociacao(prefill.clienteStatus))) {
      await supabase
        .from("clientes")
        .update({ status_pedido: "Orçamento enviado", updated_at: new Date().toISOString() })
        .eq("id", prefill.clienteId);
    }
    setSalvando(false);
    track("orcamento_criado", { itens: itensOrcamento.length, com_cliente: !!clienteId });
    setCriado(orcamento);
    onCriado();
  };

  if (criado) {
    return (
      <EnvioDoOrcamento
        orcamento={criado}
        marca={identidade.data?.nome || null}
        contato={prefill?.clienteContato ?? null}
        semIdentidade={identidade.isSuccess && !identidade.data.logoUrl && !identidade.data.cor}
        onClose={onClose}
      />
    );
  }

  const carregando = produtosQuery.isLoading;
  const semProdutos = !carregando && !produtosQuery.isError && produtos.length === 0;

  return (
    <Modal
      open
      largura="larga"
      onOpenChange={(next) => !next && onClose()}
      title={prefill ? `Orçamento pra ${prefill.clienteNome}` : "Novo orçamento"}
      description="A cliente recebe um link com os itens, o total e um botão pra aprovar."
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || carregando || semProdutos}
            className={BTN_ACAO}
          >
            {salvando ? "Criando…" : "Criar orçamento e gerar link"}
          </button>
        </>
      }
    >
      {produtosQuery.isError ? (
        <p role="alert" className="text-[14px] text-[var(--danger)]">
          A Pólia One não conseguiu ler os seus produtos agora. Fecha e abre de novo.
        </p>
      ) : carregando ? (
        <p className="text-[14px] text-[var(--muted)]">Carregando seus produtos…</p>
      ) : semProdutos ? (
        <p className="text-[14px] text-[var(--ink-soft)]">
          O orçamento sai dos produtos do catálogo. Cadastre o primeiro e volte aqui.{" "}
          <Link
            to="/produtos"
            className="inline-flex min-h-11 items-center font-medium text-[var(--secondary-text)] hover:underline"
          >
            Ir para Produtos
          </Link>
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo
              label="Pra quem"
              hint={
                prefill
                  ? "vinda de Clientes"
                  : clienteNome.trim() && !clienteId
                    ? "Fica só o nome. Pra ligar a uma ficha, escolha da lista."
                    : "opcional, aparece no orçamento"
              }
            >
              <input
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
                readOnly={!!prefill}
                list={prefill ? undefined : "orcamento-clientes"}
                maxLength={120}
                className={INPUT}
                placeholder="Buscar em Clientes ou digitar"
              />
            </Campo>
            <datalist id="orcamento-clientes">
              {(clientesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.nome} />
              ))}
            </datalist>
            <Campo
              label="Vale até"
              required
              error={tentou && problema === "validade_passada" ? ERRO_TEXTO[problema] : undefined}
            >
              <input
                type="date"
                value={validade}
                min={hoje}
                onChange={(e) => setValidade(e.target.value)}
                className={INPUT}
              />
            </Campo>
          </div>

          <fieldset className="mt-6">
            <legend className="mb-2 text-[12px] text-[var(--muted)]">Itens</legend>
            <ul className="flex flex-col gap-3">
              {itens.map((i, idx) => (
                <ItemDaVenda
                  key={i.chave}
                  indice={idx}
                  linha={i}
                  produtos={produtos}
                  produto={porId.get(i.produtoId)}
                  podeRemover={itens.length > 1}
                  mostrarErros={tentou}
                  onMudar={(m) => atualizarItem(i.chave, m)}
                  onRemover={() => setItens((a) => a.filter((x) => x.chave !== i.chave))}
                />
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                setItens((a) => [
                  ...a,
                  { chave: proximaChave, produtoId: "", skuId: "", quantidade: "1", preco: "" },
                ]);
                setProximaChave((c) => c + 1);
              }}
              className={`${BTN_MIUDO} mt-3 bg-white`}
            >
              + Adicionar item
            </button>
          </fieldset>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Desconto (R$)">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                className={INPUT}
                placeholder="0"
              />
            </Campo>
            <Campo label="Frete (R$)">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={frete}
                onChange={(e) => setFrete(e.target.value)}
                className={INPUT}
                placeholder="0"
              />
            </Campo>
          </div>

          <div className="mt-4">
            <Campo
              label="Observação pra cliente"
              hint="prazo de produção, forma de pagamento, entrega"
            >
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                maxLength={1000}
                rows={3}
                className={INPUT}
              />
            </Campo>
          </div>

          <p className="mt-5 font-cabinet text-[22px] text-[var(--ink)]">Total {fmt(total)}</p>
          {tentou && (problema || faltaVariacao) && (
            <p role="alert" className="mt-2 text-[13px] text-[var(--danger)]">
              {faltaVariacao ? "Escolha a variação dos itens marcados." : ERRO_TEXTO[problema!]}
            </p>
          )}
          {erro && (
            <p role="alert" className="mt-2 text-[13px] text-[var(--danger)]">
              {erro}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}

/** Depois de criar: o link e os três jeitos de mandar. */
function EnvioDoOrcamento({
  orcamento,
  marca,
  contato,
  semIdentidade,
  onClose,
}: {
  orcamento: Orcamento;
  marca: string | null;
  contato: string | null;
  semIdentidade: boolean;
  onClose: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [falhouCopiar, setFalhouCopiar] = useState(false);
  const link = linkDoOrcamento(orcamento.linkToken);
  const texto = mensagemWhatsApp({
    marca,
    numero: orcamento.numero,
    clienteNome: orcamento.clienteNome,
    link,
  });
  // Contato da cliente com cara de telefone abre a conversa dela direto.
  const fone = (contato ?? "").replace(/\D/g, "");
  const foneWa = fone.length >= 10 ? (fone.startsWith("55") ? fone : `55${fone}`) : "";
  const urlWhats = `https://wa.me/${foneWa}?text=${encodeURIComponent(texto)}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      track("orcamento_link_copiado");
    } catch {
      setCopiado(false);
      setFalhouCopiar(true);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(n) => !n && onClose()}
      title={`Orçamento nº ${orcamento.numero} criado`}
      description={`Total ${fmt(orcamento.total)}, vale até ${orcamento.validade.split("-").reverse().join("/")}.`}
      footer={
        <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
          Fechar
        </button>
      }
    >
      <p className="text-[13px] text-[var(--muted)]">Link do orçamento</p>
      <p className="mt-1 break-all rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-[13px] text-[var(--ink)]">
        {link}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={urlWhats}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("orcamento_whatsapp")}
          className={BTN_ACAO}
        >
          <MessageCircle size={15} aria-hidden="true" />
          Mandar no WhatsApp
        </a>
        <button type="button" onClick={() => void copiar()} className={BTN_ACAO_CONTORNO}>
          {copiado ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          {copiado ? "Link copiado" : "Copiar link"}
        </button>
        <a href={link} target="_blank" rel="noopener noreferrer" className={BTN_ACAO_CONTORNO}>
          <ExternalLink size={15} aria-hidden="true" />
          Ver como a cliente vê
        </a>
      </div>
      <p role="status" className="sr-only">
        {copiado ? "Link copiado." : ""}
      </p>
      {falhouCopiar && (
        <p role="alert" className="mt-2 text-[13px] text-[var(--danger)]">
          O navegador não deixou copiar. Segure o dedo no link acima pra copiar.
        </p>
      )}
      {semIdentidade && (
        <p className="mt-4 text-[13px] text-[var(--ink-soft)]">
          O orçamento sai com o nome da marca. Pra ele levar o seu logo e a sua cor, coloque os dois
          em{" "}
          <Link to="/marca" className="font-medium text-[var(--secondary-text)] hover:underline">
            Marca
          </Link>
          .
        </p>
      )}
    </Modal>
  );
}
