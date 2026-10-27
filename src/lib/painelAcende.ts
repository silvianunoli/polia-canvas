// O Painel acende por partes (11/10/2026, ONE-112, aprovado pela Sil).
//
// Antes do Módulo 4 fechar, a manchete do Painel pedia "Registrar uma entrada"
// enquanto o tour apontava o Planejamento: dois recados na mesma tela. Agora,
// até a conta do mês existir, a manchete e a ação principal apontam o módulo
// em andamento; depois disso volta a manchete de dinheiro (COPY-04).
// A lista "Pra o Painel acender" mostra o que cada passo acende e some quando
// tudo está feito.

import { progressoPlanejamento } from "@/lib/lembretePlanejamento";
import { secoesDoModulo } from "@/lib/planejamento";

/** Módulo onde nasce a conta do mês (financeiro.meta_minima). */
export const MODULO_DA_CONTA = 4;

export type EstagioPainel =
  | { tipo: "planejamento"; modulo: number; nome: string; feitas: number; total: number }
  | { tipo: "numeros" };

/** Todas as seções do módulo concluídas. Mesma régua do bloco "Primeiros passos". */
export function moduloFechado(n: number, concluidas: ReadonlySet<string>): boolean {
  return secoesDoModulo(n).every((s) => concluidas.has(s.id));
}

/** Em que ponto o Painel está: ainda no Planejamento ou já nos números do mês. */
export function estagioPainel(concluidas: ReadonlySet<string>): EstagioPainel {
  if (moduloFechado(MODULO_DA_CONTA, concluidas)) return { tipo: "numeros" };
  const p = progressoPlanejamento(concluidas);
  // Sem progresso aberto e com o 4 em aberto não acontece (o 4 faz parte dos 6),
  // mas a tela não pode quebrar por isso: cai nos números.
  if (!p) return { tipo: "numeros" };
  return { tipo: "planejamento", ...p };
}

export interface ChamadaPlanejamento {
  manchete: string;
  acao: string;
  modulo: number;
}

/** Manchete e ação principal do Painel enquanto o Módulo 4 não fechou. */
export function chamadaDoPlanejamento(
  e: Extract<EstagioPainel, { tipo: "planejamento" }>,
): ChamadaPlanejamento {
  const faltam = e.total - e.feitas;
  const verbo = e.feitas === 0 ? "começar" : "continuar";
  if (e.modulo === MODULO_DA_CONTA) {
    return {
      manchete: "Falta a conta do mês pra o Painel mostrar quanto falta pra fechar as contas.",
      acao: e.feitas === 0 ? "Quero abrir o Módulo 4" : "Quero continuar o Módulo 4",
      modulo: e.modulo,
    };
  }
  if (e.modulo === 1) {
    return {
      manchete:
        e.feitas === 0
          ? `A marca ainda não contou quem ela é. São ${e.total} seções curtas.`
          : `O Módulo 1 já tem ${e.feitas} de ${e.total} seções. ${faltam === 1 ? "Falta 1" : `Faltam ${faltam}`} pra fechar a razão de existir da marca.`,
      acao: `Quero ${verbo} o Módulo 1`,
      modulo: 1,
    };
  }
  return {
    manchete: `O Planejamento está no Módulo ${e.modulo}, ${e.nome}. No Módulo 4, o Painel ganha a conta do mês.`,
    acao: `Quero ${verbo} o Módulo ${e.modulo}`,
    modulo: e.modulo,
  };
}

export interface ItemPraAcender {
  id: string;
  texto: string;
  /** O que esse passo acende. Vazio nos dois que já vêm feitos. */
  acende: string;
  feito: boolean;
}

/**
 * Lista "Pra o Painel acender". Os dois primeiros já vêm feitos: quem está no
 * Painel passou pelo cadastro (o guard garante) e tem um plano (o Grátis conta).
 * Começar em 2 de 6 é progresso real, não enfeite.
 */
export function itensPraAcender(
  concluidas: ReadonlySet<string>,
  temEntrada: boolean,
): ItemPraAcender[] {
  const todos = progressoPlanejamento(concluidas) === null;
  return [
    { id: "cadastro", texto: "Contar da marca no cadastro", acende: "", feito: true },
    { id: "plano", texto: "Escolher o plano", acende: "", feito: true },
    {
      id: "modulo-1",
      texto: "Fechar o Módulo 1",
      acende: "Vira a primeira parte do documento da marca",
      feito: moduloFechado(1, concluidas),
    },
    {
      id: "modulo-4",
      texto: "Fechar o Módulo 4",
      acende: "Acende quanto falta pra fechar as contas do mês",
      feito: moduloFechado(MODULO_DA_CONTA, concluidas),
    },
    {
      id: "entrada",
      texto: "Registrar a primeira entrada",
      acende: "Acende quanto lucrou este mês",
      feito: temEntrada,
    },
    {
      id: "completo",
      texto: "Fechar os 6 módulos",
      acende: "Planejamento completo, com Metas e Caderno",
      feito: todos,
    },
  ];
}
