import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gerarTexto } from "@/lib/gemini.server";

const FEATURE = "plano_conteudo";
const MODELO = "gemini-pro-latest";
const LIMITE_ANUAL = 3; // 1 geração + até 2 re-gerações, teto único (ia_uso)

// Campos mínimos do Planejamento sem os quais a IA não tem o que dizer sobre
// a marca/público/oferta da Ana — pelo menos esses 3 precisam ter resposta.
const CAMPOS_ESSENCIAIS = ["mercado.perfil_cliente", "produto.lista"] as const;

export function planejamentoIncompleto(campos: Record<string, string | null | undefined>): boolean {
  const temMarca = !!(campos["marca.missao"] || campos["marca.proposito"]);
  if (!temMarca) return true;
  return CAMPOS_ESSENCIAIS.some((c) => !campos[c]);
}

export function diasDoMes(mes: number, ano: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export interface ContextoMarca {
  proposito: string;
  missao: string;
  personalidade: string;
  tom: string;
  fraseValor: string;
  perfilCliente: string;
  dores: string;
  gatilhos: string;
  posicionamento: string;
  produtos: string;
  transformacao: string;
  voz: string;
  antiExemplos: string;
  canalPrincipal: string;
}

const MESES_NOME = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const VOZ_SISTEMA = `Você é a Aimer, a cara da marca da Pólia, ajudando Ana (empreendedora, pequeno negócio) a nunca ficar sem ideia do que postar.

Regras (obrigatórias):
- Indicativo em 3ª pessoa: nunca "você" como sujeito. Tom de conversa de café, direto.
- Nunca travessão, nunca hype, nunca exclamação, nunca promessa de resultado ("esse post viraliza" é proibido).
- Cada ideia usa a marca/público/oferta reais dados abaixo — nunca genérica, nunca peça pra Ana "engajar mais" sem dizer como.
- Sem conselho fiscal, jurídico ou de investimento.
- Varie o tipo de post (feed, stories, reels, carrossel) ao longo do mês, sem repetir o mesmo tema em dias seguidos.
- Devolva SOMENTE o JSON pedido, no formato exato, sem comentário fora dele.`;

export function montarPromptMes(params: {
  mes: number;
  ano: number;
  diasNoMes: number;
  contexto: ContextoMarca;
}): { systemInstruction: string; prompt: string } {
  const { mes, ano, diasNoMes, contexto } = params;
  const partes: string[] = [
    `Mês: ${MESES_NOME[mes - 1]} de ${ano} (${diasNoMes} dias).`,
    `Marca: propósito "${contexto.proposito}", missão "${contexto.missao}", personalidade "${contexto.personalidade}", tom "${contexto.tom}", frase de valor "${contexto.fraseValor}".`,
    `Público: "${contexto.perfilCliente}". Dores: "${contexto.dores}". O que faz comprar: "${contexto.gatilhos}". Posicionamento: "${contexto.posicionamento}".`,
    `O que ela vende: "${contexto.produtos}". Transformação que entrega: "${contexto.transformacao}".`,
    `Voz de comunicação: "${contexto.voz}". Nunca diria: "${contexto.antiExemplos}". Canal principal: "${contexto.canalPrincipal}".`,
    `Gere ${diasNoMes} ideias de post, uma para cada dia do mês (dia 1 até ${diasNoMes}).`,
    `Devolva um JSON: { "dias": [{ "dia": number, "tipo": "feed"|"stories"|"reels"|"carrossel", "titulo": string (curto), "ideia": string (1-2 frases, direção do conteúdo) }] } — exatamente ${diasNoMes} itens, um por dia, em ordem.`,
  ];
  return { systemInstruction: VOZ_SISTEMA, prompt: partes.join("\n") };
}

function responseSchemaDoMes(diasNoMes: number) {
  return {
    type: "object",
    properties: {
      dias: {
        type: "array",
        minItems: diasNoMes,
        maxItems: diasNoMes,
        items: {
          type: "object",
          properties: {
            dia: { type: "integer" },
            tipo: { type: "string", enum: ["feed", "stories", "reels", "carrossel"] },
            titulo: { type: "string" },
            ideia: { type: "string" },
          },
          required: ["dia", "tipo", "titulo", "ideia"],
        },
      },
    },
    required: ["dias"],
  };
}

const tipoValido = z.enum(["feed", "stories", "reels", "carrossel"]);
const respostaMesSchema = z.object({
  dias: z.array(
    z.object({
      dia: z.number().int(),
      tipo: z.string(),
      titulo: z.string(),
      ideia: z.string(),
    }),
  ),
});

export interface DiaConteudo {
  dia: number;
  tipo: "feed" | "stories" | "reels" | "carrossel";
  titulo: string;
  ideia: string;
}

// Nunca confia cegamente no JSON da IA: valida com zod, sanitiza `tipo` pra um
// valor conhecido e descarta dias fora do intervalo esperado do mês.
export function sanearRespostaMes(json: unknown, diasNoMes: number): DiaConteudo[] {
  const parsed = respostaMesSchema.parse(json);
  return parsed.dias
    .filter((d) => d.dia >= 1 && d.dia <= diasNoMes)
    .map((d) => {
      const tipo = tipoValido.safeParse(d.tipo);
      return {
        dia: d.dia,
        tipo: tipo.success ? tipo.data : "feed",
        titulo: d.titulo,
        ideia: d.ideia,
      };
    });
}

export function precisaLembrarHoje(hoje: Date, itemDeHoje: { postado: boolean } | null): boolean {
  if (!itemDeHoje) return false;
  return !itemDeHoje.postado;
}

const gerarPlanoConteudoInput = z.object({
  ano: z.number().int().min(2020),
});

export type ResultadoPlanoConteudo =
  | { ok: true; totalDias: number }
  | {
      ok: false;
      motivo:
        | "manutencao"
        | "teto_atingido"
        | "falha_ia"
        | "planejamento_incompleto"
        | "plano_insuficiente";
    };

export const gerarPlanoConteudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => gerarPlanoConteudoInput.parse(input))
  .handler(async ({ context, data }): Promise<ResultadoPlanoConteudo> => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plano")
      .eq("id", context.userId)
      .maybeSingle();

    if (profile?.plano !== "projete") {
      return { ok: false, motivo: "plano_insuficiente" };
    }

    const { data: flag } = await supabaseAdmin
      .from("feature_flags" as never)
      .select("enabled")
      .eq("key", "ia_plano_conteudo_ativo")
      .maybeSingle();
    if ((flag as { enabled: boolean } | null)?.enabled === false) {
      return { ok: false, motivo: "manutencao" };
    }

    const { data: camposRaw } = await supabaseAdmin
      .from("planejamento_campos")
      .select("campo, valor")
      .eq("user_id", context.userId);

    const campos: Record<string, string | null> = {};
    for (const c of (camposRaw ?? []) as { campo: string; valor: string | null }[]) {
      campos[c.campo] = c.valor;
    }

    if (planejamentoIncompleto(campos)) {
      return { ok: false, motivo: "planejamento_incompleto" };
    }

    const contexto: ContextoMarca = {
      proposito: campos["marca.proposito"] ?? "",
      missao: campos["marca.missao"] ?? "",
      personalidade: campos["marca.personalidade"] ?? "",
      tom: campos["marca.tom"] ?? "",
      fraseValor: campos["marca.frase_valor"] ?? "",
      perfilCliente: campos["mercado.perfil_cliente"] ?? "",
      dores: campos["mercado.dores"] ?? "",
      gatilhos: campos["mercado.gatilhos"] ?? "",
      posicionamento: campos["mercado.posicionamento"] ?? "",
      produtos: campos["produto.lista"] ?? "",
      transformacao: campos["produto.transformacao"] ?? "",
      voz: campos["caderno.voz"] ?? "",
      antiExemplos: campos["caderno.anti_exemplos"] ?? "",
      canalPrincipal: campos["caderno.canal_principal"] ?? "",
    };

    const periodo = String(data.ano);
    const { data: liberado } = await supabaseAdmin.rpc(
      "incrementar_ia_uso" as never,
      {
        p_user_id: context.userId,
        p_feature: FEATURE,
        p_periodo: periodo,
        p_limite: LIMITE_ANUAL,
      } as never,
    );
    if (!liberado) {
      return { ok: false, motivo: "teto_atingido" };
    }

    // Dispara os 12 meses em paralelo — sequencial estouraria a paciência de
    // qualquer uma (até 20s por chamada x 12). Tudo ou nada: qualquer mês que
    // falhe (mesmo após o retry embutido em gerarTexto) derruba a geração
    // inteira, sem inserir nada — evita um plano incoerente com meses faltando.
    const chamadas = Array.from({ length: 12 }, async (_, i) => {
      const mes = i + 1;
      const diasNoMes = diasDoMes(mes, data.ano);
      const { systemInstruction, prompt } = montarPromptMes({
        mes,
        ano: data.ano,
        diasNoMes,
        contexto,
      });
      const resultadoIa = await gerarTexto({
        modelo: MODELO,
        systemInstruction,
        prompt,
        responseSchema: responseSchemaDoMes(diasNoMes),
      });
      const json = JSON.parse(resultadoIa.texto);
      const dias = sanearRespostaMes(json, diasNoMes);
      if (dias.length !== diasNoMes) {
        throw new Error(`Mês ${mes}: esperava ${diasNoMes} dias, recebeu ${dias.length}`);
      }
      return { mes, dias, tokensIn: resultadoIa.tokensIn, tokensOut: resultadoIa.tokensOut };
    });

    try {
      const resultadosPorMes = await Promise.all(chamadas);

      const linhas = resultadosPorMes.flatMap(({ mes, dias }) =>
        dias.map((d) => ({
          user_id: context.userId,
          ano: data.ano,
          data: `${data.ano}-${String(mes).padStart(2, "0")}-${String(d.dia).padStart(2, "0")}`,
          tipo: d.tipo,
          titulo: d.titulo,
          ideia: d.ideia,
        })),
      );

      await supabaseAdmin
        .from("ia_plano_conteudo" as never)
        .delete()
        .eq("user_id", context.userId)
        .eq("ano", data.ano);
      await supabaseAdmin.from("ia_plano_conteudo" as never).insert(linhas as never);

      await supabaseAdmin.from("ia_geracoes" as never).insert(
        resultadosPorMes.map((r) => ({
          user_id: context.userId,
          feature: FEATURE,
          modelo: MODELO,
          tokens_in: r.tokensIn,
          tokens_out: r.tokensOut,
          sucesso: true,
        })) as never,
      );

      return { ok: true, totalDias: linhas.length };
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
          modelo: MODELO,
          sucesso: false,
          erro: erro instanceof Error ? erro.message : String(erro),
        } as never),
      ]);
      return { ok: false, motivo: "falha_ia" };
    }
  });
