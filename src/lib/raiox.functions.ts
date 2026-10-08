import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gerarTexto } from "@/lib/gemini.server";
import { flagAtivaServidor } from "@/lib/flags.server";
import { moedaParaPrompt } from "@/lib/moeda";
import { sobraDoProduto } from "@/lib/precificacao.functions";
import type { CalculadoraBreakdown } from "@/lib/precificacao.functions";
import { buscarMetaDoMes } from "@/lib/metaDoMes";
import { mesAnoEmBrasilia, mesEmBrasilia } from "@/lib/data.functions";
import { intervaloDoMes, lerTodasAsPaginas } from "@/lib/leituraPaginada";
import { LIMITE_RAIOX_MENSAL, planoGeraRaioX, type MotivoRaioX } from "@/lib/raioxMotivo";
import { faltaSchema, gravarGeracaoRaioX } from "@/lib/raioxGeracoes";
import {
  avisosDoRaioX,
  escolherMetaDoRaioX,
  mesJaPassou,
  produtosDoRaioX,
  type ProdutoDoBanco,
} from "@/lib/raioxHistorico";

const FEATURE = "raiox";
const MODELO_PRO = "gemini-pro-latest";
const LIMITE_MENSAL = LIMITE_RAIOX_MENSAL; // 1 geração + até 2 re-gerações, teto único (ia_uso)

// Só formata um mês já escolhido (data montada com Date.UTC no dia 1). Pra
// saber o mês de AGORA use mesEmBrasilia: o Worker roda em UTC e o mês virava
// às 21h de Brasília.
export function periodoMensal(agora: Date): string {
  const ano = agora.getUTCFullYear();
  const mes = String(agora.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

interface LancamentoResumo {
  tipo: string;
  valor: number;
  data: string; // "YYYY-MM-DD"
}

// Mesma lógica isolada usada em aimer.functions.ts (copiada de propósito, não
// importada — evita acoplar duas features de IA por uma conta trivial).
export function resultadoDoMes(
  lancamentos: LancamentoResumo[],
  mes: number,
  ano: number,
): { entradas: number; saidas: number; resultado: number; totalLancamentos: number } {
  let entradas = 0;
  let saidas = 0;
  let total = 0;
  for (const l of lancamentos) {
    const [y, m] = l.data.split("-").map(Number);
    if (y !== ano || m !== mes) continue;
    total++;
    if (l.tipo === "entrada") entradas += Number(l.valor);
    else if (l.tipo === "saida") saidas += Number(l.valor);
  }
  return { entradas, saidas, resultado: entradas - saidas, totalLancamentos: total };
}

interface ProdutoResumo {
  nome: string;
  preco_venda: number;
  preco_custo: number | null;
  calculadora_breakdown: CalculadoraBreakdown | null;
}

export interface ProdutoPorSobra {
  nome: string;
  sobraPct: number;
}

// Rankeia produtos salvos pela sobra real (maior primeiro) — reaproveita
// sobraDoProduto de precificacao.functions.ts (taxas do breakdown salvo), a mesma
// conta usada no card de Produtos. Produto sem preço de venda é ignorado
// (não dá pra saber a sobra de algo sem preço).
export function produtosPorSobra(produtos: ProdutoResumo[]): ProdutoPorSobra[] {
  return produtos
    .filter((p) => p.preco_venda > 0)
    .map((p) => {
      // sobraDoProduto devolve o % com sinal: calcularSobraPct travava em 0 e
      // produto com prejuízo ia pra IA como "(0%)".
      const sobra = sobraDoProduto({
        precoVenda: p.preco_venda,
        precoCusto: p.preco_custo ?? 0,
        breakdown: p.calculadora_breakdown,
      });
      return { nome: p.nome, sobraPct: sobra?.pct ?? 0 };
    })
    .sort((a, b) => b.sobraPct - a.sobraPct);
}

const VOZ_SISTEMA = `Você é a assistente da Pólia One, lendo o mês que passou pra Ana (empreendedora, pequeno negócio).

Regras (obrigatórias):
- Indicativo em 3ª pessoa: nunca "você" como sujeito. Tom de conversa de café, curto, ponto importante primeiro.
- Nunca hype, nunca exclamação.
- Nunca use travessão (—) nem meia-risca (–) na resposta. Use vírgula, dois pontos ou ponto final. Essa regra não tem exceção.
- Sempre fala como sugestão, nunca promessa de resultado ("faça X e vai sobrar Y" é proibido).
- NUNCA inventa número: use só os números reais dados abaixo. Se o dado for ralo, diga que é ralo.
- Repita o número EXATAMENTE no formato recebido (R$ 8.780,00), com ponto de milhar e vírgula decimal. Nunca reescreva como 8780.00 nem arredonde.
- Porcentagem em algarismo com o símbolo: "73%", nunca "73 por cento".
- Diga "quanto sobra" ou "sobra", NUNCA "margem": é a palavra da casa e a única que a Ana usa.
- Sem conselho fiscal, jurídico ou de investimento.
- Cada sugestão tem que ser concreta e acionável (apontar o que fazer), nunca abstrata.
- Devolva SOMENTE o JSON pedido, no formato exato, sem comentário fora dele.`;

export interface ContextoRaioX {
  mes: string;
  entradas: number;
  saidas: number;
  resultado: number;
  metaAlvo: number | null;
  metaAtual: number | null;
  produtos: ProdutoPorSobra[];
  dadoRalo: boolean;
  /** Frases fixas de limite da leitura (meta/preço de hoje no lugar do mês). */
  avisos?: string[];
}

export function montarPromptRaioX(ctx: ContextoRaioX): {
  systemInstruction: string;
  prompt: string;
} {
  const partes: string[] = [
    `Mês analisado: ${ctx.mes}`,
    `Entradas: ${moedaParaPrompt(ctx.entradas)}`,
    `Saídas: ${moedaParaPrompt(ctx.saidas)}`,
    `Resultado (quanto sobrou): ${moedaParaPrompt(ctx.resultado)}`,
  ];
  if (ctx.metaAlvo != null) {
    partes.push(
      `Meta do mês: ${moedaParaPrompt(ctx.metaAlvo)} (atingido: ${moedaParaPrompt(ctx.metaAtual ?? 0)})`,
    );
  }
  if (ctx.produtos.length > 0) {
    partes.push(
      `Produtos por sobra (maior pra menor): ${ctx.produtos
        .map((p) => `${p.nome} (${p.sobraPct}%)`)
        .join(", ")}`,
    );
  }
  if (ctx.dadoRalo) {
    partes.push(
      "Aviso: esse mês tem poucos lançamentos, a leitura é limitada. Diga isso na resposta.",
    );
  }
  // QA-30: a tela já mostra a frase; aqui é pra a IA não tratar o número de
  // hoje como se fosse o daquele mês.
  for (const aviso of ctx.avisos ?? []) {
    partes.push(
      `Limite dos dados: ${aviso} Não afirme que esse valor era o daquele mês; a tela já mostra esse aviso, não precisa repetir a frase.`,
    );
  }
  partes.push(
    `Devolva um JSON: { "placar": string (1-2 frases, o resultado em número e tom), "causas": string (1 parágrafo curto, o que puxou pra cima/baixo), "sugestoes": [{ "texto": string, "rota": "produtos"|"financeiro"|"metas"|"clientes"|null }] }. De 1 a 3 sugestões.`,
  );
  return { systemInstruction: VOZ_SISTEMA, prompt: partes.join("\n") };
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    placar: { type: "string" },
    causas: { type: "string" },
    sugestoes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          texto: { type: "string" },
          rota: {
            type: "string",
            enum: ["produtos", "financeiro", "metas", "clientes", "nenhuma"],
          },
        },
        required: ["texto", "rota"],
      },
    },
  },
  required: ["placar", "causas", "sugestoes"],
};

const rotaValida = z.enum(["produtos", "financeiro", "metas", "clientes"]);
const respostaIaSchema = z.object({
  placar: z.string(),
  causas: z.string(),
  sugestoes: z
    .array(
      z.object({
        texto: z.string(),
        rota: z.string().nullable().optional(),
      }),
    )
    .max(3),
});

// Nunca confia cegamente no JSON da IA: valida com zod e sanitiza `rota`
// pra um dos valores conhecidos (ou null), mesmo que o "schema forçado" do
// SDK já ajude — é defesa em profundidade, não redundância inútil.
export function sanearRespostaRaioX(json: unknown): {
  placar: string;
  causas: string;
  sugestoes: { texto: string; rota: string | null }[];
} {
  const parsed = respostaIaSchema.parse(json);
  return {
    placar: parsed.placar,
    causas: parsed.causas,
    sugestoes: parsed.sugestoes.map((s) => {
      const rota = rotaValida.safeParse(s.rota);
      return { texto: s.texto, rota: rota.success ? rota.data : null };
    }),
  };
}

const gerarRaioXInput = z.object({
  mes: z.number().int().min(1).max(12),
  ano: z.number().int().min(2020),
  forcar: z.boolean().optional().default(false),
});

export type ResultadoRaioX =
  | {
      ok: true;
      placar: string;
      causas: string;
      sugestoes: { texto: string; rota: string | null }[];
      dadoRalo: boolean;
      avisos: string[];
    }
  | {
      ok: false;
      motivo: MotivoRaioX;
    };

/**
 * Meta do mês guardada pra um mês passado (meta_do_mes_historico). Qualquer
 * falha vira null: a leitura cai na meta de hoje e o aviso aparece, em vez de
 * derrubar o raio-x.
 */
async function lerMetaDoHistorico(userId: string, mes: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("meta_do_mes_historico" as never)
    .select("valor_alvo")
    .eq("user_id", userId)
    .eq("mes", mes)
    .maybeSingle();
  if (error) {
    if (!faltaSchema(error)) console.error("raiox: falha ao ler meta do histórico", error);
    return null;
  }
  const valor = Number((data as { valor_alvo?: unknown } | null)?.valor_alvo);
  return data && Number.isFinite(valor) ? valor : null;
}

interface LinhaRaioX {
  user_id: string;
  mes: string;
  placar: string;
  causas: string;
  sugestoes: { texto: string; rota: string | null }[];
  dado_ralo: boolean;
}

/**
 * Grava cada geração como uma linha nova (histórico do mês, 07/10/2026).
 * Antes da migração 20261008200000 a UNIQUE (user_id, mes) ainda existe e o
 * insert num mês que já tem raio-x volta 23505: aí atualiza a linha que
 * existe (comportamento antigo), com criado_em de agora pra lista de gerações
 * mostrar a hora certa. Sem a coluna `avisos` grava sem ela. Falha aqui só
 * vai pro log: a leitura já saiu e volta pra tela de qualquer jeito.
 */
async function salvarRaioX(linha: LinhaRaioX, avisos: string[]): Promise<void> {
  const resultado = await gravarGeracaoRaioX(linha, avisos, {
    inserir: (valores) => supabaseAdmin.from("ia_raiox" as never).insert(valores as never),
    atualizar: (valores) =>
      supabaseAdmin
        .from("ia_raiox" as never)
        .update({ ...valores, criado_em: new Date().toISOString() } as never)
        .eq("user_id", linha.user_id)
        .eq("mes", linha.mes),
  });
  if (resultado.modo === "falhou") console.error("raiox: falha ao salvar", resultado.error);
}

/**
 * Quantas gerações de raio-x ela já usou no mês, pra tela mostrar quantas
 * restam e avisar antes da última (07/10/2026). Só leitura, da mesma fonte que
 * gerarRaioX cobra: ia_uso, feature "raiox", mês de Brasília.
 */
export const usoRaioX = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ usado: number; limite: number; periodo: string }> => {
    const periodo = mesEmBrasilia();
    const { data, error } = await supabaseAdmin
      .from("ia_uso" as never)
      .select("contagem")
      .eq("user_id", context.userId)
      .eq("feature", FEATURE)
      .eq("periodo", periodo)
      .maybeSingle();
    // Falha de leitura não pode virar "restam 3": a tela cai no texto genérico.
    if (error) throw new Error("Falha ao ler o uso do raio-x");
    const usado = Number((data as { contagem?: unknown } | null)?.contagem ?? 0);
    return { usado: Number.isFinite(usado) ? usado : 0, limite: LIMITE_MENSAL, periodo };
  });

export const gerarRaioX = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => gerarRaioXInput.parse(input))
  .handler(async ({ context, data }): Promise<ResultadoRaioX> => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plano")
      .eq("id", context.userId)
      .maybeSingle();

    // QA-30: beta é acesso total e a tela já abria pra ela, mas aqui só
    // "projete" passava e a conta beta via a tela vazia sem explicação.
    if (!planoGeraRaioX(profile?.plano)) {
      return { ok: false, motivo: "plano_insuficiente" };
    }

    // Mês de Brasília, não UTC: às 21h do último dia o mês já contava como
    // fechado, e no dia 1º até as 21h o mês passado ainda contava como aberto.
    const { mes: mesAtual, ano: anoAtual } = mesAnoEmBrasilia();
    if (data.mes === mesAtual && data.ano === anoAtual && !data.forcar) {
      return { ok: false, motivo: "mes_nao_fechado" };
    }

    if (!(await flagAtivaServidor("ia_raiox_ativo", context.userId, true))) {
      return { ok: false, motivo: "manutencao" };
    }

    // Só o mês pedido, página por página: sem filtro, a leitura trazia todos os
    // lançamentos da conta e o PostgREST corta em 1.000 linhas sem avisar, o
    // que deixava o mês com soma parcial em quem tem histórico longo.
    const { inicio, fimExclusivo } = intervaloDoMes(data.ano, data.mes);
    const lerLancamentos = lerTodasAsPaginas<LancamentoResumo>(
      (de, ate) =>
        supabaseAdmin
          .from("lancamentos")
          .select("tipo, valor, data")
          .eq("user_id", context.userId)
          .gte("data", inicio)
          .lt("data", fimExclusivo)
          .order("data", { ascending: true })
          .order("id", { ascending: true })
          .range(de, ate) as unknown as PromiseLike<{
          data: LancamentoResumo[] | null;
          error: unknown;
        }>,
    ).then(
      (linhas) => ({ data: linhas }),
      (erro) => {
        console.error("raiox: falha ao ler lançamentos", erro);
        return null;
      },
    );
    const mesLabel = periodoMensal(new Date(Date.UTC(data.ano, data.mes - 1, 1)));
    const mesPassado = mesJaPassou(
      { ano: data.ano, mes: data.mes },
      { ano: anoAtual, mes: mesAtual },
    );
    const [leitura, { data: meta }, { data: produtos }, metaDoHistorico] = await Promise.all([
      lerLancamentos,
      buscarMetaDoMes(supabaseAdmin, context.userId),
      supabaseAdmin
        .from("produtos")
        .select(
          "nome, preco_venda, preco_custo, calculadora_breakdown, historico_precos, preco_atualizado_em, created_at, updated_at",
        )
        .eq("user_id", context.userId)
        .eq("arquivado", false),
      mesPassado ? lerMetaDoHistorico(context.userId, mesLabel) : Promise.resolve(null),
    ]);

    // Leitura que falha não pode virar "mês sem lançamento" nem soma parcial.
    if (!leitura) {
      return { ok: false, motivo: "falha_ia" };
    }

    const { entradas, saidas, resultado, totalLancamentos } = resultadoDoMes(
      leitura.data,
      data.mes,
      data.ano,
    );

    if (totalLancamentos === 0) {
      return { ok: false, motivo: "dado_insuficiente" };
    }
    const dadoRalo = totalLancamentos <= 2;

    // QA-30: mês passado usa a meta e o preço daquele mês quando ficaram
    // guardados; quando não ficaram, usa os de hoje e diz isso numa frase.
    const escolhaMeta = escolherMetaDoRaioX({
      mesPassado,
      metaDoHistorico,
      metaDeHoje: meta?.valor_alvo ?? null,
    });
    const doMes = produtosDoRaioX(
      (produtos ?? []) as unknown as ProdutoDoBanco[],
      { ano: data.ano, mes: data.mes },
      mesPassado,
    );
    const avisos = avisosDoRaioX({
      alvo: { ano: data.ano, mes: data.mes },
      usaMetaDeHoje: escolhaMeta.usaMetaDeHoje,
      usaPrecoDeHoje: doMes.usaPrecoDeHoje,
      usaCustoDeHoje: doMes.usaCustoDeHoje,
    });
    const contexto: ContextoRaioX = {
      mes: mesLabel,
      entradas,
      saidas,
      resultado,
      metaAlvo: escolhaMeta.valorAlvo,
      // "Atingido" = entradas do mês lido, a mesma conta do Financeiro. Antes
      // ia o valor_atual de hoje, que é digitado à mão e não é do mês lido.
      metaAtual: escolhaMeta.valorAlvo != null ? entradas : null,
      produtos: produtosPorSobra(doMes.produtos),
      dadoRalo,
      avisos,
    };

    // Cota do mês no horário de Brasília (antes renovava às 21h do último dia).
    const periodo = mesEmBrasilia();
    const { data: liberado } = await supabaseAdmin.rpc(
      "incrementar_ia_uso" as never,
      {
        p_user_id: context.userId,
        p_feature: FEATURE,
        p_periodo: periodo,
        p_limite: LIMITE_MENSAL,
      } as never,
    );
    if (!liberado) {
      return { ok: false, motivo: "teto_atingido" };
    }

    const { systemInstruction, prompt } = montarPromptRaioX(contexto);

    try {
      const resultadoIa = await gerarTexto({
        modelo: MODELO_PRO,
        systemInstruction,
        prompt,
        responseSchema: RESPONSE_SCHEMA,
      });
      const json = JSON.parse(resultadoIa.texto);
      const saneado = sanearRespostaRaioX(json);

      await salvarRaioX(
        {
          user_id: context.userId,
          mes: mesLabel,
          placar: saneado.placar,
          causas: saneado.causas,
          sugestoes: saneado.sugestoes,
          dado_ralo: dadoRalo,
        },
        avisos,
      );
      await supabaseAdmin.from("ia_geracoes" as never).insert({
        user_id: context.userId,
        feature: FEATURE,
        modelo: MODELO_PRO,
        tokens_in: resultadoIa.tokensIn,
        tokens_out: resultadoIa.tokensOut,
        sucesso: true,
      } as never);

      return { ok: true, dadoRalo, avisos, ...saneado };
    } catch (erro) {
      await Promise.all([
        supabaseAdmin.rpc(
          "estornar_ia_uso" as never,
          {
            p_user_id: context.userId,
            p_feature: FEATURE,
            p_periodo: periodo,
          } as never,
        ),
        supabaseAdmin.from("ia_geracoes" as never).insert({
          user_id: context.userId,
          feature: FEATURE,
          modelo: MODELO_PRO,
          sucesso: false,
          erro: erro instanceof Error ? erro.message : String(erro),
        } as never),
      ]);
      return { ok: false, motivo: "falha_ia" };
    }
  });
