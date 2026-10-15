// Bloco "Primeiros passos" do Painel (14/10/2026, desenho em cinza aprovado
// pela Sil). Substitui o onboarding de 5 passos como entrada da conta nova: em
// vez de quatro telas de perguntas antes de ver qualquer coisa, a conta cai
// direto no Painel com três passos, o primeiro deles já a Calculadora.
//
// Aqui mora só a regra (quem vê o bloco, o que está feito, qual passo está em
// destaque, que texto aparece). A leitura e a gravação ficam no hook
// usePrimeirosPassos; a tela, em components/painel/PrimeirosPassos.tsx.

import { nichoDaCampanha } from "@/lib/nichosLanding";

/**
 * Data de corte da mudança. Conta criada a partir daqui vê o bloco.
 *
 * Quem já tinha conta não vê mudança nenhuma, com uma exceção: a conta que
 * ainda estava com `onboarding_completed = false` quando a mudança entrou.
 * Antes ela seria jogada no onboarding de 5 passos; agora cai no Painel e o
 * bloco faz esse papel. Na primeira carga do Painel, `onboarding_completed`
 * vira true e `onboarding_completed_at` ganha a data dessa carga, que é
 * posterior a este corte. É por isso que `onboarding_completed_at` depois do
 * corte também conta como "vê o bloco": é o rastro de que a conta chegou ao
 * Painel sem ter passado pelo onboarding antigo.
 *
 * Pressupõe que o deploy saia DEPOIS deste horário. Publicado antes, a conta
 * marcada entre o deploy e o corte perde o bloco na segunda carga.
 */
export const CORTE_PRIMEIROS_PASSOS = "2026-10-15T00:00:00-03:00";
const CORTE_MS = Date.parse(CORTE_PRIMEIROS_PASSOS);

export type TipoPreco = "produto" | "servico";
export type EscolhaTipo = "produto" | "servico" | "os_dois";
/** Valores que o bloco grava em profiles.business_type (o check do banco aceita os quatro antigos). */
export type BusinessTypeGravado = "produto_fisico" | "servico" | "hibrido";

export interface PerfilPrimeirosPassos {
  createdAt: string | null;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
}

function aPartirDoCorte(iso: string | null): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= CORTE_MS;
}

/** A conta entra na regra do bloco (ver CORTE_PRIMEIROS_PASSOS). */
export function contaVeBloco(p: PerfilPrimeirosPassos): boolean {
  return (
    !p.onboardingCompleted || aPartirDoCorte(p.createdAt) || aPartirDoCorte(p.onboardingCompletedAt)
  );
}

/** Pelo created_at da sessão dá pra saber cedo que a conta é nova (pro skeleton). */
export function contaCriadaDepoisDoCorte(createdAt: string | null | undefined): boolean {
  return aPartirDoCorte(createdAt ?? null);
}

export type IdPasso = "preco" | "modulo-1" | "nome";
export const ORDEM_PASSOS: readonly IdPasso[] = ["preco", "modulo-1", "nome"];

export interface FatosPrimeirosPassos {
  /** Existe produto com calculadora_breakdown: o preço saiu da Calculadora. */
  temPreco: boolean;
  modulo1Fechado: boolean;
  /** business_name preenchido. */
  temNome: boolean;
}

export interface ProgressoPrimeirosPassos {
  feitos: Record<IdPasso, boolean>;
  /** O primeiro passo não feito, na ordem. Null com os três feitos. */
  destaque: IdPasso | null;
  totalFeitos: number;
  completo: boolean;
}

export function progressoPrimeirosPassos(f: FatosPrimeirosPassos): ProgressoPrimeirosPassos {
  const feitos: Record<IdPasso, boolean> = {
    preco: f.temPreco,
    "modulo-1": f.modulo1Fechado,
    nome: f.temNome,
  };
  const destaque = ORDEM_PASSOS.find((id) => !feitos[id]) ?? null;
  const totalFeitos = ORDEM_PASSOS.filter((id) => feitos[id]).length;
  return { feitos, destaque, totalFeitos, completo: destaque === null };
}

/** O bloco aparece: a conta está na regra e ainda falta pelo menos um passo. */
export function mostraBloco(p: PerfilPrimeirosPassos, f: FatosPrimeirosPassos): boolean {
  return contaVeBloco(p) && !progressoPrimeirosPassos(f).completo;
}

// ── Tipo de negócio ──

/** O que já está em profiles.business_type vira a pílula marcada. */
export function escolhaDoBusinessType(v: unknown): EscolhaTipo | null {
  if (v === "produto_fisico" || v === "produto_digital") return "produto";
  if (v === "servico") return "servico";
  if (v === "hibrido") return "os_dois";
  return null;
}

export function businessTypeDaEscolha(e: EscolhaTipo): BusinessTypeGravado {
  if (e === "servico") return "servico";
  if (e === "os_dois") return "hibrido";
  return "produto_fisico";
}

/** "Os dois" abre na aba Produto: é a conta que pede mais campos. */
export function tipoPrecoDaEscolha(e: EscolhaTipo): TipoPreco {
  return e === "servico" ? "servico" : "produto";
}

export function hrefCalculadora(tipo: TipoPreco): string {
  return `/calculadora?tipo=${tipo}`;
}

/** Aceita o ?tipo= da URL com tolerância; qualquer outra coisa é ignorada. */
export function tipoPrecoDaBusca(v: unknown): TipoPreco | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().toLowerCase();
  if (t === "produto") return "produto";
  if (t === "servico" || t === "serviço") return "servico";
  return undefined;
}

// ── Textos ──

/** O que o bloco precisa saber do nicho do anúncio (nichosLanding). */
export interface NichoDoPasso {
  pessoa: string;
  tipo: TipoPreco;
}

/**
 * O nicho do anúncio de onde a conta veio, lido do user_metadata
 * (origem_campanha.utm_content, gravado no cadastro). Null sem anúncio de nicho.
 */
export function nichoDaConta(userMetadata: unknown): NichoDoPasso | null {
  const origem = (userMetadata as { origem_campanha?: { utm_content?: unknown } } | null)
    ?.origem_campanha;
  const utm = origem?.utm_content;
  const n = nichoDaCampanha(typeof utm === "string" ? utm : undefined);
  return n ? { pessoa: n.pessoa, tipo: n.tipo } : null;
}

export const ESCOLHAS_TIPO: readonly { valor: EscolhaTipo; rotulo: string }[] = [
  { valor: "produto", rotulo: "Produto" },
  { valor: "servico", rotulo: "Serviço" },
  { valor: "os_dois", rotulo: "Os dois" },
];

export const CTA_PRECO = "Quero calcular meu preço";

export interface TextoPassoPreco {
  titulo: string;
  subtitulo: string;
  /** Sem nicho, o passo pergunta o que a marca vende antes de abrir a Calculadora. */
  perguntaTipo: boolean;
}

export function textoPassoPreco(nicho: NichoDoPasso | null): TextoPassoPreco {
  if (!nicho) {
    return {
      titulo: "Calcular o primeiro preço",
      subtitulo: "A sua marca vende o quê?",
      perguntaTipo: true,
    };
  }
  if (nicho.tipo === "servico") {
    return {
      titulo: "Calcular o preço da sua hora",
      subtitulo: "Material e o seu tempo. Uns 3 minutos.",
      perguntaTipo: false,
    };
  }
  return {
    titulo: "Calcular o preço de um produto",
    subtitulo: "Material, embalagem e o seu tempo. Uns 3 minutos.",
    perguntaTipo: false,
  };
}

export const PASSO_MODULO_1 = {
  titulo: "Fechar o Módulo 1 do Planejamento",
  subtitulo: "O que faz a sua marca valer esse preço.",
  acao: "Quero abrir o Módulo 1",
  href: "/planejamento/modulo/1",
} as const;

export const PASSO_NOME = {
  titulo: "Dar nome à marca",
  subtitulo: "Aparece no menu e no Planejamento. Dá pra trocar depois em Configurações.",
} as const;

/** Mesmo teto do campo de nome do onboarding antigo. */
export const NOME_MARCA_MAX = 60;

export function limparNomeMarca(v: string): string {
  return v.trim().slice(0, NOME_MARCA_MAX).trim();
}

/** Manchete do Painel enquanto o bloco está na tela. */
export function mancheteDoBloco(nicho: NichoDoPasso | null): string {
  if (!nicho) return "Três passos e o Painel começa a mostrar o seu mês.";
  return nicho.tipo === "servico"
    ? `${nicho.pessoa}, o preço da sua hora começa por aqui.`
    : `${nicho.pessoa}, o preço do seu produto começa por aqui.`;
}
