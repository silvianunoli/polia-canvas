import { useEffect, useMemo, useState } from "react";
import { custoDoKit, kitsQueDaPraMontar, validarKit, type ComponenteKit } from "@/lib/kits";
import { salvarKit, useProdutosComEstoque, type ProdutoVendavel } from "@/components/vendas/dados";

export interface EstadoKit {
  ehKit: boolean;
  componentes: ComponenteKit[];
}

export const variacoesNomeadas = (p: ProdutoVendavel | undefined) =>
  (p?.skus ?? []).filter((s) => s.variacao != null);

/**
 * Estado e gravação do kit de um produto (ONE-132), no padrão de
 * useEstoqueDoProduto: o modal do produto salva o produto e depois chama
 * `salvar(id)`. Kit desligado num produto que era kit desfaz o kit.
 */
export function useKitDoProduto(userId: string, produtoId: string | null) {
  const query = useProdutosComEstoque(userId);
  const [estado, setEstado] = useState<EstadoKit>({ ehKit: false, componentes: [] });
  // A caixa só libera depois que o catálogo chega: antes, a leitura podia
  // chegar e desmarcar o que ela tinha acabado de marcar.
  const [carregou, setCarregou] = useState(false);
  const atual = useMemo(() => query.data?.find((p) => p.id === produtoId), [query.data, produtoId]);
  const eraKit = !!atual?.componentes.length;

  useEffect(() => {
    if (carregou || !query.data) return;
    setEstado({ ehKit: !!atual?.componentes.length, componentes: atual?.componentes ?? [] });
    setCarregou(true);
  }, [query.data, atual, carregou]);

  const porId = useMemo(() => new Map((query.data ?? []).map((p) => [p.id, p])), [query.data]);
  const precisaVariacao = (id: string) => {
    const p = porId.get(id);
    return !!p?.controlaEstoque && variacoesNomeadas(p).length > 0;
  };
  // Linha sem produto escolhido não conta (é a linha em branco do "+ Adicionar").
  const preenchidos = estado.componentes.filter((c) => c.componenteId);
  const problema = estado.ehKit ? validarKit(preenchidos, precisaVariacao) : null;

  // Por que este produto não pode virar kit, quando não pode.
  const ehItemDeOutroKit = (query.data ?? []).some((p) =>
    p.componentes.some((c) => c.componenteId === produtoId),
  );
  const temVariacoesProprias = variacoesNomeadas(atual).length > 0;
  const bloqueio = !produtoId
    ? null
    : ehItemDeOutroKit
      ? "Este produto é item de outro kit, então não pode virar kit. Tire ele do outro kit antes."
      : temVariacoesProprias && !eraKit
        ? "Este produto tem variações, e kit não tem variação. Tire as variações na seção de estoque antes."
        : null;

  const nomeDe = (id: string) => porId.get(id)?.nome ?? "um item";
  const semVariacao = preenchidos.find((c) => !c.skuId && precisaVariacao(c.componenteId));
  const erro =
    problema === "vazio"
      ? "Escolha o primeiro item do kit pra salvar."
      : problema === "quantidade"
        ? "A quantidade de cada item vai de 1 a 1.000."
        : problema === "variacao" && semVariacao
          ? `Falta escolher a variação de ${nomeDe(semVariacao.componenteId)}.`
          : problema === "repetido"
            ? "O mesmo item apareceu duas vezes. Junte numa linha só."
            : null;

  const semCusto = preenchidos
    .filter((c) => porId.get(c.componenteId)?.precoCusto == null)
    .map((c) => nomeDe(c.componenteId));

  /**
   * null = deu certo (ou nada a fazer); texto = o que mostrar. `desfazer`
   * apaga os itens de um produto que era kit (ex.: virou serviço), mesmo com
   * a caixinha ainda marcada no estado.
   */
  const salvar = async (id: string, desfazer = false): Promise<string | null> => {
    const manterKit = estado.ehKit && !desfazer;
    if (!manterKit && !eraKit) return null;
    const { error } = await salvarKit(id, manterKit ? preenchidos : []);
    if (!error) return null;
    console.error("kit_salvar", error);
    const msg = error.message ?? "";
    if (msg.includes("dentro de outro kit"))
      return "Este produto é item de outro kit, então não pode virar kit. Tire ele do outro kit antes.";
    if (msg.includes("já é um kit"))
      return "Kit não entra dentro de outro kit. Tire o item que já é kit.";
    if (msg.startsWith("Escolha a variação")) return `${msg}.`;
    return "A Pólia One não conseguiu salvar os itens do kit. Tenta de novo.";
  };

  return {
    estado,
    setEstado,
    produtos: query.data ?? [],
    porId,
    preenchidos,
    precisaVariacao,
    carregou,
    erroLeitura: query.isError,
    tentarDeNovo: () => void query.refetch(),
    eraKit,
    bloqueio,
    /** "vazio" é orientação neutra; os outros são erro. */
    vazio: problema === "vazio",
    erro,
    /** Só sem erro: com quantidade apagada ou variação faltando, o número mente. */
    custo: problema ? null : custoDoKit(preenchidos, porId),
    montaveis: problema ? null : kitsQueDaPraMontar(preenchidos, porId),
    semCusto,
    salvar,
  };
}
