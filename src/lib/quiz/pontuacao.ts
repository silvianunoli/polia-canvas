// Régua de pontuação do quiz (PRD-quiz.md §5). Lógica pura: sem React, sem
// Supabase. Roda igual no cliente (pra mostrar a faixa antes do gate) e no
// servidor (pra gravar faixa/território/pontos sem confiar no que o cliente
// mandou).

import {
  FAIXAS,
  PERGUNTAS,
  TERRITORIOS,
  type AlternativaId,
  type Faixa,
  type Territorio,
  type TerritorioId,
} from "./perguntas";

/** As escolhas: { q1: "a", q2: "c", ... }. */
export type RespostasQuiz = Record<string, AlternativaId>;

export interface ResultadoQuiz {
  pontos: number;
  faixa: Faixa;
  territorioFraco: Territorio;
}

const PERGUNTA_POR_ID = new Map(PERGUNTAS.map((p) => [p.id, p]));

function pontosDa(perguntaId: string, escolha: AlternativaId | undefined): number | null {
  const pergunta = PERGUNTA_POR_ID.get(perguntaId);
  if (!pergunta || !escolha) return null;
  return pergunta.alternativas.find((a) => a.id === escolha)?.pontos ?? null;
}

/** Só é resultado válido com as 8 respondidas e todas as escolhas existindo no
 *  questionário. Resposta parcial ou id forjado devolve `false`. */
export function respostasCompletas(respostas: RespostasQuiz): boolean {
  return PERGUNTAS.every((p) => pontosDa(p.id, respostas[p.id]) !== null);
}

/** Soma das 8 perguntas: 0 a 16. Pergunta não respondida vale 0. */
export function somarPontos(respostas: RespostasQuiz): number {
  return PERGUNTAS.reduce((total, p) => total + (pontosDa(p.id, respostas[p.id]) ?? 0), 0);
}

/** FAIXAS está da maior pra menor, então a primeira que couber é a certa. */
export function faixaPorPontos(pontos: number): Faixa {
  return FAIXAS.find((f) => pontos >= f.min) ?? FAIXAS[FAIXAS.length - 1];
}

/** Território mais fraco: a menor pontuação entre as perguntas 1 a 6 (as de
 *  comportamento não entram). Empate resolve pela ordem dos módulos, que é a
 *  ordem do array TERRITORIOS: o primeiro empatado ganha. */
export function territorioMaisFraco(respostas: RespostasQuiz): Territorio {
  const pontosPorTerritorio = new Map<TerritorioId, number>();
  for (const pergunta of PERGUNTAS) {
    if (!pergunta.territorio) continue;
    pontosPorTerritorio.set(
      pergunta.territorio,
      pontosDa(pergunta.id, respostas[pergunta.id]) ?? 0,
    );
  }

  let escolhido: Territorio = TERRITORIOS[0];
  let menor = Number.POSITIVE_INFINITY;
  // Percorre na ordem dos módulos e só troca com "menor que", nunca com
  // "menor ou igual": assim o empate fica com quem veio primeiro.
  for (const territorio of TERRITORIOS) {
    const pontos = pontosPorTerritorio.get(territorio.id) ?? 0;
    if (pontos < menor) {
      menor = pontos;
      escolhido = territorio;
    }
  }
  return escolhido;
}

export function calcularResultado(respostas: RespostasQuiz): ResultadoQuiz {
  const pontos = somarPontos(respostas);
  return {
    pontos,
    faixa: faixaPorPontos(pontos),
    territorioFraco: territorioMaisFraco(respostas),
  };
}

/** Descarta o que não for pergunta conhecida com alternativa conhecida. Usado
 *  antes de gravar: o payload vem do navegador, não é confiável. */
export function sanitizarRespostas(brutas: Record<string, unknown>): RespostasQuiz {
  const limpo: RespostasQuiz = {};
  for (const pergunta of PERGUNTAS) {
    const valor = brutas[pergunta.id];
    if (typeof valor !== "string") continue;
    const alternativa = pergunta.alternativas.find((a) => a.id === valor);
    if (alternativa) limpo[pergunta.id] = alternativa.id;
  }
  return limpo;
}
