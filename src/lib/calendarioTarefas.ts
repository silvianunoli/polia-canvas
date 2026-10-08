/**
 * QA-34 (07/10/2026): tarefa do Planner aparece no Calendário do início ao prazo.
 *
 * Antes a grade só olhava o prazo, então uma tarefa de 01/10 a 20/10 sumia do
 * calendário nos 19 dias em que estava sendo feita. Repetir o chip em todos os
 * dias do intervalo, por outro lado, entope a grade: o Planner grava
 * data_inicio = hoje por padrão, então quase toda tarefa vira um intervalo.
 *
 * Decisão de leitura:
 *  - Na GRADE, a tarefa aparece em dois pontos: no dia em que começa (com
 *    "até dd/mm") e no dia do prazo. Se começou antes da grade visível, o chip
 *    de começo vai pro primeiro dia da grade, pra o mês não parecer vazio com
 *    tarefa em andamento.
 *  - No DETALHE do dia (o painel lateral), a tarefa aparece em todos os dias do
 *    intervalo, marcada "em andamento, até dd/mm".
 *  - Sem data_inicio (ou com início igual/depois do prazo), só no prazo, como
 *    sempre foi.
 *
 * Lógica pura: sem React, sem Supabase. Datas no formato yyyy-MM-dd.
 */

export interface TarefaComIntervalo {
  id: string;
  prazo: string;
  data_inicio: string | null;
}

/**
 * - "prazo": o dia do prazo (tarefa sem intervalo também cai aqui).
 * - "inicio": o dia em que começa (ou o primeiro dia visível, se começou antes).
 * - "andamento": dia no meio do intervalo. Só vai pro detalhe do dia, não pra grade.
 */
export type PapelNoDia = "inicio" | "andamento" | "prazo";

export interface OcorrenciaTarefa<T extends TarefaComIntervalo> {
  tarefa: T;
  papel: PapelNoDia;
}

const soData = (v: string) => v.slice(0, 10);

function proximoDiaISO(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  // Date.UTC evita o pulo de horário de verão e o fuso do navegador.
  const dt = new Date(Date.UTC(a, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

/** "2026-10-20" -> "20/10". */
export function ddmm(iso: string): string {
  const [, m, d] = soData(iso).split("-");
  return `${d}/${m}`;
}

/** Início efetivo do intervalo, ou null quando a tarefa é só de prazo. */
export function inicioDoIntervalo(t: TarefaComIntervalo): string | null {
  if (!t.data_inicio) return null;
  const inicio = soData(t.data_inicio);
  const prazo = soData(t.prazo);
  return inicio < prazo ? inicio : null;
}

/**
 * Espalha as tarefas pelos dias da grade [inicioGrade, fimGrade], com o papel
 * de cada uma em cada dia. A chave do Map é o dia (yyyy-MM-dd).
 */
export function distribuirTarefasPorDia<T extends TarefaComIntervalo>(
  tarefas: T[],
  inicioGrade: string,
  fimGrade: string,
): Map<string, OcorrenciaTarefa<T>[]> {
  const mapa = new Map<string, OcorrenciaTarefa<T>[]>();
  const add = (dia: string, tarefa: T, papel: PapelNoDia) => {
    const lista = mapa.get(dia) ?? [];
    lista.push({ tarefa, papel });
    mapa.set(dia, lista);
  };

  for (const t of tarefas) {
    const prazo = soData(t.prazo);
    const inicio = inicioDoIntervalo(t);

    if (!inicio) {
      if (prazo >= inicioGrade && prazo <= fimGrade) add(prazo, t, "prazo");
      continue;
    }
    // Intervalo fora da grade: nada a mostrar.
    if (prazo < inicioGrade || inicio > fimGrade) continue;

    const primeiroVisivel = inicio < inicioGrade ? inicioGrade : inicio;
    const ultimoVisivel = prazo > fimGrade ? fimGrade : prazo;
    for (let dia = primeiroVisivel; dia <= ultimoVisivel; dia = proximoDiaISO(dia)) {
      const papel: PapelNoDia =
        dia === prazo ? "prazo" : dia === primeiroVisivel ? "inicio" : "andamento";
      add(dia, t, papel);
    }
  }
  return mapa;
}
