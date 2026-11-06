// Estado e gravação da seção "Na loja" da janela de produto (ONE-181). Só liga
// em conta com loja de marca (linha em lojas_marca); nas outras, a janela segue
// com a seção Estoque de sempre.

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { problemaDaFoto } from "@/components/catalogo/dados";
import { supabase } from "@/integrations/supabase/client";
import {
  atualizarCombinacoes,
  corpoParaSalvar,
  estadoDoBanco,
  novoEixo,
  problemaDasCombinacoes,
  slugDaCategoria,
  type CombinacaoEditavel,
  type EixoEditavel,
  type SkuDoBanco,
} from "@/lib/lojaCombinacoes";

const BUCKET = "produtos-fotos";
export const urlDaFotoVariacao = (path: string) =>
  supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

export interface CategoriaDaLoja {
  id: string;
  nome: string;
}

interface DadosDoProduto {
  categoria_id: string | null;
  prazo_dias_uteis: number | null;
  eixos_variacao: unknown;
}

export function useLojaDoProduto(
  userId: string,
  produtoId: string | null,
  controlaInicial: boolean,
) {
  const qc = useQueryClient();

  // Sem a tabela ou sem a linha, é conta sem loja: a seção não aparece.
  const lojaQuery = useQuery({
    queryKey: ["loja-marca-existe", userId],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("lojas_marca" as never)
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      return !error && (data as unknown) != null;
    },
  });
  const temLoja = lojaQuery.data === true;

  const categoriasQuery = useQuery({
    queryKey: ["produto-categorias", userId],
    enabled: temLoja,
    queryFn: async (): Promise<CategoriaDaLoja[]> => {
      const { data, error } = await supabase
        .from("produto_categorias" as never)
        .select("id, nome")
        .eq("user_id", userId)
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as CategoriaDaLoja[];
    },
  });

  const dadosQuery = useQuery({
    queryKey: ["produto-na-loja", produtoId],
    enabled: temLoja && !!produtoId,
    queryFn: async () => {
      const [{ data: produto, error: e1 }, { data: skus, error: e2 }, { data: saldos, error: e3 }] =
        await Promise.all([
          supabase
            .from("produtos")
            .select("categoria_id, prazo_dias_uteis, eixos_variacao")
            .eq("id", produtoId!)
            .single(),
          supabase
            .from("produto_skus")
            .select("id, variacao, opcoes, preco_venda, foto_path")
            .eq("produto_id", produtoId!)
            .eq("arquivado", false)
            .not("variacao", "is", null)
            .order("created_at"),
          supabase
            .from("estoque_saldos")
            .select("sku_id, variacao, saldo")
            .eq("produto_id", produtoId!),
        ]);
      if (e1 || e2 || e3) throw e1 ?? e2 ?? e3;
      const saldoPor = new Map((saldos ?? []).map((s) => [s.sku_id, Number(s.saldo ?? 0)]));
      return {
        produto: produto as unknown as DadosDoProduto,
        skus: ((skus ?? []) as unknown as Array<Omit<SkuDoBanco, "saldo">>).map((s) => ({
          ...s,
          saldo: saldoPor.get(s.id) ?? 0,
        })),
        saldoPadrao: (saldos ?? []).find((s) => s.variacao == null)?.saldo ?? null,
      };
    },
  });

  const [controla, setControla] = useState(controlaInicial);
  const [categoriaId, setCategoriaId] = useState("");
  const [prazo, setPrazo] = useState("");
  const [eixos, setEixos] = useState<EixoEditavel[]>([]);
  const [combinacoes, setCombinacoes] = useState<CombinacaoEditavel[]>([]);
  const [inicialPadrao, setInicialPadrao] = useState("");
  const [originais, setOriginais] = useState<CombinacaoEditavel[]>([]);
  const [pronto, setPronto] = useState(!produtoId);

  useEffect(() => {
    if (pronto || !dadosQuery.data) return;
    const { produto, skus } = dadosQuery.data;
    const inicial = estadoDoBanco(produto.eixos_variacao, skus);
    setCategoriaId(produto.categoria_id ?? "");
    setPrazo(produto.prazo_dias_uteis == null ? "" : String(produto.prazo_dias_uteis));
    setEixos(inicial.eixos);
    setCombinacoes(inicial.combinacoes);
    setOriginais(inicial.combinacoes);
    setPronto(true);
  }, [pronto, dadosQuery.data]);

  // Renomear um valor cria outra combinação: a antiga sai, e com ela o saldo.
  const saemComEstoque = originais
    .filter((o) => (o.saldo ?? 0) > 0 && !combinacoes.some((c) => c.id === o.id))
    .map((o) => o.nome);

  const mudarEixos = (novos: EixoEditavel[]) => {
    setEixos(novos);
    setCombinacoes((atuais) => atualizarCombinacoes(novos, atuais));
  };
  const mudarCombinacao = (chave: string, mudanca: Partial<CombinacaoEditavel>) =>
    setCombinacoes((atuais) => atuais.map((c) => (c.chave === chave ? { ...c, ...mudanca } : c)));

  /** Sobe a foto na hora, na pasta da dona. O caminho só vale pra loja depois de salvar. */
  const subirFoto = async (chave: string, arquivo: File): Promise<string | null> => {
    const problema = problemaDaFoto(arquivo);
    if (problema) return problema;
    const ext =
      arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg";
    const path = `${userId}/variacao-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, arquivo, { contentType: arquivo.type, upsert: false });
    if (error) return "A Pólia One não conseguiu subir a foto agora.";
    mudarCombinacao(chave, { fotoPath: path });
    return null;
  };

  /** Cria a categoria e já deixa escolhida. Devolve o motivo quando não dá. */
  const criarCategoria = async (nome: string): Promise<string | null> => {
    const limpo = nome.trim().slice(0, 60);
    const slug = slugDaCategoria(limpo);
    if (!limpo || !slug) return "Escreva um nome com letras ou números.";
    const { data, error } = await supabase
      .from("produto_categorias" as never)
      .insert({ user_id: userId, nome: limpo, slug } as never)
      .select("id")
      .single();
    if (error || !data) {
      if (error?.code === "23505") return "Já existe uma categoria com esse nome.";
      console.error("categoria_criar", error);
      return "A Pólia One não conseguiu criar a categoria. Tenta de novo.";
    }
    await qc.invalidateQueries({ queryKey: ["produto-categorias", userId] });
    setCategoriaId((data as unknown as { id: string }).id);
    return null;
  };

  const prazoNum = Number(prazo);
  const prazoValido =
    !prazo.trim() || (Number.isInteger(prazoNum) && prazoNum >= 1 && prazoNum <= 120);

  /** O motivo que impede salvar. Kit não tem combinações, só categoria e prazo. */
  const problemaPara = (ehKit: boolean): string | null => {
    if (!temLoja) return null;
    if (!prazoValido) return "O prazo vai de 1 a 120 dias úteis.";
    return ehKit ? null : problemaDasCombinacoes(eixos, combinacoes);
  };

  /** Grava depois de o produto existir. Kit só leva categoria e prazo. */
  const salvar = async (idDoProduto: string, ehKit: boolean): Promise<string | null> => {
    const { error: erroDados } = await supabase
      .from("produtos")
      .update({
        categoria_id: categoriaId || null,
        prazo_dias_uteis: prazo.trim() ? prazoNum : null,
      } as never)
      .eq("id", idDoProduto);
    if (erroDados) {
      console.error("loja_produto_salvar", erroDados);
      return "A Pólia One não conseguiu salvar os dados da loja. Tenta de novo.";
    }
    if (ehKit) return null;
    const { error } = await supabase.rpc(
      "salvar_combinacoes_loja" as never,
      {
        p_produto_id: idDoProduto,
        ...corpoParaSalvar(eixos, combinacoes, controla, inicialPadrao),
      } as never,
    );
    if (error) {
      console.error("loja_combinacoes_salvar", error);
      return error.code === "23505"
        ? "Tem duas combinações com o mesmo nome."
        : "A Pólia One não conseguiu salvar as combinações. Tenta de novo.";
    }
    return null;
  };

  return {
    temLoja,
    carregando: lojaQuery.isLoading || (temLoja && !!produtoId && !pronto && !dadosQuery.isError),
    erroAoCarregar: dadosQuery.isError,
    categorias: categoriasQuery.data ?? [],
    saldoPadrao: dadosQuery.data?.saldoPadrao ?? null,
    controla,
    setControla,
    categoriaId,
    setCategoriaId,
    prazo,
    setPrazo,
    eixos,
    combinacoes,
    inicialPadrao,
    setInicialPadrao,
    mudarEixos,
    novaOpcao: () => mudarEixos([...eixos, novoEixo()]),
    mudarCombinacao,
    subirFoto,
    criarCategoria,
    saemComEstoque,
    problemaPara,
    salvar,
  };
}

export type LojaDoProduto = ReturnType<typeof useLojaDoProduto>;
