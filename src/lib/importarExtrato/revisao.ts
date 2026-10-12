// O que a revisão mostra antes de importar: a categoria sugerida e quem já
// está no Financeiro. A Pólia sugere, ela confere: nada entra sem passar pela
// tela de revisão.

import { CATEGORIA_PRO_LABORE } from "@/lib/resumoContador.functions";
import { CATEGORIAS_DE_VENDA } from "@/lib/numerosDoMes";
import { centavos, normalizarDescricao, type LinhaImportada, type TipoLancamento } from "./comum";

export interface LancamentoExistente {
  data: string;
  valor: number;
  tipo: string;
  descricao?: string | null;
  categoria?: string | null;
}

// Palavras de extrato de banco brasileiro. Entrada só pra maquininha e
// marketplace: PIX recebido pode ser transferência entre contas dela, e
// chamar isso de venda inflaria os pedidos do mês.
const REGRAS: { tipo: TipoLancamento; padrao: RegExp; categoria: string }[] = [
  {
    tipo: "saida",
    padrao: /\bTARIFA\b|\bTAR\b|PACOTE DE SERVICOS|MENSALIDADE|ANUIDADE|\bIOF\b/,
    categoria: "Taxas fixas",
  },
  {
    tipo: "saida",
    padrao: /\bDAS\b|SIMPLES NACIONAL|\bDARF\b|\bINSS\b|CONTABIL|CONTADOR/,
    categoria: "Contador e imposto fixo",
  },
  { tipo: "saida", padrao: /ALUGUEL|CONDOMINIO/, categoria: "Espaço (aluguel)" },
  {
    tipo: "saida",
    padrao:
      /\bENEL\b|\bLIGHT\b|CEMIG|COPEL|CELESC|COELBA|CPFL|ELETROPAULO|ENERGISA|EQUATORIAL|NEOENERGIA|SABESP|CEDAE|COPASA|SANEPAR|EMBASA|COMGAS|NATURGY|ENERGIA ELETRICA|CONTA DE LUZ|CONTA DE AGUA/,
    categoria: "Luz, água e gás",
  },
  {
    tipo: "saida",
    padrao: /\bVIVO\b|\bCLARO\b|\bTIM\b|TELEFONICA|INTERNET|TELEFONE/,
    categoria: "Internet e telefone",
  },
  {
    tipo: "saida",
    padrao:
      /CANVA|ADOBE|SHOPIFY|NUVEMSHOP|NUVEM SHOP|HOSTINGER|GODADDY|REGISTRO BR|GOOGLE WORKSPACE|GOOGLE GSUITE|MICROSOFT|NOTION|CAPCUT/,
    categoria: "Ferramentas e assinaturas",
  },
  {
    tipo: "saida",
    padrao: /FACEBK|FACEBOOK|META ADS|META PLATFORMS|GOOGLE ADS|GOOGLE ADWORDS|TIKTOK ADS/,
    categoria: "Marketing",
  },
  { tipo: "saida", padrao: /PRO LABORE|PROLABORE/, categoria: CATEGORIA_PRO_LABORE },
  {
    tipo: "entrada",
    padrao:
      /STONE|CIELO|\bREDE\b|GETNET|PAGSEGURO|PAGBANK|MERCADO ?PAGO|SUMUP|INFINITEPAY|SHOPEE|ELO SETE|ELO7|HOTMART|KIWIFY|EDUZZ/,
    categoria: CATEGORIAS_DE_VENDA[0],
  },
];

/** Primeiro o histórico dela (a mesma descrição já categorizada), depois as palavras de banco. */
export function criarSugestorDeCategoria(historico: LancamentoExistente[]) {
  const doHistorico = new Map<string, string>();
  // Histórico vem do mais novo pro mais antigo: a primeira categoria vista vence.
  for (const l of historico) {
    if (!l.categoria || !l.descricao) continue;
    const chave = `${l.tipo}|${normalizarDescricao(l.descricao)}`;
    if (!doHistorico.has(chave)) doHistorico.set(chave, l.categoria);
  }
  return (descricao: string, tipo: TipoLancamento): string | null => {
    const nome = normalizarDescricao(descricao);
    const lembrada = doHistorico.get(`${tipo}|${nome}`);
    if (lembrada) return lembrada;
    return REGRAS.find((r) => r.tipo === tipo && r.padrao.test(nome))?.categoria ?? null;
  };
}

/**
 * true na linha que já está no Financeiro: mesmo dia, valor e sentido. Conta
 * por quantidade (dois cafés iguais no mesmo dia, um já lançado: só um é
 * repetido) e barra id externo repetido dentro do próprio arquivo.
 */
export function marcarRepetidos(
  linhas: LinhaImportada[],
  existentes: LancamentoExistente[],
): boolean[] {
  const restantes = new Map<string, number>();
  for (const e of existentes) {
    const chave = `${e.data}|${e.tipo}|${centavos(Number(e.valor))}`;
    restantes.set(chave, (restantes.get(chave) ?? 0) + 1);
  }
  const idsVistos = new Set<string>();
  return linhas.map((l) => {
    if (l.idExterno) {
      if (idsVistos.has(l.idExterno)) return true;
      idsVistos.add(l.idExterno);
    }
    const chave = `${l.data}|${l.tipo}|${centavos(l.valor)}`;
    const n = restantes.get(chave) ?? 0;
    if (n > 0) {
      restantes.set(chave, n - 1);
      return true;
    }
    return false;
  });
}
