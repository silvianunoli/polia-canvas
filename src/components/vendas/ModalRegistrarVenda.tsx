import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hojeISO } from "@/lib/data.functions";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { toastSucesso } from "@/lib/toast";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { fmt, num } from "@/components/produtos/tipos";
import {
  CANAIS_MANUAIS,
  CANAL_LABEL,
  lucroDaVenda,
  totalDaVenda,
  validarVenda,
  valorRecebidoDaVenda,
  type CanalVenda,
  type ErroVenda,
} from "@/lib/vendas";
import { registrarVenda, useProdutosComEstoque, type ProdutoVendavel } from "./dados";

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

const ERRO_TEXTO: Record<ErroVenda, string> = {
  sem_itens: "Escolha pelo menos um produto.",
  quantidade_invalida: "A quantidade precisa ser um número inteiro maior que zero.",
  preco_invalido: "Confira o preço dos itens.",
  valor_negativo: "Desconto, frete e taxa não podem ser negativos.",
  desconto_maior_que_venda: "O desconto ficou maior que o valor dos itens.",
};

interface LinhaItem {
  chave: number;
  produtoId: string;
  skuId: string;
  quantidade: string;
  preco: string;
}

export interface PrefillVenda {
  clienteId?: string;
  clienteNome?: string;
  produtoId?: string | null;
  valor?: number | null;
  /** Vindo de Clientes: a RPC marca a venda como registrada na cliente. */
  marcarCliente?: boolean;
}

/** Variações com nome; produto sem nenhuma vende pela variação padrão. */
function variacoesNomeadas(p: ProdutoVendavel | undefined) {
  return (p?.skus ?? []).filter((s) => s.variacao != null);
}

export function ModalRegistrarVenda({
  userId,
  prefill,
  onClose,
  onSaved,
}: {
  userId: string;
  prefill?: PrefillVenda;
  onClose: () => void;
  onSaved: () => void;
}) {
  const produtosQuery = useProdutosComEstoque(userId);
  const produtos = useMemo(() => produtosQuery.data ?? [], [produtosQuery.data]);
  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);

  const clientesQuery = useQuery({
    queryKey: ["clientes-nomes", userId],
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

  // Id da venda nasce com o modal: se a resposta se perder e ela tentar de novo,
  // o banco devolve a venda que já entrou em vez de duplicar.
  const [idVenda] = useState(() => crypto.randomUUID());
  const clienteTravada = !!prefill?.marcarCliente && !!prefill.clienteId;
  const [data, setData] = useState(hojeISO());
  const [canal, setCanal] = useState<CanalVenda>("instagram");
  const [clienteNome, setClienteNome] = useState(prefill?.clienteNome ?? "");
  const [proximaChave, setProximaChave] = useState(2);
  const [itens, setItens] = useState<LinhaItem[]>(() => [
    {
      chave: 1,
      produtoId: prefill?.produtoId ?? "",
      skuId: "",
      quantidade: "1",
      preco: prefill?.valor != null && prefill.valor > 0 ? String(prefill.valor) : "",
    },
  ]);
  const [desconto, setDesconto] = useState("");
  const [frete, setFrete] = useState("");
  const [taxa, setTaxa] = useState("");
  const [recebida, setRecebida] = useState(true);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tentouSalvar, setTentouSalvar] = useState(false);

  // Cliente escolhida da lista vira vínculo; nome digitado fica só como texto.
  const clienteId = useMemo(() => {
    if (clienteTravada) return prefill!.clienteId!;
    if (prefill?.clienteId && clienteNome === prefill.clienteNome) return prefill.clienteId;
    const alvo = clienteNome.trim().toLocaleLowerCase("pt-BR");
    if (!alvo) return null;
    const achadas = (clientesQuery.data ?? []).filter(
      (c) => c.nome.trim().toLocaleLowerCase("pt-BR") === alvo,
    );
    return achadas.length === 1 ? achadas[0].id : null;
  }, [clienteNome, clientesQuery.data, prefill, clienteTravada]);

  // Item que já veio com produto (de Clientes) e sem preço: o preço do
  // cadastro entra quando o catálogo chega.
  useEffect(() => {
    if (porId.size === 0) return;
    setItens((atual) =>
      atual.some((i) => i.produtoId && !i.preco && (porId.get(i.produtoId)?.precoVenda ?? 0) > 0)
        ? atual.map((i) => {
            const p = i.produtoId && !i.preco ? porId.get(i.produtoId) : undefined;
            return p && p.precoVenda > 0 ? { ...i, preco: String(p.precoVenda) } : i;
          })
        : atual,
    );
  }, [porId]);

  const itensValidos = itens.filter((i) => i.produtoId);
  const itensConta = itensValidos.map((i) => {
    const p = porId.get(i.produtoId);
    return {
      produtoId: i.produtoId,
      produtoNome: p?.nome ?? "",
      quantidade: Number(i.quantidade),
      precoUnitario: num(i.preco),
      custoUnitario: p?.precoCusto ?? null,
    };
  });
  const valores = {
    itens: itensConta,
    desconto: num(desconto),
    frete: num(frete),
    taxaCanal: num(taxa),
  };
  const erroValidacao =
    validarVenda(valores) ??
    (itensValidos.some((i) => i.preco.trim() === "") ? ("preco_invalido" as const) : null);
  const faltaVariacao = itensValidos.some(
    (i) => variacoesNomeadas(porId.get(i.produtoId)).length > 0 && !i.skuId,
  );
  const total = totalDaVenda(valores);
  const lucro = lucroDaVenda(valores);

  const atualizarItem = (chave: number, mudanca: Partial<LinhaItem>) => {
    setItens((atual) =>
      atual.map((i) => {
        if (i.chave !== chave) return i;
        const novo = { ...i, ...mudanca };
        // Trocou o produto: variação zera e o preço vem do cadastro.
        if (mudanca.produtoId !== undefined && mudanca.produtoId !== i.produtoId) {
          const p = porId.get(mudanca.produtoId);
          novo.skuId = "";
          novo.preco = p && p.precoVenda > 0 ? String(p.precoVenda) : "";
        }
        return novo;
      }),
    );
  };

  const adicionarItem = () => {
    setItens((atual) => [
      ...atual,
      { chave: proximaChave, produtoId: "", skuId: "", quantidade: "1", preco: "" },
    ]);
    setProximaChave((c) => c + 1);
  };

  const salvar = async () => {
    setTentouSalvar(true);
    if (erroValidacao || faltaVariacao) return;
    setSalvando(true);
    setErro(null);
    const { error } = await registrarVenda({
      id: idVenda,
      data,
      canal,
      clienteId,
      clienteNome: clienteNome.trim() || null,
      itens: itensValidos.map((i) => ({
        produtoId: i.produtoId,
        skuId: i.skuId || null,
        quantidade: Number(i.quantidade),
        precoUnitario: num(i.preco),
      })),
      desconto: valores.desconto,
      frete: valores.frete,
      taxaCanal: valores.taxaCanal,
      recebida,
      observacao: observacao.trim() || null,
      marcarCliente: prefill?.marcarCliente,
    });
    setSalvando(false);
    if (error) {
      console.error("venda_registrar", error);
      setErro(
        error.message?.includes("já registrada")
          ? "Essa venda já foi registrada pra essa cliente. Atualize a página."
          : error.message?.startsWith("Escolha a variação")
            ? `${error.message}. Confira o estoque dele em Produtos.`
            : "A Pólia One não conseguiu registrar a venda. Tenta de novo: se ela já tiver entrado, não duplica.",
      );
      return;
    }
    track("venda_registrada", {
      canal,
      itens: itensValidos.length,
      origem: prefill?.marcarCliente ? "clientes" : "vendas",
    });
    void registrar("feature_completed", {
      feature: "vendas",
      propriedades: { acao: "registrar_venda", canal },
    });
    toastSucesso(recebida ? "Venda registrada e lançada no Financeiro." : "Venda registrada.");
    onSaved();
  };

  const carregando = produtosQuery.isLoading;
  const semProdutos = !carregando && produtos.length === 0;

  return (
    <Modal
      open
      largura="larga"
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Registrar venda"
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
            {salvando ? "Registrando…" : "Registrar venda"}
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
          A venda sai de um produto do catálogo. Cadastre o primeiro e volte aqui.{" "}
          <Link
            to="/produtos"
            className="inline-flex min-h-11 items-center font-medium text-[var(--secondary-text)] hover:underline"
          >
            Ir para Produtos
          </Link>
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Campo label="Data" required>
              <input
                type="date"
                value={data}
                max={hojeISO()}
                onChange={(e) => setData(e.target.value)}
                className={INPUT}
              />
            </Campo>
            <Campo label="Por onde vendeu" required>
              <select
                value={canal}
                onChange={(e) => setCanal(e.target.value as CanalVenda)}
                className={INPUT}
              >
                {CANAIS_MANUAIS.map((c) => (
                  <option key={c} value={c}>
                    {CANAL_LABEL[c]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo
              label="Cliente"
              hint={
                clienteTravada
                  ? "vinda de Clientes"
                  : clienteNome.trim() && !clienteId
                    ? "Fica só o nome. Pra ligar a uma ficha, escolha da lista."
                    : "opcional"
              }
            >
              <input
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
                readOnly={clienteTravada}
                list={clienteTravada ? undefined : "venda-clientes"}
                maxLength={120}
                className={INPUT}
                placeholder="Buscar em Clientes ou digitar"
              />
            </Campo>
            <datalist id="venda-clientes">
              {(clientesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.nome} />
              ))}
            </datalist>
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
                  mostrarErros={tentouSalvar}
                  onMudar={(m) => atualizarItem(i.chave, m)}
                  onRemover={() => setItens((atual) => atual.filter((x) => x.chave !== i.chave))}
                />
              ))}
            </ul>
            <button type="button" onClick={adicionarItem} className={`${BTN_MIUDO} mt-3 bg-white`}>
              + Adicionar item
            </button>
          </fieldset>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            <Campo label="Frete cobrado (R$)">
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
            <Campo label="Taxa do canal ou maquininha (R$)">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={taxa}
                onChange={(e) => setTaxa(e.target.value)}
                className={INPUT}
                placeholder="0"
              />
            </Campo>
          </div>

          <label className="mt-5 flex min-h-11 cursor-pointer items-center gap-3 text-[14px] text-[var(--ink)]">
            <input
              type="checkbox"
              checked={recebida}
              onChange={(e) => setRecebida(e.target.checked)}
              className="h-4 w-4 accent-[var(--secondary-text)]"
            />
            Dinheiro já recebido
          </label>
          <p className="ml-7 text-[13px] text-[var(--muted)]">
            {recebida
              ? `Entra ${fmt(valorRecebidoDaVenda(valores))} no Financeiro na data da venda.`
              : "Entra no Financeiro quando a venda for marcada como recebida."}
          </p>

          <div className="mt-3">
            <Campo label="Observação">
              <input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                maxLength={500}
                className={INPUT}
                placeholder="ex: entregar sábado, embrulho de presente"
              />
            </Campo>
          </div>

          <div
            className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[14px] text-[var(--ink)]"
            aria-live="polite"
          >
            <p>
              Total {fmt(total)}
              {lucro == null ? (
                <span className="text-[var(--muted)]">
                  {" "}
                  · sem o custo de algum produto, a Pólia One não calcula o lucro
                </span>
              ) : lucro < 0 ? (
                <span className="text-[var(--danger)]">
                  {" "}
                  · essa venda dá prejuízo de {fmt(-lucro)}
                </span>
              ) : (
                <> · a marca lucra {fmt(lucro)}</>
              )}
            </p>
            <ResumoEstoque itens={itensValidos} porId={porId} />
          </div>

          {tentouSalvar && (erroValidacao || faltaVariacao) && (
            <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
              {erroValidacao ? ERRO_TEXTO[erroValidacao] : "Escolha a variação de cada item."}
            </p>
          )}
          {erro && (
            <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
              {erro}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}

function ItemDaVenda({
  indice,
  linha,
  produtos,
  produto,
  podeRemover,
  mostrarErros,
  onMudar,
  onRemover,
}: {
  indice: number;
  linha: LinhaItem;
  produtos: ProdutoVendavel[];
  produto: ProdutoVendavel | undefined;
  podeRemover: boolean;
  mostrarErros: boolean;
  onMudar: (m: Partial<LinhaItem>) => void;
  onRemover: () => void;
}) {
  const variacoes = variacoesNomeadas(produto);
  const skuEscolhido = produto?.skus.find((s) =>
    linha.skuId ? s.id === linha.skuId : variacoes.length === 0 && s.variacao == null,
  );
  const rotulo = `Item ${indice + 1}`;

  return (
    <li className="rounded-xl border border-[var(--line)] bg-white p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_88px_120px_44px] sm:items-end">
        <Campo label={`${rotulo}: produto`}>
          <select
            value={linha.produtoId}
            onChange={(e) => onMudar({ produtoId: e.target.value })}
            className={INPUT}
          >
            <option value="">Escolher produto</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </Campo>
        {variacoes.length > 0 ? (
          <Campo
            label="Variação"
            error={mostrarErros && !linha.skuId ? "Escolha a variação." : undefined}
          >
            <select
              value={linha.skuId}
              onChange={(e) => onMudar({ skuId: e.target.value })}
              className={INPUT}
            >
              <option value="">Escolher</option>
              {variacoes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.variacao}
                  {produto?.controlaEstoque ? ` (${s.saldo} no estoque)` : ""}
                </option>
              ))}
            </select>
          </Campo>
        ) : (
          <p className="pb-2 text-[13px] text-[var(--muted)]">
            {produto?.controlaEstoque && skuEscolhido
              ? `${skuEscolhido.saldo} no estoque`
              : produto
                ? "sem controle de estoque"
                : ""}
          </p>
        )}
        <Campo
          label="Qtd."
          error={
            mostrarErros &&
            linha.produtoId &&
            !(Number.isInteger(Number(linha.quantidade)) && Number(linha.quantidade) > 0)
              ? "Inteiro maior que zero."
              : undefined
          }
        >
          <input
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={linha.quantidade}
            onChange={(e) => onMudar({ quantidade: e.target.value })}
            className={INPUT}
          />
        </Campo>
        <Campo
          label="Preço (R$)"
          error={
            mostrarErros && linha.produtoId && (linha.preco.trim() === "" || num(linha.preco) < 0)
              ? "Coloque o preço."
              : undefined
          }
        >
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={linha.preco}
            onChange={(e) => onMudar({ preco: e.target.value })}
            className={INPUT}
            placeholder="0"
          />
        </Campo>
        <button
          type="button"
          onClick={onRemover}
          disabled={!podeRemover}
          aria-label={`Remover ${rotulo.toLowerCase()}`}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)] disabled:opacity-40"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

/** "O estoque da Caneca Lua azul vai de 14 para 12." Avisa quando fica negativo. */
function ResumoEstoque({
  itens,
  porId,
}: {
  itens: LinhaItem[];
  porId: Map<string, ProdutoVendavel>;
}) {
  const linhas = itens.flatMap((i) => {
    const p = porId.get(i.produtoId);
    if (!p?.controlaEstoque) return [];
    const variacoes = variacoesNomeadas(p);
    const sku = i.skuId
      ? p.skus.find((s) => s.id === i.skuId)
      : variacoes.length === 0
        ? p.skus.find((s) => s.variacao == null)
        : undefined;
    const qtd = Number(i.quantidade);
    if (!sku || !Number.isInteger(qtd) || qtd <= 0) return [];
    const nome = sku.variacao ? `${p.nome} ${sku.variacao}` : p.nome;
    return [{ chave: i.chave, nome, de: sku.saldo, para: sku.saldo - qtd }];
  });
  if (linhas.length === 0) return null;
  return (
    <ul className="mt-1 text-[13px] text-[var(--muted)]">
      {linhas.map((l) => (
        <li key={l.chave}>
          O estoque de {l.nome} vai de {l.de} para {l.para}.
          {l.para < 0 && (
            <span className="text-[var(--danger)]">
              {" "}
              Fica negativo, mas a venda entra mesmo assim.
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
