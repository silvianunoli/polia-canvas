import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gerarTexto } from "@/lib/gemini.server";
import { flagAtivaServidor } from "@/lib/flags.server";
import { MODULOS_SEM_IA, secaoPorId, secoesDoModulo } from "@/lib/planejamento";

const FEATURE = "planejamento";

// Modelo/versão a confirmar na hora do deploy (a linha do Gemini muda rápido —
// ver fundação da Fase 3). Grátis na linha barata; Premium/Pro na melhor.
const MODELO_FLASH = "gemini-flash-latest";
const MODELO_PRO = "gemini-pro-latest";

interface ConfigPlano {
  modelo: string;
  limite: number;
}

// Tetos confirmados: Grátis 1/mês, Premium 30/mês, Pro 60/mês. Beta
// (contas legado) recebe o mesmo teto generoso do Pro — nunca ilimitado
// de verdade, mesmo pra conta interna, pra sempre passar pelo contador.
const CONFIG_POR_PLANO: Record<string, ConfigPlano> = {
  confere: { modelo: MODELO_FLASH, limite: 1 },
  controle: { modelo: MODELO_PRO, limite: 30 },
  projete: { modelo: MODELO_PRO, limite: 60 },
  beta: { modelo: MODELO_PRO, limite: 60 },
};

export function configDoPlano(plano: string | null | undefined): ConfigPlano {
  return CONFIG_POR_PLANO[plano ?? ""] ?? CONFIG_POR_PLANO.confere;
}

// "Mês de calendário" contado no relógio do servidor (UTC) — mesma
// convenção simples de período de cobrança da maioria dos SaaS. Um caso de
// borda perto da virada do mês num fuso muito adiantado/atrasado de UTC pode
// discordar em poucas horas do "mês" que a usuária sente localmente; aceitável
// pro v1 (documentado, não uma omissão silenciosa).
export function periodoAtual(agora: Date): string {
  const ano = agora.getUTCFullYear();
  const mes = String(agora.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

/**
 * Teto de tamanho do rascunho (05/10/2026): o prompt já pede até 600
 * caracteres, isto é a trava se o modelo passar. Corta no fim da última frase
 * que cabe, nunca no meio de palavra.
 */
export const LIMITE_CARACTERES_RASCUNHO = 700;

export function limitarTamanho(texto: string, max = LIMITE_CARACTERES_RASCUNHO): string {
  const t = texto.trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  let fimFrase = -1;
  for (const m of corte.matchAll(/[.?!]\s/g)) fimFrase = m.index ?? fimFrase;
  if (fimFrase > max * 0.5) return corte.slice(0, fimFrase + 1).trim();
  const fimPalavra = corte.lastIndexOf(" ");
  return `${corte.slice(0, fimPalavra > 0 ? fimPalavra : max).trim()}…`;
}

export function contextoInsuficiente(
  businessType: string | null | undefined,
  produtosCount: number,
): boolean {
  return !businessType && produtosCount === 0;
}

// Resposta vazia ou curta demais pra ser um rascunho de verdade — tratada
// como falha técnica (estorna a cota), não como sucesso ruim.
export function respostaValida(texto: string): boolean {
  return texto.trim().length >= 10;
}

const VOZ_SISTEMA = `Você escreve rascunhos de campos do Planejamento de marca da Pólia One, um app pra empreendedoras (Ana) organizarem o negócio.

Regras de voz (obrigatórias, não são sugestão):
- Indicativo em 3ª pessoa: nunca use "você" como sujeito da frase. Use imperativo sem pronome ou reestruture.
- Tom de conversa de café: direto, concreto, sem hype. Nunca "transforme", "revolucione", "✨", exclamação, positividade forçada.
- Nunca use travessão (—) nem meia-risca (–) na resposta. Use vírgula, dois pontos ou ponto final. Essa regra não tem exceção.
- É um RASCUNHO pra ela editar, não uma resposta fechada e perfeita: pode ser mais curto e específico do que genérico e bonito.
- No máximo 600 caracteres (umas 4 frases curtas). Passou disso, corte o que for genérico.
- Responda SÓ com o texto do rascunho, sem comentário, sem aspas, sem "aqui está".`;

interface ContextoNegocio {
  businessType: string | null;
  businessName: string | null;
  produtos: { nome: string; tipo: string; descricao: string | null }[];
  camposModulo: { campo: string; valor: string | null }[];
}

export function montarPrompt(
  perguntaLabel: string,
  ctx: ContextoNegocio,
  textoAtual = "",
): { systemInstruction: string; prompt: string } {
  const partes: string[] = [];
  partes.push(`Pergunta do Planejamento: "${perguntaLabel}"`);
  if (ctx.businessName) partes.push(`Nome do negócio: ${ctx.businessName}`);
  if (ctx.businessType) partes.push(`Tipo de negócio: ${ctx.businessType}`);
  if (ctx.produtos.length > 0) {
    partes.push(
      `Produtos/serviços já cadastrados: ${ctx.produtos
        .map((p) => `${p.nome} (${p.tipo})${p.descricao ? ": " + p.descricao : ""}`)
        .join("; ")}`,
    );
  }
  const outrasRespostas = ctx.camposModulo.filter((c) => c.valor?.trim());
  if (outrasRespostas.length > 0) {
    partes.push(
      `Outras respostas já dadas nesse mesmo módulo do Planejamento:\n${outrasRespostas
        .map((c) => `- ${c.campo}: ${c.valor}`)
        .join("\n")}`,
    );
  }
  // Desde 05/10/2026 a IA complementa o que a empreendedora escreveu, não
  // inventa do zero: sem o texto dela o rascunho saía genérico e estranho.
  if (textoAtual.trim()) {
    partes.push(
      `O que a empreendedora já escreveu nessa pergunta (é a base, não descarte):
${textoAtual.trim()}`,
    );
    partes.push(
      "Complete e organize esse texto: mantenha as ideias, os fatos e a voz dela, desenvolva o que estiver solto e não invente fato que ela não disse.",
    );
  } else {
    partes.push(
      "Rascunhe a resposta pra essa pergunta específica, coerente com o que já foi dito.",
    );
  }
  return { systemInstruction: VOZ_SISTEMA, prompt: partes.join("\n\n") };
}

const gerarRascunhoInput = z.object({
  secao: z.string(),
  perguntaIdx: z.number().int().min(0),
  textoAtual: z.string().max(4000).default(""),
});

export type ResultadoGeracao =
  | { ok: true; texto: string }
  | {
      ok: false;
      motivo:
        | "manutencao"
        | "contexto_insuficiente"
        | "cota_atingida"
        | "falha_ia"
        | "pergunta_invalida"
        | "sem_texto";
    };

export const gerarRascunhoPlanejamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => gerarRascunhoInput.parse(input))
  .handler(async ({ context, data }): Promise<ResultadoGeracao> => {
    const secaoInfo = secaoPorId(data.secao);
    const pergunta = secaoInfo?.perguntas[data.perguntaIdx];
    if (
      !secaoInfo ||
      !pergunta ||
      pergunta.tipo === "moeda" ||
      MODULOS_SEM_IA.has(secaoInfo.modulo)
    ) {
      return { ok: false, motivo: "pergunta_invalida" };
    }
    // A tela já bloqueia o botão com o campo vazio; aqui é a mesma regra no
    // servidor, antes de gastar a cota.
    if (!data.textoAtual.trim()) {
      return { ok: false, motivo: "sem_texto" };
    }

    const [{ data: profile }, iaLigada, { data: produtos }, { data: camposModulo }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("plano, business_type, business_name")
          .eq("id", context.userId)
          .maybeSingle(),
        flagAtivaServidor("ia_planejamento_ativo", context.userId, true),
        supabaseAdmin
          .from("produtos")
          .select("nome, tipo, descricao")
          .eq("user_id", context.userId)
          .eq("arquivado", false),
        supabaseAdmin
          .from("planejamento_campos" as never)
          .select("campo, valor")
          .eq("user_id", context.userId)
          .in(
            "campo",
            secoesDoModulo(secaoInfo.modulo)
              .flatMap((s) => s.perguntas.map((p) => p.campo))
              .filter((c, i, arr) => arr.indexOf(c) === i),
          ),
      ]);

    if (!iaLigada) {
      return { ok: false, motivo: "manutencao" };
    }

    const produtosLista = (produtos ?? []) as ContextoNegocio["produtos"];
    if (contextoInsuficiente(profile?.business_type, produtosLista.length)) {
      return { ok: false, motivo: "contexto_insuficiente" };
    }

    const { modelo, limite } = configDoPlano(profile?.plano);
    const periodo = periodoAtual(new Date());

    const { data: liberado } = await supabaseAdmin.rpc(
      "incrementar_ia_uso" as never,
      {
        p_user_id: context.userId,
        p_feature: FEATURE,
        p_periodo: periodo,
        p_limite: limite,
      } as never,
    );
    if (!liberado) {
      return { ok: false, motivo: "cota_atingida" };
    }

    const { systemInstruction, prompt } = montarPrompt(
      pergunta.label,
      {
        businessType: profile?.business_type ?? null,
        businessName: profile?.business_name ?? null,
        produtos: produtosLista,
        camposModulo: (camposModulo ?? []) as ContextoNegocio["camposModulo"],
      },
      data.textoAtual,
    );

    try {
      const resultado = await gerarTexto({ modelo, systemInstruction, prompt });
      if (!respostaValida(resultado.texto)) {
        throw new Error("Resposta vazia ou curta demais.");
      }
      await supabaseAdmin.from("ia_geracoes" as never).insert({
        user_id: context.userId,
        feature: FEATURE,
        modelo,
        tokens_in: resultado.tokensIn,
        tokens_out: resultado.tokensOut,
        sucesso: true,
      } as never);
      return { ok: true, texto: limitarTamanho(resultado.texto) };
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
          modelo,
          sucesso: false,
          erro: erro instanceof Error ? erro.message : String(erro),
        } as never),
      ]);
      return { ok: false, motivo: "falha_ia" };
    }
  });

/**
 * Quanto da cota de IA do Planejamento ela já usou no mês, pra tela mostrar
 * a barra e avisar perto do limite (05/10/2026). Só leitura.
 */
export const usoIaPlanejamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ usado: number; limite: number; plano: string }> => {
    const [{ data: profile }, { data: uso }] = await Promise.all([
      supabaseAdmin.from("profiles").select("plano").eq("id", context.userId).maybeSingle(),
      supabaseAdmin
        .from("ia_uso" as never)
        .select("contagem")
        .eq("user_id", context.userId)
        .eq("feature", FEATURE)
        .eq("periodo", periodoAtual(new Date()))
        .maybeSingle(),
    ]);
    const plano = (profile?.plano as string | null) ?? "confere";
    return {
      usado: ((uso as { contagem: number } | null)?.contagem ?? 0) as number,
      limite: configDoPlano(plano).limite,
      plano,
    };
  });
