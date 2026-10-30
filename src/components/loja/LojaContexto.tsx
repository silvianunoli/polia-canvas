import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { mensagemDoPedido, type LojaPublica, type ProdutoLoja, type VariacaoLoja } from "@/lib/loja";
import {
  DADOS_VAZIOS,
  adicionarItem,
  assinaturaDoPedido,
  chaveCarrinho,
  chaveEnvio,
  enderecoEmLinha,
  gerarIdPedido,
  idDoPedido,
  itensDaMensagem,
  limparCarrinho,
  linhasDoCarrinho,
  mascararWhatsapp,
  mudarQuantidade,
  primeiroNome,
  resumoDoCarrinho,
  type DadosCheckout,
  type ItemCarrinho,
  type LinhaCarrinho,
  type ResumoCarrinho,
} from "@/lib/lojaVitrine";

// Estado da vitrine que vive entre a página da loja e a do produto: o
// carrinho (guardado no aparelho em loja-carrinho-<endereço>), os dados do
// checkout (só em memória, nunca no aparelho), a janela do carrinho e o aviso.

function lerJson(chave: string): unknown {
  try {
    const s = window.localStorage.getItem(chave);
    return s ? (JSON.parse(s) as unknown) : null;
  } catch {
    return null;
  }
}
function gravarJson(chave: string, valor: unknown) {
  try {
    if (valor === null) window.localStorage.removeItem(chave);
    else window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* navegador sem localStorage (aba anônima, bloqueio): o carrinho vive só na memória */
  }
}

export interface PedidoConcluido {
  primeiroNome: string;
  mensagem: string;
}

interface ContextoLoja {
  loja: LojaPublica;
  itens: ItemCarrinho[];
  linhas: LinhaCarrinho[];
  resumo: ResumoCarrinho;
  adicionar: (produto: ProdutoLoja, variacao: VariacaoLoja | null) => void;
  mudar: (indice: number, quantidade: number) => void;
  aberto: boolean;
  abrirCarrinho: () => void;
  fecharCarrinho: () => void;
  aviso: string | null;
  avisar: (texto: string) => void;
  dados: DadosCheckout;
  mudarDados: (parcial: Partial<DadosCheckout>) => void;
  /** Id estável do pedido: o mesmo enquanto o corpo não muda (toque duplo não duplica). */
  idDoEnvio: (corpo: unknown) => string;
  concluido: PedidoConcluido | null;
  concluir: () => void;
  novoPedido: () => void;
}

const Contexto = createContext<ContextoLoja | null>(null);

export function useLojaVitrine(): ContextoLoja {
  const c = useContext(Contexto);
  if (!c) throw new Error("useLojaVitrine fora do LojaVitrineProvider");
  return c;
}

export function LojaVitrineProvider({ loja, children }: { loja: LojaPublica; children: ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosCheckout>(DADOS_VAZIOS);
  const [concluido, setConcluido] = useState<PedidoConcluido | null>(null);
  const envioRef = useRef<{ assinatura: string; id: string } | null>(null);
  const timerAviso = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lê o carrinho guardado depois de montar (no servidor não existe
  // localStorage) e limpa contra a loja de agora. Roda de novo quando a loja
  // recarrega (produto saiu, variação mudou).
  const leuGuardado = useRef(false);
  useEffect(() => {
    const primeira = !leuGuardado.current;
    leuGuardado.current = true;
    setItens((atuais) => limparCarrinho(primeira ? lerJson(chaveCarrinho(loja.slug)) : atuais, loja.produtos));
    setCarregado(true);
  }, [loja.slug, loja.produtos]);

  useEffect(() => {
    if (carregado) gravarJson(chaveCarrinho(loja.slug), itens.length ? itens : null);
  }, [carregado, itens, loja.slug]);

  useEffect(
    () => () => {
      if (timerAviso.current) clearTimeout(timerAviso.current);
    },
    [],
  );

  const avisar = useCallback((texto: string) => {
    setAviso(texto);
    if (timerAviso.current) clearTimeout(timerAviso.current);
    timerAviso.current = setTimeout(() => setAviso(null), 2600);
  }, []);

  const adicionar = useCallback(
    (produto: ProdutoLoja, variacao: VariacaoLoja | null) => {
      setItens((atuais) =>
        adicionarItem(atuais, {
          produtoId: produto.id,
          skuId: variacao?.id ?? null,
          variacaoNome: variacao?.nome ?? null,
        }),
      );
      // Pedido novo depois de um concluído: o carrinho volta pra tela de compra.
      setConcluido(null);
      avisar(`${produto.nome}${variacao ? `, ${variacao.nome},` : ""} foi pro carrinho.`);
    },
    [avisar],
  );

  const mudar = useCallback((indice: number, quantidade: number) => {
    setItens((atuais) => mudarQuantidade(atuais, indice, quantidade));
  }, []);

  const mudarDados = useCallback((parcial: Partial<DadosCheckout>) => {
    setDados((d) => ({ ...d, ...parcial }));
  }, []);

  const idDoEnvio = useCallback(
    (corpo: unknown) => {
      const guardado = lerJson(chaveEnvio(loja.slug)) as { assinatura?: unknown; id?: unknown } | null;
      const anterior =
        guardado && typeof guardado.assinatura === "string" && typeof guardado.id === "string"
          ? { assinatura: guardado.assinatura, id: guardado.id }
          : envioRef.current;
      const envio = idDoPedido(anterior, assinaturaDoPedido(corpo), gerarIdPedido);
      envioRef.current = envio;
      gravarJson(chaveEnvio(loja.slug), envio);
      return envio.id;
    },
    [loja.slug],
  );

  const linhas = useMemo(() => linhasDoCarrinho(itens, loja.produtos), [itens, loja.produtos]);
  const resumo = useMemo(() => resumoDoCarrinho(linhas, loja.sinalPercentual), [linhas, loja.sinalPercentual]);

  // Pedido salvo: monta a mensagem do WhatsApp com o que foi enviado e esvazia
  // o carrinho na hora, pra um item novo não levar os antigos junto num
  // segundo pedido. Nome, WhatsApp e endereço ficam no formulário (memória).
  const concluir = useCallback(() => {
    const mensagem = mensagemDoPedido(loja, itensDaMensagem(linhas), {
      nome: dados.nome.trim(),
      whatsapp: mascararWhatsapp(dados.whatsapp),
      endereco: enderecoEmLinha(dados, loja.pedeEndereco),
      presentePara: dados.presente && dados.presentePara.trim() ? dados.presentePara.trim() : undefined,
      observacao: dados.observacao.trim() || undefined,
    });
    setConcluido({ primeiroNome: primeiroNome(dados.nome), mensagem });
    setItens([]);
    setDados((d) => ({ ...d, observacao: "", presente: false, presentePara: "" }));
    envioRef.current = null;
    gravarJson(chaveEnvio(loja.slug), null);
  }, [dados, linhas, loja]);

  const novoPedido = useCallback(() => {
    setConcluido(null);
    setItens([]);
    setAberto(false);
  }, []);

  const valor = useMemo<ContextoLoja>(
    () => ({
      loja,
      itens,
      linhas,
      resumo,
      adicionar,
      mudar,
      aberto,
      abrirCarrinho: () => setAberto(true),
      fecharCarrinho: () => setAberto(false),
      aviso,
      avisar,
      dados,
      mudarDados,
      idDoEnvio,
      concluido,
      concluir,
      novoPedido,
    }),
    [loja, itens, linhas, resumo, adicionar, mudar, aberto, aviso, avisar, dados, mudarDados, idDoEnvio, concluido, concluir, novoPedido],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
