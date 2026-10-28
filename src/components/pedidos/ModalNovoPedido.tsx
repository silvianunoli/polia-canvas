import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { hojeISO, somarDias } from "@/lib/data.functions";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { toastSucesso } from "@/lib/toast";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { fmt, num } from "@/components/produtos/tipos";
import { totalDaVenda, validarVenda, type ErroVenda } from "@/lib/vendas";
import { ehErroDeTeto } from "@/lib/pedidos";
import { useProdutosComEstoque, type ProdutoVendavel } from "@/components/vendas/dados";
import { ItemDaVenda, type LinhaItem } from "@/components/vendas/ModalRegistrarVenda";
import { registrarPedido } from "./dados";

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[16px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none sm:text-[14px]";

const ERRO_TEXTO: Record<ErroVenda, string> = {
  sem_itens: "Escolha pelo menos um produto.",
  quantidade_invalida: "A quantidade precisa ser um número inteiro maior que zero.",
  preco_invalido: "Confira o preço dos itens.",
  valor_negativo: "O preço não pode ser negativo.",
  desconto_maior_que_venda: "Confira o preço dos itens.",
};

/** Mesma regra do modal de venda: kit não tem variação; o resto escolhe a nomeada, se houver. */
function precisaDeVariacao(p: ProdutoVendavel | undefined): boolean {
  if (!p || p.componentes.length) return false;
  return p.skus.some((s) => s.variacao != null);
}

/**
 * Novo pedido (GRW-93, wireframe em cinza em docs/plano-quadro-de-pedidos.md):
 * cliente, produto, quantidade, dia da entrega e "Já pagou?". Grava pela
 * registrar_pedido, que é a registrar_venda de sempre com andamento e entrega.
 */
export function ModalNovoPedido({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
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

  const [idPedido] = useState(() => crypto.randomUUID());
  const [clienteNome, setClienteNome] = useState("");
  const [entregaEm, setEntregaEm] = useState(() => somarDias(hojeISO(), 1));
  const [recebida, setRecebida] = useState(false);
  const [proximaChave, setProximaChave] = useState(2);
  const [itens, setItens] = useState<LinhaItem[]>([
    { chave: 1, produtoId: "", skuId: "", quantidade: "1", preco: "" },
  ]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [bateuNoTeto, setBateuNoTeto] = useState(false);
  const [tentouSalvar, setTentouSalvar] = useState(false);

  // Nome escolhido da lista vira vínculo; nome novo fica só como texto na venda.
  const clienteId = useMemo(() => {
    const alvo = clienteNome.trim().toLocaleLowerCase("pt-BR");
    if (!alvo) return null;
    const achadas = (clientesQuery.data ?? []).filter(
      (c) => c.nome.trim().toLocaleLowerCase("pt-BR") === alvo,
    );
    return achadas.length === 1 ? achadas[0].id : null;
  }, [clienteNome, clientesQuery.data]);

  const itensValidos = itens.filter((i) => i.produtoId);
  const valores = {
    itens: itensValidos.map((i) => ({
      quantidade: Number(i.quantidade),
      precoUnitario: num(i.preco),
    })),
    desconto: 0,
    frete: 0,
    taxaCanal: 0,
  };
  const erroValidacao =
    validarVenda(valores) ??
    (itensValidos.some((i) => i.preco.trim() === "") ? ("preco_invalido" as const) : null);
  const faltaVariacao = itensValidos.some(
    (i) => precisaDeVariacao(porId.get(i.produtoId)) && !i.skuId,
  );
  const semData = !entregaEm;
  const total = totalDaVenda(valores);

  const atualizarItem = (chave: number, mudanca: Partial<LinhaItem>) => {
    setItens((atual) =>
      atual.map((i) => {
        if (i.chave !== chave) return i;
        const novo = { ...i, ...mudanca };
        // Trocou o produto: variação zera e o preço vem do catálogo.
        if (mudanca.produtoId !== undefined && mudanca.produtoId !== i.produtoId) {
          const p = porId.get(mudanca.produtoId);
          novo.skuId = "";
          novo.preco = p && p.precoVenda > 0 ? String(p.precoVenda) : "";
        }
        return novo;
      }),
    );
  };

  const salvar = async () => {
    setTentouSalvar(true);
    if (erroValidacao || faltaVariacao || semData || salvando) return;
    setSalvando(true);
    setErro(null);
    const { error } = await registrarPedido({
      id: idPedido,
      entregaEm,
      clienteId,
      clienteNome: clienteNome.trim() || null,
      itens: itensValidos.map((i) => ({
        produtoId: i.produtoId,
        skuId: i.skuId || null,
        quantidade: Number(i.quantidade),
        precoUnitario: num(i.preco),
      })),
      recebida,
      observacao: null,
    });
    setSalvando(false);
    if (error) {
      console.error("pedido_registrar", error);
      if (ehErroDeTeto(error.message)) {
        setBateuNoTeto(true);
        return;
      }
      setErro(
        error.message?.startsWith("Escolha a variação")
          ? `${error.message}. Confira o estoque dele em Produtos.`
          : "A Pólia One não conseguiu anotar o pedido. Tenta de novo: se ele já tiver entrado, não duplica.",
      );
      return;
    }
    track("pedido_anotado", { itens: itensValidos.length, pago: recebida });
    void registrar("feature_completed", {
      feature: "pedidos",
      propriedades: { acao: "novo_pedido", pago: recebida },
    });
    toastSucesso(
      recebida ? "Pedido anotado e lançado no Financeiro." : "Pedido anotado em A fazer.",
    );
    onSaved();
  };

  const carregando = produtosQuery.isLoading;
  const catalogoVazio = produtosQuery.isSuccess && produtos.length === 0;

  return (
    <Modal
      open
      largura="larga"
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Novo pedido"
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando || carregando || catalogoVazio || bateuNoTeto}
            className={BTN_ACAO}
          >
            {salvando ? "Anotando..." : "Anotar pedido"}
          </button>
        </>
      }
    >
      {produtosQuery.isError ? (
        <p role="alert" className="text-[14px] text-[var(--danger)]">
          A Pólia One não conseguiu ler o catálogo agora. Fecha e abre de novo pra tentar.
        </p>
      ) : carregando ? (
        <p className="text-[14px] text-[var(--muted)]">Carregando o catálogo…</p>
      ) : catalogoVazio ? (
        <div className="space-y-3 text-[14px] text-[var(--ink-soft)]">
          <p>
            O pedido sai de um produto do catálogo, com o preço e o custo dele. O catálogo ainda
            está vazio.
          </p>
          <Link
            to="/calculadora"
            className="font-medium text-[var(--secondary-text)] no-underline hover:underline"
          >
            Calcular o preço do primeiro produto
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          <Campo label="Cliente" hint="Escolha da lista ou digite um nome novo.">
            <input
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value.slice(0, 120))}
              list="pedido-clientes"
              autoComplete="off"
              className={INPUT}
              placeholder="ex: Joana"
            />
          </Campo>
          <datalist id="pedido-clientes">
            {(clientesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.nome} />
            ))}
          </datalist>

          <div>
            <ul className="space-y-3">
              {itens.map((linha, indice) => (
                <ItemDaVenda
                  key={linha.chave}
                  indice={indice}
                  linha={linha}
                  produtos={produtos}
                  produto={porId.get(linha.produtoId)}
                  podeRemover={itens.length > 1}
                  mostrarErros={tentouSalvar}
                  onMudar={(m) => atualizarItem(linha.chave, m)}
                  onRemover={() =>
                    setItens((atual) => atual.filter((i) => i.chave !== linha.chave))
                  }
                />
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                setItens((atual) => [
                  ...atual,
                  { chave: proximaChave, produtoId: "", skuId: "", quantidade: "1", preco: "" },
                ]);
                setProximaChave((c) => c + 1);
              }}
              className={`${BTN_MIUDO} mt-3`}
            >
              + mais um produto
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="Entrega"
              error={tentouSalvar && semData ? "Escolha o dia da entrega." : undefined}
            >
              <input
                type="date"
                value={entregaEm}
                onChange={(e) => setEntregaEm(e.target.value)}
                className={INPUT}
              />
            </Campo>
            <fieldset>
              <legend className="mb-1.5 block text-[12px] font-medium text-[var(--ink-soft)]">
                Já pagou?
              </legend>
              <div className="flex flex-wrap gap-2">
                {[
                  { valor: true, rotulo: "Sim" },
                  { valor: false, rotulo: "Ainda não" },
                ].map((o) => (
                  <button
                    key={o.rotulo}
                    type="button"
                    aria-pressed={recebida === o.valor}
                    onClick={() => setRecebida(o.valor)}
                    className={`${BTN_MIUDO} min-h-11 ${recebida === o.valor ? "!bg-[var(--secondary)]" : "bg-white"}`}
                  >
                    {o.rotulo}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <p className="text-[14px] text-[var(--ink)]">
            Total do pedido: <b>{fmt(total)}</b>
            <span className="text-[var(--muted)]">
              {recebida ? " · entra no Financeiro agora" : " · fica a receber até a entrega"}
            </span>
          </p>

          {tentouSalvar && (erroValidacao || faltaVariacao) && (
            <p role="alert" className="text-[13px] text-[var(--danger)]">
              {erroValidacao ? ERRO_TEXTO[erroValidacao] : "Escolha a variação dos itens."}
            </p>
          )}
          {bateuNoTeto && (
            <div
              role="alert"
              className="rounded-lg bg-[var(--surface)] p-3 text-[14px] text-[var(--ink-soft)]"
            >
              No plano Grátis cabem 15 pedidos abertos ao mesmo tempo. Marque como entregue os que
              já saíram, ou assine o Premium pra deixar sem limite.{" "}
              <Link
                to="/assinar"
                search={{ plano: "controle" }}
                className="font-medium text-[var(--secondary-text)] no-underline hover:underline"
              >
                Assinar o Premium
              </Link>
            </div>
          )}
          {erro && (
            <p role="alert" className="text-[13px] text-[var(--danger)]">
              {erro}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
