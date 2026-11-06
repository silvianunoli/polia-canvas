// Bloco "Primeiros passos" do Painel (14/10/2026, desenho em cinza aprovado
// pela Sil). Substitui o onboarding de 5 passos como entrada da conta nova: em
// vez de quatro telas de perguntas antes de ver qualquer coisa, a conta cai
// direto no Painel com três passos.
//
// Desde 31/10/2026 os três passos são de operação (o Planejamento saiu da
// Pólia One). Saíram "Fechar o Módulo 1" e "Dar nome à marca" (o nome continua
// em Configurações).
//
// Desde 05/11/2026 (ONE-175, decisão da Sil) a ordem abre na encomenda: o
// pedido, a entrega que mostra o lucro e só depois o preço na Calculadora. É a
// mesma ideia da venda: a Pólia One é o sistema da marca, não uma ferramenta de
// precificação.
//
// Aqui mora só a regra (quem vê o bloco, o que está feito, qual passo está em
// destaque, que texto aparece). A leitura e a gravação ficam no hook
// usePrimeirosPassos; a tela, em components/painel/PrimeirosPassos.tsx.

import { nichoNegocioDoAnuncio, type NichoNegocio } from "@/lib/nichoNegocio";
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
// Era 15/10 00:00; o deploy saiu às 23:38 de 14/10, então o corte recuou pra
// 23:30 e o deploy ficou depois dele (ver o parágrafo acima).
export const CORTE_PRIMEIROS_PASSOS = "2026-10-14T23:30:00-03:00";
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

export type IdPasso = "preco" | "pedido" | "entregue";
export const ORDEM_PASSOS: readonly IdPasso[] = ["pedido", "entregue", "preco"];

export interface FatosPrimeirosPassos {
  /** Existe produto com calculadora_breakdown: o preço saiu da Calculadora. */
  temPreco: boolean;
  /** Existe venda com andamento (um pedido do quadro de Pedidos). */
  temPedido: boolean;
  /** Existe pedido no andamento "entregue" e não cancelado. */
  temEntregue: boolean;
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
    pedido: f.temPedido,
    entregue: f.temEntregue,
  };
  const destaque = ORDEM_PASSOS.find((id) => !feitos[id]) ?? null;
  const totalFeitos = ORDEM_PASSOS.filter((id) => feitos[id]).length;
  return { feitos, destaque, totalFeitos, completo: destaque === null };
}

/**
 * Ainda há o que fazer no bloco: falta um passo ou falta o nicho. O nicho é
 * obrigatório (23/10/2026) mas não é passo (não conta no "N de 3"): conta com
 * os três feitos e sem nicho ainda vê o bloco, só com a pergunta.
 */
export function blocoPendente(progresso: ProgressoPrimeirosPassos, temNicho: boolean): boolean {
  return !progresso.completo || !temNicho;
}

/** O bloco aparece: a conta está na regra e ainda falta um passo ou o nicho. */
export function mostraBloco(
  p: PerfilPrimeirosPassos,
  f: FatosPrimeirosPassos,
  temNicho: boolean,
): boolean {
  return contaVeBloco(p) && blocoPendente(progressoPrimeirosPassos(f), temNicho);
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
  /** O nicho do negócio que o anúncio já responde (null quando fica em dúvida). */
  negocio: NichoNegocio | null;
}

/**
 * O nicho do anúncio de onde a conta veio, lido do user_metadata
 * (origem_campanha.utm_content, gravado no cadastro). Null sem anúncio de nicho.
 */
export function nichoDaConta(userMetadata: unknown): NichoDoPasso | null {
  const origem = (userMetadata as { origem_campanha?: { utm_content?: unknown } } | null)
    ?.origem_campanha;
  const utm = origem?.utm_content;
  const chave = typeof utm === "string" ? utm : undefined;
  const n = nichoDaCampanha(chave);
  return n ? { pessoa: n.pessoa, tipo: n.tipo, negocio: nichoNegocioDoAnuncio(chave) } : null;
}

export const ESCOLHAS_TIPO: readonly { valor: EscolhaTipo; rotulo: string }[] = [
  { valor: "produto", rotulo: "Produto" },
  { valor: "servico", rotulo: "Serviço" },
  { valor: "os_dois", rotulo: "Os dois" },
];

export const CTA_PRECO = "Quero calcular meu preço";

// ── Estágio do negócio (20/10/2026, GRW-66) ──
// Desde que o onboarding de 5 passos saiu (14/10), ninguém mais respondia o
// estágio, e 58 das 80 contas do Grátis ficaram sem tipo nem estágio: sem isso a
// régua de e-mail não separa quem já vende de quem ainda está na ideia.

/** Valores aceitos pelo check de profiles.business_stage. */
export type EstagioNegocio = "ja_vendo" | "comecei" | "ideia";

export const ESCOLHAS_ESTAGIO: readonly { valor: EstagioNegocio; rotulo: string }[] = [
  { valor: "ja_vendo", rotulo: "Já vende" },
  { valor: "comecei", rotulo: "Começou agora" },
  { valor: "ideia", rotulo: "Ainda é ideia" },
];

export function estagioDoBanco(v: unknown): EstagioNegocio | null {
  return v === "ja_vendo" || v === "comecei" || v === "ideia" ? v : null;
}

/** A pergunta do estágio só aparece depois do primeiro pedido: antes disso ela atrasaria o quadro. */
export function perguntaEstagio(temPedido: boolean, estagio: EstagioNegocio | null): boolean {
  return temPedido && estagio === null;
}

/** Conta que veio de anúncio de nicho já diz o que vende: grava sem perguntar. */
export function escolhaDoNicho(nicho: NichoDoPasso | null): EscolhaTipo | null {
  if (!nicho) return null;
  return nicho.tipo === "servico" ? "servico" : "produto";
}

export interface TextoPassoPreco {
  titulo: string;
  subtitulo: string;
  /** Sem nicho, o passo pergunta o que a marca vende antes de abrir a Calculadora. */
  perguntaTipo: boolean;
}

export function textoPassoPreco(
  nicho: NichoDoPasso | null,
  escolha: EscolhaTipo | null = null,
): TextoPassoPreco {
  if (!nicho) {
    return {
      titulo:
        escolha === "servico" ? "Calcular o preço da sua hora" : "Calcular o preço de um produto",
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

/** Quem vende serviço não tem "encomenda": o anúncio ou a escolha salva dizem o que a conta vende. */
export function vendeServico(nicho: NichoDoPasso | null, escolha: EscolhaTipo | null): boolean {
  return nicho ? nicho.tipo === "servico" : escolha === "servico";
}

export interface TextoPassoPedido {
  titulo: string;
  subtitulo: string;
  acao: string;
}

// Os dois levam pro quadro de Pedidos. Sem pedido nenhum, o quadro abre no
// vazio com um botão só, "Anotar o primeiro pedido" (pedidos.tsx), que grava
// pela registrar_pedido. Com o catálogo vazio, o Novo pedido cadastra o produto
// ali mesmo (ModalNovoPedido).
export const HREF_PEDIDOS = "/pedidos";

export function textoPassoPedido(servico: boolean): TextoPassoPedido {
  return servico
    ? {
        titulo: "Lançar o próximo pedido",
        subtitulo: "Cadastre o serviço e lance o pedido com a cliente e o dia da entrega.",
        acao: "Quero lançar o pedido",
      }
    : {
        titulo: "Lançar a próxima encomenda",
        subtitulo: "Cadastre o produto dela e lance o pedido com a cliente e o dia da entrega.",
        acao: "Quero lançar a encomenda",
      };
}

export function textoPassoEntregue(servico: boolean): TextoPassoPedido {
  return {
    titulo: "Marcar como entregue e ver o lucro",
    subtitulo: servico
      ? "No quadro, o pedido anda até Entregue, e o cartão mostra quanto ele lucrou."
      : "No quadro, a encomenda anda até Entregue, e o cartão mostra quanto ela lucrou.",
    acao: "Quero abrir o quadro de Pedidos",
  };
}

/** A condição do bônus, a mesma da resgatar_bonus_primeiros_passos: o preço não entra. */
export function textoConviteBonus(servico: boolean, dias: number): string {
  return `${servico ? "Pedido lançado e entregue" : "Encomenda lançada e entregue"}, o teste do Pro ganha mais ${dias} dias.`;
}

/** Manchete do Painel enquanto o bloco está na tela. */
export function mancheteDoBloco(
  nicho: NichoDoPasso | null,
  destaque: IdPasso | null = "pedido",
  escolha: EscolhaTipo | null = null,
): string {
  const servico = vendeServico(nicho, escolha);
  // Os três feitos e o bloco ainda na tela: só falta responder o nicho.
  if (destaque === null) return "Os três passos estão feitos. Falta só dizer o nicho da marca.";
  if (destaque === "preco") {
    return "A entrega já mostrou o lucro. Agora a Calculadora confere o preço com o custo real.";
  }
  if (destaque === "entregue") {
    return servico
      ? "O pedido está no quadro. Quando ele for entregue, o cartão dele mostra quanto lucrou."
      : "A encomenda está no quadro. Quando ela for entregue, o cartão dela mostra quanto lucrou.";
  }
  if (!nicho) {
    return servico
      ? "O próximo pedido entra no quadro, e o Painel começa a mostrar quanto a marca lucra."
      : "A próxima encomenda entra no quadro, e o Painel começa a mostrar quanto a marca lucra.";
  }
  return servico
    ? `${nicho.pessoa}, o próximo pedido entra no quadro por aqui.`
    : `${nicho.pessoa}, a próxima encomenda entra no quadro por aqui.`;
}
