import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";
import { z } from "npm:zod@3.23.8";
import { emailPolia } from "../_shared/email-polia.ts";

// Lote mensal do Raio-x do mês (Fase 3, Projete) — chamado só por pg_cron via
// pg_net (`disparar_raiox_mensal()`, migração 20260727191000), autenticado por
// segredo compartilhado (mesmo padrão de alertas-criticos: quem chama não tem
// sessão de usuária). verify_jwt desligado — ver supabase/config.toml.
//
// IMPORTANTE: o prompt aqui precisa ficar em sincronia manual com
// `montarPromptRaioX`/`VOZ_SISTEMA` em src/lib/raiox.functions.ts (o caminho
// sob demanda, que roda no Worker Cloudflare em Node — runtime diferente
// deste Deno, não dá pra importar direto). Mudar a voz/regras muda nos dois
// arquivos no mesmo commit.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RAIOX_CRON_SECRET = Deno.env.get("RAIOX_CRON_SECRET") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MODELO_PRO = "gemini-pro-latest";
const FEATURE = "raiox";
// Sem LIMITE_MENSAL aqui de propósito (07/10/2026): a geração automática do
// mês fechado NÃO conta no limite de 3 gerações da usuária (ia_uso). O que
// impede gerar duas vezes é a checagem de "já existe raio-x desse mês" abaixo,
// e o cron roda uma vez por mês (dia 1, 09h UTC).

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function autenticado(req: Request): boolean {
  if (!RAIOX_CRON_SECRET) return false;
  return req.headers.get("x-raiox-cron-secret") === RAIOX_CRON_SECRET;
}

function periodoMensal(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

interface Lancamento {
  tipo: string;
  valor: number;
  data: string;
}

function resultadoDoMes(lancamentos: Lancamento[], mes: number, ano: number) {
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
  return { entradas, saidas, resultado: entradas - saidas, total };
}

interface Produto {
  nome: string;
  preco_venda: number;
  preco_custo: number | null;
  calculadora_breakdown: { perfil: string; valores: Record<string, string> } | null;
}

function produtosPorSobra(produtos: Produto[]) {
  return produtos
    .filter((p) => p.preco_venda > 0)
    .map((p) => {
      const n = (s?: string) => (s ? parseFloat(s.replace(",", ".")) || 0 : 0);
      const v = p.calculadora_breakdown?.valores ?? {};
      const perfil = p.calculadora_breakdown?.perfil;
      const taxaVendaPct =
        perfil === "produto"
          ? n(v.taxaVenda)
          : perfil === "encomenda"
            ? n(v.taxaVendaE)
            : n(v.taxaVendaS);
      const impostosPct =
        perfil === "produto"
          ? n(v.impostos)
          : perfil === "encomenda"
            ? n(v.impostosE)
            : n(v.impostosS);
      const custo = p.preco_custo ?? 0;
      const taxas = p.preco_venda * ((taxaVendaPct + impostosPct) / 100);
      const sobraPct = Math.max(
        0,
        Math.round(((p.preco_venda - custo - taxas) / p.preco_venda) * 100),
      );
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
- Sem conselho fiscal, jurídico ou de investimento.
- Cada sugestão tem que ser concreta e acionável (apontar o que fazer), nunca abstrata.
- Devolva SOMENTE o JSON pedido, no formato exato, sem comentário fora dele.`;

const respostaIaSchema = z.object({
  placar: z.string(),
  causas: z.string(),
  sugestoes: z
    .array(z.object({ texto: z.string(), rota: z.string().nullable().optional() }))
    .max(3),
});

const ROTAS_VALIDAS = new Set(["produtos", "financeiro", "metas", "clientes"]);

let _genai: GoogleGenAI | undefined;
function geminiClient(): GoogleGenAI {
  if (_genai) return _genai;
  if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
  _genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return _genai;
}

async function enviarEmailAviso(paraEmail: string, mesLabel: string) {
  if (!RESEND_API_KEY) return;
  const url = "https://one.usepolia.com.br/raiox";
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Pólia <naoresponda@usepolia.com.br>",
        to: paraEmail,
        subject: `Seu raio-x de ${mesLabel} está pronto`,
        text: `A Pólia One já organizou os números de ${mesLabel}.\n\nAgora você pode ver o que entrou, o que saiu, quanto sobrou e o que merece sua atenção.\n\n${url}`,
        // Este e-mail saía só como texto puro, com a URL solta no corpo — sem
        // marca e sem botão, no aviso do recurso mais caro do produto.
        html: emailPolia({
          preheader: "A Pólia One já organizou os números do mês.",
          headline: "Seu raio-x está pronto",
          paragrafos: [
            `A Pólia One já organizou os números de ${mesLabel}.`,
            "Agora você pode ver o que entrou, o que saiu, quanto sobrou e o que merece sua atenção.",
          ],
          ctaLabel: "Ver meu raio-x",
          ctaUrl: url,
        }),
      }),
    });
  } catch {
    // E-mail é best-effort — o raio-x já foi gerado e fica disponível no app
    // independente do envio dar certo.
  }
}

Deno.serve(async (req: Request) => {
  if (!autenticado(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const agora = new Date();
  // Sempre lê o mês ANTERIOR ao atual (o que acabou de fechar).
  const mesFechado = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 1, 1));
  const mes = mesFechado.getUTCMonth() + 1;
  const ano = mesFechado.getUTCFullYear();
  const mesLabel = periodoMensal(mesFechado);

  // Flag nova (founder_flags, ambiente prod): off desliga o lote inteiro;
  // on/beta com rollout parcial respeita o mesmo bucket por usuária de
  // src/lib/flags-regra.ts (sha256 de "userId:key").
  const { data: flag } = await supabaseAdmin
    .from("founder_flags")
    .select("estado, rollout_pct, beta_user_ids")
    .eq("key", "ia_raiox_ativo")
    .eq("ambiente", "prod")
    .maybeSingle();
  if (flag?.estado === "off") {
    return new Response(JSON.stringify({ ok: false, motivo: "manutencao" }), { status: 200 });
  }
  const flagLiberaPara = async (userId: string): Promise<boolean> => {
    if (!flag) return true;
    if (flag.estado === "beta" && (flag.beta_user_ids as string[]).includes(userId)) return true;
    if (flag.rollout_pct >= 100 && flag.estado === "on") return true;
    if (flag.rollout_pct <= 0) return false;
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${userId}:ia_raiox_ativo`),
    );
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return parseInt(hex.slice(0, 8), 16) % 100 < flag.rollout_pct;
  };

  const { data: usuarias } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("plano", "projete");

  let gerados = 0;
  let pulados = 0;
  let erros = 0;

  for (const u of usuarias ?? []) {
    const userId = u.id as string;
    if (!(await flagLiberaPara(userId))) {
      pulados++;
      continue;
    }

    // Desde 07/10/2026 cada geração é uma linha (histórico do mês), então o
    // mês pode ter várias: maybeSingle() daria erro com 2 linhas e o cron
    // geraria de novo. limit(1) só pergunta "tem alguma?". Erro de leitura
    // pula a usuária em vez de arriscar gerar em dobro.
    const { data: existentes, error: erroExistente } = await supabaseAdmin
      .from("ia_raiox")
      .select("id")
      .eq("user_id", userId)
      .eq("mes", mesLabel)
      .limit(1);
    if (erroExistente) {
      erros++;
      continue;
    }
    if ((existentes ?? []).length > 0) {
      pulados++;
      continue;
    }

    const [{ data: lancamentos }, { data: meta }, { data: produtos }, { data: authUser }] =
      await Promise.all([
        supabaseAdmin.from("lancamentos").select("tipo, valor, data").eq("user_id", userId),
        supabaseAdmin
          .from("metas")
          .select("valor_alvo, valor_atual")
          .eq("user_id", userId)
          .eq("titulo", "Meta do mês")
          .maybeSingle(),
        supabaseAdmin
          .from("produtos")
          .select("nome, preco_venda, preco_custo, calculadora_breakdown")
          .eq("user_id", userId)
          .eq("arquivado", false),
        supabaseAdmin.auth.admin.getUserById(userId),
      ]);

    const { entradas, saidas, resultado, total } = resultadoDoMes(
      (lancamentos ?? []) as Lancamento[],
      mes,
      ano,
    );
    if (total === 0) {
      pulados++;
      continue; // sem dado, não gera nem manda e-mail (evita spam sem conteúdo)
    }
    const dadoRalo = total <= 2;
    const produtosSobra = produtosPorSobra((produtos ?? []) as Produto[]);

    // Até 07/10/2026 o cron reservava cota em ia_uso no período do mês
    // FECHADO, enquanto o caminho manual cobra no mês de Brasília em que a
    // geração acontece: dois relógios. Decisão: a geração automática é
    // presente do plano e não come o limite da usuária, então não reserva.

    const partesPrompt = [
      `Mês analisado: ${mesLabel}`,
      `Entradas: R$ ${entradas.toFixed(2)}`,
      `Saídas: R$ ${saidas.toFixed(2)}`,
      `Resultado (quanto sobrou): R$ ${resultado.toFixed(2)}`,
    ];
    if (meta?.valor_alvo != null) {
      partesPrompt.push(
        `Meta do mês: R$ ${Number(meta.valor_alvo).toFixed(2)} (atingido: R$ ${Number(meta.valor_atual ?? 0).toFixed(2)})`,
      );
    }
    if (produtosSobra.length > 0) {
      partesPrompt.push(
        `Produtos por sobra (maior pra menor): ${produtosSobra.map((p) => `${p.nome} (${p.sobraPct}%)`).join(", ")}`,
      );
    }
    if (dadoRalo) {
      partesPrompt.push(
        "Aviso: esse mês tem poucos lançamentos — a leitura é limitada, diga isso na resposta.",
      );
    }
    partesPrompt.push(
      `Devolva um JSON: { "placar": string, "causas": string, "sugestoes": [{ "texto": string, "rota": "produtos"|"financeiro"|"metas"|"clientes"|null }] } — 1 a 3 sugestões.`,
    );

    try {
      const resposta = await geminiClient().models.generateContent({
        model: MODELO_PRO,
        contents: partesPrompt.join("\n"),
        config: {
          systemInstruction: VOZ_SISTEMA,
          httpOptions: { timeout: 20_000 },
          responseMimeType: "application/json",
        },
      });
      const json = JSON.parse(resposta.text ?? "{}");
      const parsed = respostaIaSchema.parse(json);
      const sugestoesLimpa = parsed.sugestoes.map((s) => ({
        texto: s.texto,
        rota: s.rota && ROTAS_VALIDAS.has(s.rota) ? s.rota : null,
      }));

      // Uma linha por geração (histórico do mês). Antes da migração
      // 20261008200000 a UNIQUE (user_id, mes) ainda existe: se uma geração
      // manual entrou entre a checagem acima e aqui, o insert volta 23505 e
      // cai no update da linha existente (comportamento antigo). Mesma regra
      // de gravarGeracaoRaioX em src/lib/raioxGeracoes.ts (runtime diferente,
      // não dá pra importar).
      const linha = {
        user_id: userId,
        mes: mesLabel,
        placar: parsed.placar,
        causas: parsed.causas,
        sugestoes: sugestoesLimpa,
        dado_ralo: dadoRalo,
        email_enviado_em: new Date().toISOString(),
      };
      const { error: erroInsert } = await supabaseAdmin.from("ia_raiox").insert(linha);
      if (erroInsert) {
        if (erroInsert.code !== "23505") throw new Error(`ia_raiox insert: ${erroInsert.message}`);
        const { error: erroUpdate } = await supabaseAdmin
          .from("ia_raiox")
          .update({ ...linha, criado_em: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("mes", mesLabel);
        if (erroUpdate) throw new Error(`ia_raiox update: ${erroUpdate.message}`);
      }
      await supabaseAdmin.from("ia_geracoes").insert({
        user_id: userId,
        feature: FEATURE,
        modelo: MODELO_PRO,
        tokens_in: resposta.usageMetadata?.promptTokenCount ?? null,
        tokens_out: resposta.usageMetadata?.candidatesTokenCount ?? null,
        sucesso: true,
      });

      const email = (authUser?.user?.email as string | undefined) ?? null;
      if (email) await enviarEmailAviso(email, mesLabel);
      gerados++;
    } catch (erro) {
      erros++;
      // Sem estorno em ia_uso: a geração automática não reservou cota.
      await supabaseAdmin.from("ia_geracoes").insert({
        user_id: userId,
        feature: FEATURE,
        modelo: MODELO_PRO,
        sucesso: false,
        erro: erro instanceof Error ? erro.message : String(erro),
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, mes: mesLabel, gerados, pulados, erros }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
