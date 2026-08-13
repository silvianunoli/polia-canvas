import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gerarTexto } from "@/lib/gemini.server";
import { moedaParaPrompt } from "@/lib/moeda";
import {
  calcularQuantoSobra,
  calcularSobraPct,
  taxasDoBreakdown,
} from "@/lib/precificacao.functions";
import type { CalculadoraBreakdown } from "@/lib/precificacao.functions";

const FEATURE = "raiox";
const MODELO_PRO = "gemini-pro-latest";
const LIMITE_MENSAL = 3; // 1 geração + até 2 re-gerações, teto único (ia_uso)

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
// taxasDoBreakdown/calcularQuantoSobra de precificacao.functions.ts, a mesma
// conta usada no card de Produtos. Produto sem preço de venda é ignorado
// (não dá pra saber a sobra de algo sem preço).
export function produtosPorSobra(produtos: ProdutoResumo[]): ProdutoPorSobra[] {
  return produtos
    .filter((p) => p.preco_venda > 0)
    .map((p) => {
      const { taxaVendaPct, impostosPct } = taxasDoBreakdown(p.calculadora_breakdown);
      const custo = p.preco_custo ?? 0;
      const sobraPct = calcularSobraPct({
        precoVenda: p.preco_venda,
        precoCusto: custo,
        taxaVendaPct,
        impostosPct,
      });
      return { nome: p.nome, sobraPct };
    })
    .sort((a, b) => b.sobraPct - a.sobraPct);
}

const VOZ_SISTEMA = `Você é a Aimer, a cara da marca da Pólia, lendo o mês que passou pra Ana (empreendedora, pequeno negócio).

Regras (obrigatórias):
- Indicativo em 3ª pessoa: nunca "você" como sujeito. Tom de conversa de café, curto, ponto importante primeiro.
- Nunca travessão, nunca hype, nunca exclamação.
- Sempre fala como sugestão, nunca promessa de resultado ("faça X e vai sobrar Y" é proibido).
- NUNCA inventa número — use só os números reais dados abaixo. Se o dado for ralo, diga que é ralo.
- Repita o número EXATAMENTE no formato recebido (R$ 8.780,00), com ponto de milhar e vírgula decimal. Nunca reescreva como 8780.00 nem arredonde.
- Porcentagem em algarismo com o símbolo: "73%", nunca "73 por cento".
- Diga "quanto sobra" ou "sobra", NUNCA "margem" — é a palavra da casa e a única que a Ana usa.
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
      "Aviso: esse mês tem poucos lançamentos — a leitura é limitada, diga isso na resposta.",
    );
  }
  partes.push(
    `Devolva um JSON: { "placar": string (1-2 frases, o resultado em número e tom), "causas": string (1 parágrafo curto, o que puxou pra cima/baixo), "sugestoes": [{ "texto": string, "rota": "produtos"|"financeiro"|"metas"|"clientes"|null }] } — 1 a 3 sugestões.`,
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
    }
  | {
      ok: false;
      motivo:
        | "manutencao"
        | "teto_atingido"
        | "falha_ia"
        | "dado_insuficiente"
        | "mes_nao_fechado"
        | "plano_insuficiente";
    };

export const gerarRaioX = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => gerarRaioXInput.parse(input))
  .handler(async ({ context, data }): Promise<ResultadoRaioX> => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plano")
      .eq("id", context.userId)
      .maybeSingle();

    if (profile?.plano !== "projete") {
      return { ok: false, motivo: "plano_insuficiente" };
    }

    const hoje = new Date();
    const mesAtual = hoje.getUTCMonth() + 1;
    const anoAtual = hoje.getUTCFullYear();
    if (data.mes === mesAtual && data.ano === anoAtual && !data.forcar) {
      return { ok: false, motivo: "mes_nao_fechado" };
    }

    const { data: flag } = await supabaseAdmin
      .from("feature_flags" as never)
      .select("enabled")
      .eq("key", "ia_raiox_ativo")
      .maybeSingle();
    if ((flag as { enabled: boolean } | null)?.enabled === false) {
      return { ok: false, motivo: "manutencao" };
    }

    const [{ data: lancamentos }, { data: meta }, { data: produtos }] = await Promise.all([
      supabaseAdmin.from("lancamentos").select("tipo, valor, data").eq("user_id", context.userId),
      supabaseAdmin
        .from("metas")
        .select("valor_alvo, valor_atual")
        .eq("user_id", context.userId)
        .eq("titulo", "Meta do mês")
        .maybeSingle(),
      supabaseAdmin
        .from("produtos")
        .select("nome, preco_venda, preco_custo, calculadora_breakdown")
        .eq("user_id", context.userId)
        .eq("arquivado", false),
    ]);

    const { entradas, saidas, resultado, totalLancamentos } = resultadoDoMes(
      (lancamentos ?? []) as LancamentoResumo[],
      data.mes,
      data.ano,
    );

    if (totalLancamentos === 0) {
      return { ok: false, motivo: "dado_insuficiente" };
    }
    const dadoRalo = totalLancamentos <= 2;

    const mesLabel = periodoMensal(new Date(Date.UTC(data.ano, data.mes - 1, 1)));
    const contexto: ContextoRaioX = {
      mes: mesLabel,
      entradas,
      saidas,
      resultado,
      metaAlvo: meta?.valor_alvo ?? null,
      metaAtual: meta?.valor_atual ?? null,
      produtos: produtosPorSobra((produtos ?? []) as ProdutoResumo[]),
      dadoRalo,
    };

    const periodo = periodoMensal(new Date());
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

      await supabaseAdmin.from("ia_raiox" as never).upsert(
        {
          user_id: context.userId,
          mes: mesLabel,
          placar: saneado.placar,
          causas: saneado.causas,
          sugestoes: saneado.sugestoes,
          dado_ralo: dadoRalo,
        } as never,
        { onConflict: "user_id,mes" } as never,
      );
      await supabaseAdmin.from("ia_geracoes" as never).insert({
        user_id: context.userId,
        feature: FEATURE,
        modelo: MODELO_PRO,
        tokens_in: resultadoIa.tokensIn,
        tokens_out: resultadoIa.tokensOut,
        sucesso: true,
      } as never);

      return { ok: true, dadoRalo, ...saneado };
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
