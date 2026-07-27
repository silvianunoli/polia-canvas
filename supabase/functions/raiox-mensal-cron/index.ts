import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";
import { z } from "npm:zod@3.23.8";

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
const LIMITE_MENSAL = 3;

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
      const taxaVendaPct = perfil === "produto" ? n(v.taxaVenda) : perfil === "encomenda" ? n(v.taxaVendaE) : n(v.taxaVendaS);
      const impostosPct = perfil === "produto" ? n(v.impostos) : perfil === "encomenda" ? n(v.impostosE) : n(v.impostosS);
      const custo = p.preco_custo ?? 0;
      const taxas = p.preco_venda * ((taxaVendaPct + impostosPct) / 100);
      const sobraPct = Math.max(0, Math.round(((p.preco_venda - custo - taxas) / p.preco_venda) * 100));
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
  sugestoes: z.array(z.object({ texto: z.string(), rota: z.string().nullable().optional() })).max(3),
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
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Pólia <naoresponda@usepolia.com.br>",
        to: paraEmail,
        subject: `Seu raio-x de ${mesLabel} está pronto`,
        text: `A leitura do seu mês já está pronta. Acesse: https://usepolia.com.br/raiox`,
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

  const { data: flag } = await supabaseAdmin
    .from("feature_flags")
    .select("enabled")
    .eq("key", "ia_raiox_ativo")
    .maybeSingle();
  if (flag?.enabled === false) {
    return new Response(JSON.stringify({ ok: false, motivo: "manutencao" }), { status: 200 });
  }

  const { data: usuarias } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("plano", "projete");

  let gerados = 0;
  let pulados = 0;
  let erros = 0;

  for (const u of usuarias ?? []) {
    const userId = u.id as string;

    const { data: existente } = await supabaseAdmin
      .from("ia_raiox")
      .select("id")
      .eq("user_id", userId)
      .eq("mes", mesLabel)
      .maybeSingle();
    if (existente) {
      pulados++;
      continue;
    }

    const [{ data: lancamentos }, { data: meta }, { data: produtos }, { data: authUser }] = await Promise.all([
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
      partesPrompt.push("Aviso: esse mês tem poucos lançamentos — a leitura é limitada, diga isso na resposta.");
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

      await supabaseAdmin.from("ia_raiox").upsert(
        {
          user_id: userId,
          mes: mesLabel,
          placar: parsed.placar,
          causas: parsed.causas,
          sugestoes: sugestoesLimpa,
          dado_ralo: dadoRalo,
          email_enviado_em: new Date().toISOString(),
        },
        { onConflict: "user_id,mes" },
      );
      await supabaseAdmin.rpc("incrementar_ia_uso", {
        p_user_id: userId,
        p_feature: FEATURE,
        p_periodo: mesLabel,
        p_limite: LIMITE_MENSAL,
      });
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
