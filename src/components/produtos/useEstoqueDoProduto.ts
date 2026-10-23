// Estado e gravação da seção Estoque do modal de produto (VND-03). Separado do
// componente pra o Fast Refresh do Vite funcionar (arquivo de componente só
// exporta componente).

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { salvarEstoqueDoProduto } from "@/components/vendas/dados";

export interface VariacaoEditavel {
  chave: string;
  /** Presente quando a variação já existe no banco. */
  id?: string;
  variacao: string;
  sku: string;
  minimo: string;
  /** Só pra variação nova: vira um movimento de entrada. */
  inicial: string;
  saldo?: number;
}

export interface EstadoEstoque {
  controla: boolean;
  temVariacoes: boolean;
  padrao: VariacaoEditavel;
  variacoes: VariacaoEditavel[];
}

type SkuBanco = {
  id: string;
  variacao: string | null;
  sku: string | null;
  estoque_minimo: number;
  saldo: number;
};

let contador = 0;
const novaChave = () => `nova-${++contador}`;
export const vazia = (): VariacaoEditavel => ({
  chave: novaChave(),
  variacao: "",
  sku: "",
  minimo: "",
  inicial: "",
});

const inteiro = (s: string) => {
  const v = Number(s);
  return Number.isInteger(v) && v >= 0 ? v : 0;
};

function estadoDoBanco(controla: boolean, skus: SkuBanco[]): EstadoEstoque {
  const doBanco = (s: SkuBanco): VariacaoEditavel => ({
    chave: s.id,
    id: s.id,
    variacao: s.variacao ?? "",
    sku: s.sku ?? "",
    minimo: String(s.estoque_minimo ?? 0),
    inicial: "",
    saldo: Number(s.saldo ?? 0),
  });
  const padrao = skus.find((s) => s.variacao == null);
  const nomeadas = skus.filter((s) => s.variacao != null);
  return {
    controla,
    temVariacoes: nomeadas.length > 0,
    padrao: padrao ? doBanco(padrao) : vazia(),
    variacoes: nomeadas.length > 0 ? nomeadas.map(doBanco) : [vazia()],
  };
}

/** Estado da seção + o que gravar depois de o produto ser salvo. */
export function useEstoqueDoProduto(produtoId: string | null, controlaInicial: boolean) {
  const skusQuery = useQuery({
    queryKey: ["produto-skus", produtoId],
    enabled: !!produtoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_saldos")
        .select("sku_id, variacao, sku, estoque_minimo, saldo")
        .eq("produto_id", produtoId!);
      if (error) throw error;
      return (data ?? []).map((s) => ({
        id: s.sku_id!,
        variacao: s.variacao,
        sku: s.sku,
        estoque_minimo: Number(s.estoque_minimo ?? 0),
        saldo: Number(s.saldo ?? 0),
      }));
    },
  });

  const [estado, setEstado] = useState<EstadoEstoque>(() => estadoDoBanco(controlaInicial, []));
  const [pronto, setPronto] = useState(!produtoId);

  useEffect(() => {
    if (pronto || !skusQuery.data) return;
    setEstado(estadoDoBanco(controlaInicial, skusQuery.data));
    setPronto(true);
  }, [pronto, skusQuery.data, controlaInicial]);

  /**
   * Grava o estoque numa transação só (RPC salvar_estoque_produto), depois de
   * o produto existir. Variação removida vira arquivada no banco.
   */
  const salvar = async (idDoProduto: string): Promise<string | null> => {
    const alvo = estado.temVariacoes
      ? estado.variacoes.filter((v) => v.id || v.variacao.trim())
      : [{ ...estado.padrao, variacao: "" }];

    if (estado.controla && estado.temVariacoes) {
      const nomes = alvo.map((v) => v.variacao.trim().toLocaleLowerCase("pt-BR"));
      if (nomes.length === 0) return "Cadastre pelo menos uma variação.";
      if (nomes.some((nome) => !nome)) return "Dê um nome pra cada variação.";
      if (new Set(nomes).size !== nomes.length) return "Tem duas variações com o mesmo nome.";
    }

    const { error } = await salvarEstoqueDoProduto(
      idDoProduto,
      estado.controla,
      estado.controla
        ? alvo.map((v) => ({
            id: v.id ?? null,
            variacao: estado.temVariacoes ? v.variacao.trim() : null,
            sku: v.sku.trim() || null,
            minimo: inteiro(v.minimo),
            inicial: v.id ? 0 : inteiro(v.inicial),
          }))
        : [],
    );
    if (error) {
      console.error("estoque_salvar", error);
      return mensagemDeErro(error);
    }
    return null;
  };

  return { estado, setEstado, carregando: !!produtoId && !pronto, salvar };
}

function mensagemDeErro(error: { code?: string } | null) {
  if (error?.code === "23505") return "Esse nome de variação ou código já está em uso.";
  return "A Pólia One não conseguiu salvar o estoque. Tenta de novo.";
}
