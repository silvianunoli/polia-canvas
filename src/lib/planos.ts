// Fonte única do mapa de planos. Nome visível Grátis/Premium/Pro (desde
// 14/09/2026); chave interna confere/controle/projete, que fica porque está no
// banco, nas migrations e nos segredos do Stripe. Fase 1: gating de
// rota + cotas, sem IA e sem separar Premium de Pro tecnicamente ainda
// (ambos mapeiam pro tier "controle" até a Fase 2/3 definirem o exclusivo do
// Pro).

export type Plano = "beta" | "confere" | "controle" | "projete" | "cancelada";
export type Tier = "confere" | "controle";
export type TierPago = "controle" | "projete";

// beta = acesso total, tratado à parte (nunca passa pelo tier system).
// controle/projete = tier "controle" (Fase 1: idênticos em acesso).
// confere/cancelada/valor desconhecido = tier "confere" (nunca bloqueia tudo).
export function ehBeta(plano: string | null | undefined): boolean {
  return plano === "beta";
}

export function tierDoPlano(plano: string | null | undefined): Tier {
  if (plano === "controle" || plano === "projete") return "controle";
  return "confere";
}

/**
 * Direito às features exclusivas do Pro. Existe porque o tier system só tem
 * dois níveis (confere/controle) e o Pro mora dentro do "controle" — a
 * pergunta "tem Pro?" não é respondível por `tierDoPlano`.
 *
 * Inclui `beta`, que é acesso total: a checagem `plano === "projete"` estava
 * copiada em seis arquivos e reprovava conta beta em todos eles.
 */
export function temProjete(plano: string | null | undefined): boolean {
  return ehBeta(plano) || plano === "projete";
}

// Rotas que abrem só no Pro. Elas passam pelo guard de tier (são "controle")
// e são barradas por um portão dentro da própria página. Sem esta lista, a barra
// lateral não tem como saber que são pagas e mostra três itens SEM cadeado que a
// usuária do Premium não consegue usar.
const ROTAS_PROJETE = ["/raiox", "/plano-conteudo", "/projecao"];

export function ehRotaProjete(pathname: string): boolean {
  return ROTAS_PROJETE.some((p) => bateRota(p, pathname));
}

/** Qual plano pago a rota exige — pra nomear o certo na tela de upgrade. */
export function tierPagoDaRota(pathname: string): TierPago {
  return ehRotaProjete(pathname) ? "projete" : "controle";
}

/**
 * Link da tela de upgrade já com o plano que a rota exige (Pro pra Raio-x,
 * Projeção e Plano de conteúdo; Premium pro resto). Com "controle" fixo, a
 * usuária do Grátis via "Recurso do plano Premium" numa tela do Pro.
 */
export function hrefUpgrade(rota: string): string {
  return `/upgrade?rota=${encodeURIComponent(rota)}&tier=${tierPagoDaRota(rota)}`;
}

/**
 * Direito de USO da tela, não só de entrar nela: soma a trava de rota (tier) com
 * o portão Pro de dentro da página. É o que a navegação deve consultar pra
 * decidir se mostra cadeado — `rotaLiberada` sozinha diz que /raiox está livre
 * pro Premium, o que é verdade pro roteador e mentira pra usuária.
 */
export function recursoLiberado(pathname: string, plano: string | null | undefined): boolean {
  if (!rotaLiberada(pathname, plano)) return false;
  if (ehRotaProjete(pathname)) return temProjete(plano);
  return true;
}

// Tier mínimo por prefixo de rota. Não listado = "controle" por padrão (nega
// por padrão). Onboarding e Assinar ficam de fora — são isentos por completo,
// tratados em _authenticated.tsx, não aqui.
const ROTAS_TIER: { prefixo: string; tier: Tier }[] = [
  { prefixo: "/painel", tier: "confere" },
  { prefixo: "/configuracoes", tier: "confere" },
  { prefixo: "/chamados", tier: "confere" },
  { prefixo: "/planejamento", tier: "confere" },
  { prefixo: "/aimer", tier: "confere" }, // todo plano abre o chat; teto diário e modo data-aware são no servidor
  { prefixo: "/produtos", tier: "confere" }, // cotada, ver COTAS_CONFERE
  // Ferramenta independente do catálogo. Calcular é livre no Grátis; a cota só
  // pega ao guardar o resultado como produto.
  { prefixo: "/calculadora", tier: "confere" },
  // Quadro de Pedidos (GRW-93): todo plano; o Grátis tem até 15 abertos (banco).
  { prefixo: "/pedidos", tier: "confere" },
  // Planner e Caderno: só a conta interna desde 28/10/2026 (lib/ferramentasInternas).
  { prefixo: "/planner", tier: "confere" }, // cotada
  { prefixo: "/caderno", tier: "confere" }, // cotada
  { prefixo: "/como-usar", tier: "confere" }, // tutorial narrado: todo plano assiste
  { prefixo: "/raiox", tier: "controle" }, // Pro-only por dentro, mesmo padrão do Resumo/Encomenda
  { prefixo: "/plano-conteudo", tier: "controle" }, // Pro-only por dentro, mesmo padrão do Raio-x
  { prefixo: "/projecao", tier: "controle" }, // Pro-only por dentro, mesmo padrão do Raio-x
  // Metas é do plano Grátis desde 03/09/2026 (decisão COPY-03): o card do plano
  // grátis promete "até 3 metas acompanhadas" e a rota redirecionava pro
  // upgrade — a usuária tinha zero metas, não três. O teto de 3 ativas por vez
  // vale pra todo plano e mora em LIMITE_METAS_ATIVAS (src/lib/metaDoMes.ts).
  { prefixo: "/metas", tier: "confere" },
  { prefixo: "/clientes", tier: "controle" },
  // Vendas e Mais vendidos (VND-03): Premium até a Sil fechar o VND-01.
  { prefixo: "/vendas", tier: "controle" },
  { prefixo: "/financeiro", tier: "controle" },
  { prefixo: "/calendario", tier: "controle" },
  { prefixo: "/mercado", tier: "controle" },
];

function bateRota(prefixo: string, pathname: string): boolean {
  return pathname === prefixo || pathname.startsWith(prefixo + "/");
}

export function tierMinimoDaRota(pathname: string): Tier {
  const encontrada = ROTAS_TIER.find((r) => bateRota(r.prefixo, pathname));
  return encontrada?.tier ?? "controle";
}

export function rotaLiberada(pathname: string, plano: string | null | undefined): boolean {
  if (ehBeta(plano)) return true;
  const tierUsuaria = tierDoPlano(plano);
  const tierNecessario = tierMinimoDaRota(pathname);
  if (tierNecessario === "confere") return true;
  return tierUsuaria === "controle";
}

export const COTAS_CONFERE = {
  produtos: 5,
  planner: 1,
  caderno: 1,
  // Cartões de quadro do Planner (tarefas com quadro_id), somando todos os
  // quadros. Decisão da Sil em 07/10/2026; o banco trava igual
  // (assert_cota_cartoes, migration 20261008210000).
  cartoes: 100,
} as const;

/** Mensagem do limite de cartões, igual na tela e no erro do banco. */
export const MSG_LIMITE_CARTOES =
  "O plano Grátis guarda até 100 cartões no Planner. Pra criar mais, assine o Premium.";

// O teto de 3 metas ativas NÃO entra aqui de propósito. Ele não é cota de
// plano: é regra de foco, vale igual pro plano Grátis, pro Premium e pro Pro
// ("Até 3 metas ativas por vez, pra o foco não se dividir." está na própria
// tela). Fonte única: LIMITE_METAS_ATIVAS em src/lib/metaDoMes.ts.
// Também não ganhou trigger no banco como produtos/quadros/notas
// (20260727130000): a trigger materializar_planejamento cria "Meta do mês" e
// "Meta pessoal" a partir do Planejamento, que é módulo do plano Grátis — uma cota
// no banco faria o salvar do Planejamento explodir pra quem já tem 3 metas.

// A cota de geração por IA NÃO mora aqui. Fonte única: CONFIG_POR_PLANO em
// src/lib/planejamentoIa.functions.ts (Grátis 1/mês, Premium 30, Pro 60),
// contada na tabela `ia_geracoes` no servidor. A constante de documentação que
// existia neste ponto dizia que a feature não estava implementada, o que deixou
// de ser verdade em 14/08/2026, e duplicava o teto do plano gratuito em dois
// lugares que podiam divergir em silêncio.

// ── Lista de benefícios ──────────────────────────────────────────────────────
// Fonte única da lista de cada plano (23/10/2026, pedido da Sil): /planos,
// /assinar e as landings (home, /landing-a, /landing-b, /premium-a, /premium-b)
// leem daqui. Antes cada landing tinha a própria cópia e todas pararam no que
// existia em setembro, sem Vendas, Estoque, Orçamento nem Contas a pagar.
//
// Selo "Novo": recurso que entrou há pouco, até a data de `novoAte` (inclusive).
// Vence sozinho pra não ficar "Novo" pra sempre.
// Selo "Em breve": planejado e com card no Kanban, ainda não está no ar. O plano
// de cada um segue a proposta de 23/10; o VND-01 (plano de cada parte do módulo
// Vendas) ainda está aberto com a Sil.

export type SeloBeneficio = "novo" | "em-breve";

export type Beneficio = {
  /** Estável, pra landing escolher a ordem e o item em destaque sem depender do texto. */
  id: string;
  texto: string;
  emBreve?: boolean;
  /** AAAA-MM-DD. Mostra "Novo" até esse dia. */
  novoAte?: string;
  /** Só pra quem ainda não tem conta (o teste do Pro): a /assinar, logada, não mostra. */
  soParaVisitante?: boolean;
};

// Vendas, Estoque, Orçamento, Taxas, Kit e combo, Clientes, Contas a pagar e
// Insumos entraram no ar em 23/10/2026. Trinta dias de "Novo".
const NOVO_OUT_2026 = "2026-11-22";

/** Data de hoje em Brasília, AAAA-MM-DD (o "Novo" vence à meia-noite daqui, não às 21h). */
function hojeEmBrasilia(agora: Date): string {
  return new Date(agora.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function seloDoBeneficio(b: Beneficio, agora: Date = new Date()): SeloBeneficio | null {
  if (b.emBreve) return "em-breve";
  if (b.novoAte && hojeEmBrasilia(agora) <= b.novoAte) return "novo";
  return null;
}

/**
 * A mesma lista com alguns itens na frente, pra cada landing abrir pelo que ela
 * promete (a /landing-a vende a Calculadora, a /premium o Financeiro). Os "Em
 * breve" ficam sempre por último, depois do que já está no ar.
 */
export function beneficiosNaOrdem(lista: Beneficio[], primeiros: string[] = []): Beneficio[] {
  const frente = primeiros
    .map((id) => lista.find((b) => b.id === id))
    .filter((b): b is Beneficio => !!b);
  const resto = lista.filter((b) => !primeiros.includes(b.id));
  return [...frente, ...resto.filter((b) => !b.emBreve), ...resto.filter((b) => b.emBreve)];
}

// O que o plano Grátis inclui.
// /marca e /mercado não estão em ROTAS_TIER, então são pagas: a lista avisa
// (06/10/2026, decisão da Sil) em vez de prometer "Planejamento completo" e
// mandar a usuária do Grátis pra uma tela de upgrade no fim do Módulo 1.
// Recursos no ar que faltavam na lista entraram em 27/10/2026 (COPY-36): teste do
// Pro, cota de IA, Calculadora detalhada, importar planilha, tutorial e chamados.
export const BENEFICIOS_GRATIS: Beneficio[] = [
  {
    // GRW-66 e ONE-136 (src/lib/testePro.ts): conta nova nasce no Pro por 7 dias.
    id: "teste-pro",
    texto: "Conta nova começa com 7 dias de Pro. Completou os primeiros passos, ganha mais 7.",
    soParaVisitante: true,
  },
  {
    id: "planejamento",
    texto: "Os 6 módulos do Planejamento (os documentos de Marca e Mercado são do Premium)",
  },
  {
    // ONE-107 e ONE-109. A Encomenda é a única parte que trava (Pro).
    id: "calculadora",
    texto:
      "Calculadora de preço pra produto e serviço: material pelo pacote, mão de obra pelo tempo, custo fixo rateado e o seu salário na conta, com simulação de desconto",
  },
  { id: "catalogo", texto: "Catálogo de até 5 produtos" },
  {
    // ONE-121. Só .csv: o card fala em XLSX, o código não aceita.
    id: "importar-produtos",
    texto: "Produtos entram de uma planilha (CSV), com revisão antes de gravar",
  },
  { id: "metas", texto: "Até 3 metas ativas por vez" },
  // Planner e Caderno saíram das usuárias em 28/10/2026; Pedidos entrou no lugar.
  { id: "pedidos", texto: "Quadro de Pedidos com até 15 pedidos abertos" },
  { id: "assistente", texto: "Assistente pra tirar dúvida, com teto diário" },
  // Cota em CONFIG_POR_PLANO (src/lib/planejamentoIa.functions.ts): 1, 30 e 60.
  { id: "ia", texto: "1 rascunho por mês com a IA no Planejamento" },
  {
    // /como-usar e /chamados abrem em todo plano (ROTAS_TIER).
    id: "tutorial-suporte",
    texto: "Tutorial narrado de cada parte e suporte por chamado, direto na ferramenta",
  },
];

// Preço e o que cada plano pago abre — mesmo conteúdo usado no checkout
// (src/routes/_authenticated/assinar.tsx) e na tela de upgrade
// (src/routes/_authenticated/upgrade.tsx), pra não duplicar em dois lugares.
export const TIERS_PAGOS: Record<
  TierPago,
  {
    titulo: string;
    precoMensal: number;
    precoAnual: number;
    /** Linha de abertura da lista, sem selo nem ícone. */
    base: string;
    beneficios: Beneficio[];
    destaque?: boolean;
  }
> = {
  controle: {
    titulo: "Premium",
    precoMensal: 29.9,
    precoAnual: 299,
    base: "Tudo do Grátis, mais:",
    beneficios: [
      {
        id: "documentos",
        texto: "Documentos de Marca e Mercado, escritos a partir do Planejamento",
      },
      {
        id: "catalogo",
        texto: "Catálogo sem limite: cada produto com o custo, o preço e quanto a marca lucra",
      },
      {
        id: "vendas",
        texto: "Vendas: cada venda registrada baixa o estoque e entra sozinha no Financeiro",
        novoAte: NOVO_OUT_2026,
      },
      {
        id: "estoque",
        texto: "Estoque por variação, e kit ou combo que baixa cada item",
        novoAte: NOVO_OUT_2026,
      },
      {
        id: "mais-vendidos",
        texto: "Mais vendidos, Curva ABC e os produtos parados na prateleira",
        novoAte: NOVO_OUT_2026,
      },
      {
        id: "taxas",
        texto:
          "Taxa de cada forma de receber, e quanto o preço deixa no Pix, no cartão e no marketplace",
        novoAte: NOVO_OUT_2026,
      },
      {
        id: "orcamento",
        texto: "Orçamento com a cara da marca, que a cliente aprova pelo link e vira venda",
        novoAte: NOVO_OUT_2026,
      },
      {
        id: "financeiro",
        texto:
          "Financeiro com os três números que decidem o mês: o mínimo pra fechar as contas, o mês bom e o mês de celebrar",
      },
      {
        // ONE-124, no ar desde 11/10 (6fa92f8).
        id: "importar-extrato",
        texto:
          "Extrato do banco (OFX ou CSV) e nota fiscal (XML) entram no Financeiro sem digitar, com revisão linha a linha antes",
      },
      {
        id: "contas-pagar",
        texto: "Contas a pagar com vencimento, e as que repetem todo mês",
        novoAte: NOVO_OUT_2026,
      },
      {
        // ONE-123 (status da negociação ao pós-venda) e o Exportar CSV de /clientes.
        id: "clientes",
        texto:
          "Clientes com o status de cada pedido, da negociação ao pós-venda, e a lista em CSV quando precisar",
      },
      {
        id: "quem-compra",
        texto: "Quem voltou a comprar, quem sumiu, e um link pra captar contatos novos",
        novoAte: NOVO_OUT_2026,
      },
      {
        id: "pedidos",
        texto: "Pedidos sem limite e o Calendário das entregas com a agenda do Google junto",
      },
      { id: "ia", texto: "Até 30 rascunhos por mês com a IA no Planejamento" },
      {
        // ONE-133, no ar desde 23/10 (7430af6)
        id: "insumos",
        texto: "Insumos e produção: o material sai do estoque quando a peça fica pronta",
        novoAte: NOVO_OUT_2026,
      },
      {
        // ONE-134, no ar desde 23/10 (0003d40), na aba Estoque e na de Insumos,
        // sem trava de Pro. Até 24/10 esta lista dizia "Em breve" no Pro (COPY-33).
        id: "reposicao",
        texto: "Sugestão de reposição: o que repor e quanto, pelo giro de cada produto e insumo",
        novoAte: NOVO_OUT_2026,
      },
    ],
    destaque: true,
  },
  projete: {
    titulo: "Pro",
    precoMensal: 47.9,
    precoAnual: 479,
    base: "Tudo do Premium, mais:",
    beneficios: [
      {
        id: "raiox",
        texto: "Raio-x do mês: a leitura do que aconteceu e o que muda no mês que vem",
      },
      {
        id: "projecao",
        texto: "Projeção: quantas vendas faltam pra empatar, pra se pagar e pra bater a meta",
      },
      { id: "encomenda", texto: "Calculadora de encomenda sob medida" },
      {
        id: "plano-conteudo",
        texto: "Plano de conteúdo: 60 ideias do seu nicho espalhadas pelo ano, uma por dia",
      },
      { id: "resumo-contador", texto: "Resumo do mês pro contador, em PDF e CSV" },
      { id: "assistente", texto: "Assistente que lê os números da conta antes de responder" },
      { id: "ia", texto: "Até 60 rascunhos por mês com a IA no Planejamento" },
      {
        // VND-05 (TikTok Shop), VND-30 (Mercado Livre) e VND-17 (Shopee). COPY-34, 27/10/2026.
        id: "marketplaces",
        texto:
          "TikTok Shop, Mercado Livre e Shopee ligados à Pólia One: o pedido vira venda, o estoque baixa e a taxa entra na conta",
        emBreve: true,
      },
      {
        // VND-08
        id: "whatsapp",
        texto: "Mensagem de pós-venda pelo WhatsApp, no dia certo depois da entrega",
        emBreve: true,
      },
      {
        // ONE-135
        id: "conferencia",
        texto: "Conferência do que o marketplace pagou em cada pedido",
        emBreve: true,
      },
    ],
  },
};

/**
 * O que está sendo assinado, em palavras, pro diálogo de pagamento:
 * "Premium, R$ 29,90 por mês". Antes o diálogo dizia só "Assinatura da Pólia
 * One" e o botão Confirmar não mostrava plano nem preço (PAY-31, 08/10/2026).
 * Chave desconhecida volta null.
 */
export function resumoDoPlano(plano: string | null | undefined): string | null {
  const [tier, ciclo] = (plano ?? "").split("_");
  const valor = valorDoPlano(plano);
  if (valor === null || (tier !== "controle" && tier !== "projete")) return null;
  const preco = valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${TIERS_PAGOS[tier].titulo}, R$ ${preco} ${ciclo === "anual" ? "por ano" : "por mês"}`;
}

// Valor cobrado por chave de plano ("controle_mensal" etc.), pro evento
// purchase do GA4. Chave desconhecida volta null em vez de inventar valor.
export function valorDoPlano(plano: string | null | undefined): number | null {
  const [tier, ciclo] = (plano ?? "").split("_");
  if (tier !== "controle" && tier !== "projete") return null;
  if (ciclo === "mensal") return TIERS_PAGOS[tier].precoMensal;
  if (ciclo === "anual") return TIERS_PAGOS[tier].precoAnual;
  return null;
}
