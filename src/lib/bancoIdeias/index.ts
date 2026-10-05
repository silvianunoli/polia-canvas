import type { IdeiaPost, TipoPost } from "./tipos";
import { IDEIAS_ARTESANATO } from "./artesanato";
import { IDEIAS_BELEZA } from "./beleza";
import { IDEIAS_BEMESTAR } from "./bemestar";
import { IDEIAS_COMIDA } from "./comida";
import { IDEIAS_DIGITAL } from "./digital";
import { IDEIAS_MODA } from "./moda";
import { IDEIAS_PAPELARIA } from "./papelaria";
import { IDEIAS_SERVICOS } from "./servicos";

export type { IdeiaPost, TipoPost } from "./tipos";

export type ChaveNicho =
  | "papelaria"
  | "moda"
  | "beleza"
  | "comida"
  | "digital"
  | "bemestar"
  | "servicos"
  | "artesanato";

export interface Nicho {
  chave: ChaveNicho;
  nome: string;
  exemplos: string;
  ideias: IdeiaPost[];
}

export const NICHOS: Nicho[] = [
  {
    chave: "papelaria",
    nome: "Papelaria e presentes",
    exemplos: "cadernos, agendas, cartões, brindes",
    ideias: IDEIAS_PAPELARIA,
  },
  {
    chave: "moda",
    nome: "Moda e acessórios",
    exemplos: "roupas, bijuterias, bolsas, brechó",
    ideias: IDEIAS_MODA,
  },
  {
    chave: "beleza",
    nome: "Beleza e cosméticos",
    exemplos: "skincare, sabonetes, maquiagem",
    ideias: IDEIAS_BELEZA,
  },
  {
    chave: "comida",
    nome: "Comida e doces",
    exemplos: "confeitaria, salgados, marmitas",
    ideias: IDEIAS_COMIDA,
  },
  {
    chave: "digital",
    nome: "Produto digital",
    exemplos: "cursos, ebooks, templates",
    ideias: IDEIAS_DIGITAL,
  },
  {
    chave: "bemestar",
    nome: "Serviço de beleza e bem-estar",
    exemplos: "manicure, estética, massagem",
    ideias: IDEIAS_BEMESTAR,
  },
  {
    chave: "servicos",
    nome: "Consultoria e serviços",
    exemplos: "design, fotografia, social media",
    ideias: IDEIAS_SERVICOS,
  },
  {
    chave: "artesanato",
    nome: "Artesanato",
    exemplos: "cerâmica, crochê, velas, bordado",
    ideias: IDEIAS_ARTESANATO,
  },
];

/** Um nicho só por plano (decisão da Sil, 05/10/2026). */
export const MAX_NICHOS = 1;

export function nichoPorChave(chave: string): Nicho | undefined {
  return NICHOS.find((n) => n.chave === chave);
}

export interface DiaDoBanco {
  data: string; // "AAAA-MM-DD"
  tipo: TipoPost;
  titulo: string;
  ideia: string;
}

function datasDoAno(ano: number): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(ano, 0, 1));
  while (d.getUTCFullYear() === ano) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * Monta uma ideia por dia do ano a partir do nicho escolhido (a função aceita
 * lista pra caso a regra mude, mas corta em MAX_NICHOS). O banco tem 60 ideias por nicho,
 * então elas voltam ao longo do ano; a cada volta a sequência anda 7 posições
 * pra não repetir sempre no mesmo dia da semana. Determinístico: mesmos
 * nichos e mesmo ano dão o mesmo plano.
 */
export function montarAnoDoBanco(ano: number, chaves: string[]): DiaDoBanco[] {
  const listas = chaves
    .map((c) => nichoPorChave(c))
    .filter((n): n is Nicho => !!n && n.ideias.length > 0)
    .slice(0, MAX_NICHOS)
    .map((n) => n.ideias);
  if (listas.length === 0) return [];

  const sequencia: IdeiaPost[] = [];
  const maior = Math.max(...listas.map((l) => l.length));
  for (let i = 0; i < maior; i++) for (const l of listas) if (i < l.length) sequencia.push(l[i]);

  const total = sequencia.length;
  return datasDoAno(ano).map((data, dia) => {
    const volta = Math.floor(dia / total);
    const ideia = sequencia[(dia + volta * 7) % total];
    return { data, tipo: ideia.tipo, titulo: ideia.titulo, ideia: ideia.ideia };
  });
}
