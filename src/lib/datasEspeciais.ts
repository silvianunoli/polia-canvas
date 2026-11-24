/**
 * Feriados nacionais e datas do comércio no Calendário (ONE-252, pedido da Sil
 * em 24/11/2026: "coloque no calendário das datas sazonais [como black friday]
 * e feriados nacionais").
 *
 * Tudo calculado aqui, sem banco: as datas fixas são uma lista, as móveis saem
 * da Páscoa (Carnaval, Sexta-feira Santa, Corpus Christi), do domingo do mês
 * (Dia das Mães, Dia dos Pais) e do Dia de Ação de Graças americano (Black
 * Friday e Cyber Monday). Feriado estadual e municipal fica de fora: depende
 * da cidade de cada marca.
 *
 * Lógica pura: sem React, sem Supabase. Datas no formato AAAA-MM-DD.
 */

export type TipoData = "feriado" | "comercio";

export interface DataEspecial {
  dia: string;
  nome: string;
  tipo: TipoData;
  /** "ponto facultativo" no Carnaval e no Corpus Christi. */
  detalhe: string | null;
}

function iso(ano: number, mes: number, dia: number): string {
  return new Date(Date.UTC(ano, mes - 1, dia)).toISOString().slice(0, 10);
}

function somaDias(dia: string, n: number): string {
  const [a, m, d] = dia.split("-").map(Number);
  return iso(a, m, d + n);
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(ano, mes, dia);
}

/** n-ésimo dia da semana (0 = domingo) do mês. */
function enesimoDiaDaSemana(ano: number, mes: number, diaDaSemana: number, n: number): string {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const desloc = (diaDaSemana - primeiro + 7) % 7;
  return iso(ano, mes, 1 + desloc + (n - 1) * 7);
}

const FIXOS: { mes: number; dia: number; nome: string; tipo: TipoData }[] = [
  { mes: 1, dia: 1, nome: "Confraternização Universal", tipo: "feriado" },
  { mes: 3, dia: 8, nome: "Dia da Mulher", tipo: "comercio" },
  { mes: 3, dia: 15, nome: "Dia do Consumidor", tipo: "comercio" },
  { mes: 4, dia: 21, nome: "Tiradentes", tipo: "feriado" },
  { mes: 5, dia: 1, nome: "Dia do Trabalho", tipo: "feriado" },
  { mes: 6, dia: 12, nome: "Dia dos Namorados", tipo: "comercio" },
  { mes: 7, dia: 26, nome: "Dia dos Avós", tipo: "comercio" },
  { mes: 9, dia: 7, nome: "Independência do Brasil", tipo: "feriado" },
  { mes: 9, dia: 15, nome: "Dia do Cliente", tipo: "comercio" },
  { mes: 10, dia: 12, nome: "Nossa Senhora Aparecida", tipo: "feriado" },
  { mes: 10, dia: 12, nome: "Dia das Crianças", tipo: "comercio" },
  { mes: 10, dia: 15, nome: "Dia do Professor", tipo: "comercio" },
  { mes: 11, dia: 2, nome: "Finados", tipo: "feriado" },
  { mes: 11, dia: 15, nome: "Proclamação da República", tipo: "feriado" },
  // Feriado nacional desde a Lei 14.759/2023.
  { mes: 11, dia: 20, nome: "Dia da Consciência Negra", tipo: "feriado" },
  { mes: 12, dia: 24, nome: "Véspera de Natal", tipo: "comercio" },
  { mes: 12, dia: 25, nome: "Natal", tipo: "feriado" },
  { mes: 12, dia: 31, nome: "Véspera de Ano Novo", tipo: "comercio" },
];

/** Todas as datas especiais do ano, em ordem. */
export function datasDoAno(ano: number): DataEspecial[] {
  const p = pascoa(ano);
  // Ação de Graças americano = 4ª quinta de novembro; a Black Friday é o dia
  // seguinte (nem sempre a última sexta do mês).
  const acaoDeGracas = enesimoDiaDaSemana(ano, 11, 4, 4);
  const datas: DataEspecial[] = [
    ...FIXOS.map((f) => ({
      dia: iso(ano, f.mes, f.dia),
      nome: f.nome,
      tipo: f.tipo,
      detalhe: null,
    })),
    { dia: somaDias(p, -47), nome: "Carnaval", tipo: "feriado", detalhe: "ponto facultativo" },
    { dia: somaDias(p, -2), nome: "Sexta-feira Santa", tipo: "feriado", detalhe: null },
    { dia: p, nome: "Páscoa", tipo: "comercio", detalhe: null },
    { dia: somaDias(p, 60), nome: "Corpus Christi", tipo: "feriado", detalhe: "ponto facultativo" },
    {
      dia: enesimoDiaDaSemana(ano, 5, 0, 2),
      nome: "Dia das Mães",
      tipo: "comercio",
      detalhe: null,
    },
    {
      dia: enesimoDiaDaSemana(ano, 8, 0, 2),
      nome: "Dia dos Pais",
      tipo: "comercio",
      detalhe: null,
    },
    { dia: somaDias(acaoDeGracas, 1), nome: "Black Friday", tipo: "comercio", detalhe: null },
    { dia: somaDias(acaoDeGracas, 4), nome: "Cyber Monday", tipo: "comercio", detalhe: null },
  ];
  return datas.sort((a, b) =>
    a.dia === b.dia ? (a.tipo === "feriado" ? -1 : 1) : a.dia.localeCompare(b.dia),
  );
}

/** Datas especiais do intervalo [inicio, fim], agrupadas por dia. */
export function datasNoIntervalo(inicio: string, fim: string): Map<string, DataEspecial[]> {
  const mapa = new Map<string, DataEspecial[]>();
  const anoInicio = Number(inicio.slice(0, 4));
  const anoFim = Number(fim.slice(0, 4));
  for (let ano = anoInicio; ano <= anoFim; ano++) {
    for (const d of datasDoAno(ano)) {
      if (d.dia < inicio || d.dia > fim) continue;
      const lista = mapa.get(d.dia) ?? [];
      lista.push(d);
      mapa.set(d.dia, lista);
    }
  }
  return mapa;
}
