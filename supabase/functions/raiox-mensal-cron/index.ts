import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";
import { z } from "npm:zod@3.23.8";
import { emailPolia } from "../_shared/email-polia.ts";

// Lote mensal do Raio-x do mês (Fase 3, Pro) — chamado só por pg_cron via
// pg_net (`disparar_raiox_mensal()`, migração 20260727191000), autenticado por
// segredo compartilhado (mesmo padrão de alertas-criticos: quem chama não tem
// sessão de usuária). verify_jwt desligado — ver supabase/config.toml.
//
// IMPORTANTE: a leitura aqui precisa ficar em sincronia manual com o caminho
// sob demanda (src/lib/raiox.functions.ts, src/lib/raioxHistorico.ts,
// src/lib/metaDoMes.ts, src/lib/moeda.ts, src/lib/sanitizarTextoIA.ts,
// sobraDoProduto em src/lib/precificacao.functions.ts, lerTodasAsPaginas em
// src/lib/leituraPaginada.ts). Lá roda no Worker Cloudflare em Node, aqui em
// Deno: não dá pra importar, então o código está COPIADO abaixo. Mudar a
// voz/regras/conta muda nos dois lados no mesmo commit.
//
// TEMPO (08/10/2026): antes era um laço sequencial com Gemini Pro de até 20 s
// por usuária. Com 20 a 40 contas Pro a função estourava o teto de tempo da
// edge function e quem ficava pra trás não recebia o raio-x do mês. Agora:
//  - até CONCORRENCIA usuárias ao mesmo tempo (4 chamadas Pro em paralelo);
//  - não começa usuária nova depois de ORCAMENTO_MS, e quem sobrou entra na
//    próxima execução (resposta traz "pendentes");
//  - a migração 20261008230000 faz o cron rodar a cada 20 min das 09h às
//    11h40 UTC do dia 1º; a checagem "já existe raio-x desse mês" impede
//    gerar duas vezes pra mesma usuária. Sem a migração aplicada, a rodada
//    única das 09h já processa ~4x mais gente que antes.
// Por que não a função chamar a si mesma: depende de a requisição de saída
// sobreviver ao fim da resposta e cria laço difícil de parar se algo der
// errado. Várias rodadas do cron são idempotentes e visíveis em cron.job.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RAIOX_CRON_SECRET = Deno.env.get("RAIOX_CRON_SECRET") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MODELO_PRO = "gemini-pro-latest";
const FEATURE = "raiox";
// Pro e beta (acesso total) geram raio-x: mesma regra de planoGeraRaioX /
// temProjete no app. Antes só "projete" entrava e a conta beta ficava sem.
const PLANOS_COM_RAIOX = ["projete", "beta"];
const CONCORRENCIA = 4;
// Gemini tem timeout de 50 s; quem começa até aqui termina antes do teto de
// wall-clock da edge function (150 s no plano mais baixo): 80 + 50 = 130 s.
const ORCAMENTO_MS = 80_000;
// 20 s não dava: o raio-x no modelo Pro devolvia 504 nas duas tentativas
// (teste de 08/10/2026), porque o prazo vai pro Google como teto do servidor.
const TIMEOUT_GEMINI_MS = 50_000;
// Sem LIMITE_MENSAL aqui de propósito (07/10/2026): a geração automática do
// mês fechado NÃO conta no limite de 3 gerações da usuária (ia_uso). O que
// impede gerar duas vezes é a checagem de "já existe raio-x desse mês" abaixo.

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function autenticado(req: Request): boolean {
  if (!RAIOX_CRON_SECRET) return false;
  return req.headers.get("x-raiox-cron-secret") === RAIOX_CRON_SECRET;
}

// ── Datas (cópia de src/lib/data.functions.ts e leituraPaginada.ts) ─────────

const formatoDiaBrasilia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function hojeEmBrasilia(agora: Date = new Date()): string {
  const partes = formatoDiaBrasilia.formatToParts(agora);
  const pega = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? "";
  return `${pega("year")}-${pega("month")}-${pega("day")}`;
}

/** Mês que acabou de fechar, no horário de Brasília. */
function mesFechadoEmBrasilia(agora: Date): { ano: number; mes: number } {
  const [ano, mes] = hojeEmBrasilia(agora).split("-").map(Number);
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
}

function intervaloDoMes(ano: number, mes: number): { inicio: string; fimExclusivo: string } {
  const p = (n: number) => String(n).padStart(2, "0");
  const proxAno = mes === 12 ? ano + 1 : ano;
  const proxMes = mes === 12 ? 1 : mes + 1;
  return { inicio: `${ano}-${p(mes)}-01`, fimExclusivo: `${proxAno}-${p(proxMes)}-01` };
}

const TAMANHO_PAGINA = 1000; // teto do PostgREST: página nunca é cortada
const MAX_PAGINAS = 50;

/** Lê todas as páginas; erro ou teto estourado viram exceção, nunca soma parcial. */
async function lerTodasAsPaginas<T>(
  buscarPagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const todas: T[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const de = pagina * TAMANHO_PAGINA;
    const { data, error } = await buscarPagina(de, de + TAMANHO_PAGINA - 1);
    if (error) throw error;
    const linhas = data ?? [];
    todas.push(...linhas);
    if (linhas.length < TAMANHO_PAGINA) return todas;
  }
  throw new Error("leitura_incompleta");
}

// ── Lançamentos ─────────────────────────────────────────────────────────────

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

// ── Meta do mês (cópia de metaDoMes.ts + escolherMetaDoRaioX) ───────────────

const TITULO_META_DO_MES = "Meta do mês";

interface LinhaMetaDoMes {
  valor_alvo: number | null;
  status: string | null;
  da_jornada: boolean | null;
  updated_at: string | null;
}

/** Arquivada nunca; ativa antes de concluída; do Planejamento antes da manual; mais recente. */
function escolherMetaDoMes(linhas: readonly LinhaMetaDoMes[]): LinhaMetaDoMes | null {
  const validas = linhas.filter((l) => l.status !== "arquivada");
  if (validas.length === 0) return null;
  const peso = (l: LinhaMetaDoMes) => (l.status === "ativa" ? 2 : 0) + (l.da_jornada ? 1 : 0);
  return [...validas].sort((a, b) => {
    const p = peso(b) - peso(a);
    if (p !== 0) return p;
    return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
  })[0];
}

/** Mês fechado: a meta do histórico se existir; senão a de hoje, com aviso. */
function escolherMetaDoRaioX(
  metaDoHistorico: number | null,
  metaDeHoje: number | null,
): { valorAlvo: number | null; usaMetaDeHoje: boolean } {
  if (metaDoHistorico != null && Number.isFinite(metaDoHistorico)) {
    return { valorAlvo: metaDoHistorico, usaMetaDeHoje: false };
  }
  if (metaDeHoje == null) return { valorAlvo: null, usaMetaDeHoje: false };
  return { valorAlvo: metaDeHoje, usaMetaDeHoje: true };
}

// "Tabela/coluna não existe" (migração pendente): PostgREST e Postgres.
const CODIGOS_SEM_SCHEMA = new Set(["PGRST205", "PGRST204", "42P01", "42703"]);
function codigoDoErro(erro: unknown): string | null {
  const code = (erro as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}
function faltaSchema(erro: unknown): boolean {
  const code = codigoDoErro(erro);
  return code != null && CODIGOS_SEM_SCHEMA.has(code);
}

// ── Produtos (cópia de raioxHistorico.ts + sobraDoProduto) ──────────────────

interface CalculadoraBreakdown {
  perfil: string;
  valores: Record<string, string>;
}

interface ProdutoDoBanco {
  nome: string;
  preco_venda: number;
  preco_custo: number | null;
  calculadora_breakdown: CalculadoraBreakdown | null;
  historico_precos: unknown;
  preco_atualizado_em: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ProdutoParaRaioX {
  nome: string;
  preco_venda: number;
  preco_custo: number | null;
  calculadora_breakdown: CalculadoraBreakdown | null;
}

const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function trocasValidas(historico: unknown): { preco: number; data: string }[] {
  if (!Array.isArray(historico)) return [];
  const trocas: { preco: number; data: string }[] = [];
  for (const item of historico) {
    if (!item || typeof item !== "object") continue;
    const { preco, data } = item as { preco?: unknown; data?: unknown };
    const n = Number(preco);
    if (typeof data !== "string" || !DIA_ISO.test(data) || !Number.isFinite(n)) continue;
    trocas.push({ preco: n, data });
  }
  return trocas;
}

function diaEmBrasilia(ts: string | null): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return hojeEmBrasilia(d);
}

/** Produtos como estavam no fim do mês (mês fechado), sem os criados depois. */
function produtosDoMesFechado(
  produtos: readonly ProdutoDoBanco[],
  fimExclusivo: string,
): { produtos: ProdutoParaRaioX[]; usaPrecoDeHoje: boolean; usaCustoDeHoje: boolean } {
  const lista: ProdutoParaRaioX[] = [];
  let usaPrecoDeHoje = false;
  let usaCustoDeHoje = false;
  for (const p of produtos) {
    const criadoEm = diaEmBrasilia(p.created_at);
    if (criadoEm && criadoEm >= fimExclusivo) continue;

    const editadoEm = diaEmBrasilia(p.updated_at);
    const custoDoMes = editadoEm != null && editadoEm < fimExclusivo;
    const trocaDepois = trocasValidas(p.historico_precos)
      .filter((t) => t.data >= fimExclusivo)
      .sort((a, b) => a.data.localeCompare(b.data))[0];

    let preco = Number(p.preco_venda);
    let precoDoMes: boolean;
    if (trocaDepois) {
      preco = trocaDepois.preco;
      precoDoMes = true;
    } else {
      const precoMudouEm = diaEmBrasilia(p.preco_atualizado_em);
      precoDoMes = custoDoMes || precoMudouEm == null || precoMudouEm < fimExclusivo;
    }

    lista.push({
      nome: p.nome,
      preco_venda: preco,
      preco_custo: p.preco_custo,
      calculadora_breakdown: p.calculadora_breakdown,
    });
    // Produto sem preço fica fora do ranking, então não conta pro aviso.
    if (preco <= 0) continue;
    if (!precoDoMes) usaPrecoDeHoje = true;
    if (!custoDoMes) usaCustoDeHoje = true;
  }
  return { produtos: lista, usaPrecoDeHoje, usaCustoDeHoje };
}

function taxasDoBreakdown(bk: CalculadoraBreakdown | null | undefined) {
  if (!bk) return { taxaVendaPct: 0, impostosPct: 0 };
  const n = (s?: string) => (s ? parseFloat(s.replace(",", ".")) || 0 : 0);
  const v = bk.valores ?? {};
  if (bk.perfil === "produto") return { taxaVendaPct: n(v.taxaVenda), impostosPct: n(v.impostos) };
  if (bk.perfil === "encomenda") {
    return { taxaVendaPct: n(v.taxaVendaE), impostosPct: n(v.impostosE) };
  }
  return { taxaVendaPct: n(v.taxaVendaS), impostosPct: n(v.impostosS) };
}

/**
 * % do preço que sobra, COM sinal: produto com prejuízo vai pra IA como
 * negativo (antes travava em 0 e o prejuízo virava "0%"). Mesma conta de
 * sobraDoProduto, com custo vazio lido como 0 (igual produtosPorSobra do app).
 */
function produtosPorSobra(produtos: ProdutoParaRaioX[]): { nome: string; sobraPct: number }[] {
  return produtos
    .filter((p) => p.preco_venda > 0)
    .map((p) => {
      const custo = p.preco_custo ?? 0;
      const { taxaVendaPct, impostosPct } = taxasDoBreakdown(p.calculadora_breakdown);
      const taxas = p.preco_venda * ((taxaVendaPct + impostosPct) / 100);
      const sobra = p.preco_venda - custo - taxas;
      return { nome: p.nome, sobraPct: Math.round((sobra / p.preco_venda) * 100) };
    })
    .sort((a, b) => b.sobraPct - a.sobraPct);
}

// ── Avisos fixos (cópia de avisosDoRaioX) ───────────────────────────────────

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

function avisosDoRaioX(args: {
  ano: number;
  mes: number;
  usaMetaDeHoje: boolean;
  usaPrecoDeHoje: boolean;
  usaCustoDeHoje: boolean;
}): string[] {
  const nome = MESES_NOME[args.mes - 1] ?? `${args.mes}/${args.ano}`;
  const avisos: string[] = [];
  if (args.usaMetaDeHoje) {
    avisos.push(`A meta de ${nome} não ficou guardada; a leitura usa a meta de hoje.`);
  }
  if (args.usaPrecoDeHoje) {
    avisos.push(
      `O preço de ${nome} não ficou guardado em todos os produtos; onde faltou, a leitura usa o preço de hoje.`,
    );
  }
  if (args.usaCustoDeHoje) {
    avisos.push(
      `O custo dos produtos não fica guardado mês a mês; nos produtos editados depois de ${nome}, a leitura usa o custo de hoje.`,
    );
  }
  return avisos;
}

// ── Prompt (cópia de montarPromptRaioX / VOZ_SISTEMA / moedaParaPrompt) ─────

/** "R$ 8.780,00": formato pt-BR, sem o espaço não separável do style currency. */
function moedaParaPrompt(valor: number): string {
  return `R$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

interface ContextoRaioX {
  mes: string;
  entradas: number;
  saidas: number;
  resultado: number;
  metaAlvo: number | null;
  metaAtual: number | null;
  produtos: { nome: string; sobraPct: number }[];
  dadoRalo: boolean;
  avisos: string[];
}

function montarPromptRaioX(ctx: ContextoRaioX): string {
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
  for (const aviso of ctx.avisos) {
    partes.push(
      `Limite dos dados: ${aviso} Não afirme que esse valor era o daquele mês; a tela já mostra esse aviso, não precisa repetir a frase.`,
    );
  }
  partes.push(
    `Devolva um JSON: { "placar": string (1-2 frases, o resultado em número e tom), "causas": string (1 parágrafo curto, o que puxou pra cima/baixo), "sugestoes": [{ "texto": string, "rota": "produtos"|"financeiro"|"metas"|"clientes"|null }] }. De 1 a 3 sugestões.`,
  );
  return partes.join("\n");
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

const respostaIaSchema = z.object({
  placar: z.string(),
  causas: z.string(),
  sugestoes: z
    .array(z.object({ texto: z.string(), rota: z.string().nullable().optional() }))
    .max(3),
});

const ROTAS_VALIDAS = new Set(["produtos", "financeiro", "metas", "clientes"]);

// Cópia de src/lib/sanitizarTextoIA.ts: nunca travessão em texto da IA.
const TRACO = "[—–―]";
function sanitizarTextoIA(texto: string): string {
  let t = texto;
  t = t.replace(/‑/g, "-");
  t = t.replace(new RegExp(`(\\d) *${TRACO} *(?=\\d)`, "g"), "$1-");
  t = t.replace(new RegExp(`(^|\\n) *${TRACO} ?`, "g"), "$1");
  t = t.replace(new RegExp(` *${TRACO} *(?=\\n|$)`, "g"), "");
  t = t.replace(new RegExp(` *${TRACO} *`, "g"), ", ");
  t = t.replace(/,[ \t]*(?:,[ \t]*)+/g, ", ");
  t = t.replace(/, +(?=[.,;:!?])/g, "");
  t = t.replace(/,(?=[.;:!?])/g, "");
  return t;
}

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

// ── Gravação (mesma regra de gravarGeracaoRaioX em src/lib/raioxGeracoes.ts) ─

type LinhaRaioX = Record<string, unknown> & { user_id: string; mes: string };

async function inserirOuAtualizar(linha: LinhaRaioX): Promise<{ error: unknown }> {
  const { error: erroInsert } = await supabaseAdmin.from("ia_raiox").insert(linha);
  if (!erroInsert) return { error: null };
  // Antes da migração 20261008200000 a UNIQUE (user_id, mes) ainda existe: se
  // uma geração manual entrou entre a checagem e aqui, o insert volta 23505 e
  // cai no update da linha existente (comportamento antigo).
  if (codigoDoErro(erroInsert) !== "23505") return { error: erroInsert };
  const { error: erroUpdate } = await supabaseAdmin
    .from("ia_raiox")
    .update({ ...linha, criado_em: new Date().toISOString() })
    .eq("user_id", linha.user_id)
    .eq("mes", linha.mes);
  return { error: erroUpdate };
}

/** Tenta com `avisos`; sem a coluna (migração 20261008190000 pendente) grava sem ela. */
async function gravarGeracao(linha: LinhaRaioX, avisos: string[]): Promise<void> {
  const comAvisos = await inserirOuAtualizar({ ...linha, avisos });
  if (!comAvisos.error) return;
  if (!faltaSchema(comAvisos.error)) {
    throw new Error(`ia_raiox: ${(comAvisos.error as { message?: string }).message ?? "falha"}`);
  }
  const semAvisos = await inserirOuAtualizar(linha);
  if (semAvisos.error) {
    throw new Error(`ia_raiox: ${(semAvisos.error as { message?: string }).message ?? "falha"}`);
  }
}

// ── Uma usuária ─────────────────────────────────────────────────────────────

type Desfecho = "gerado" | "pulado" | "erro";

interface Periodo {
  ano: number;
  mes: number;
  mesLabel: string;
  inicio: string;
  fimExclusivo: string;
}

/** Falha vira "sem meta", igual ao caminho manual (que ignora o erro de metas). */
async function lerMetaDeHoje(userId: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("metas")
    .select("valor_alvo, status, da_jornada, updated_at")
    .eq("user_id", userId)
    .eq("titulo", TITULO_META_DO_MES);
  if (error) {
    console.error("raiox-cron: falha ao ler a meta de hoje", error);
    return null;
  }
  const escolhida = escolherMetaDoMes((data ?? []) as LinhaMetaDoMes[]);
  const valor = Number(escolhida?.valor_alvo);
  return escolhida?.valor_alvo != null && Number.isFinite(valor) ? valor : null;
}

/** Falha vira null: a leitura cai na meta de hoje com aviso, igual ao app. */
async function lerMetaDoHistorico(userId: string, mes: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("meta_do_mes_historico")
    .select("valor_alvo")
    .eq("user_id", userId)
    .eq("mes", mes)
    .maybeSingle();
  if (error) {
    if (!faltaSchema(error)) console.error("raiox-cron: falha ao ler meta do histórico", error);
    return null;
  }
  const valor = Number((data as { valor_alvo?: unknown } | null)?.valor_alvo);
  return data && Number.isFinite(valor) ? valor : null;
}

async function processarUsuaria(
  userId: string,
  periodo: Periodo,
  flagLiberaPara: (userId: string) => Promise<boolean>,
): Promise<Desfecho> {
  if (!(await flagLiberaPara(userId))) return "pulado";

  // Desde 07/10/2026 cada geração é uma linha (histórico do mês), então o
  // mês pode ter várias: limit(1) só pergunta "tem alguma?". Erro de leitura
  // pula a usuária em vez de arriscar gerar em dobro. É também o que deixa o
  // cron rodar várias vezes no dia 1º sem duplicar.
  const { data: existentes, error: erroExistente } = await supabaseAdmin
    .from("ia_raiox")
    .select("id")
    .eq("user_id", userId)
    .eq("mes", periodo.mesLabel)
    .limit(1);
  if (erroExistente) return "erro";
  if ((existentes ?? []).length > 0) return "pulado";

  let lancamentos: Lancamento[];
  let metaDeHoje: number | null;
  let produtos: ProdutoDoBanco[];
  let metaDoHistorico: number | null;
  let email: string | null;
  try {
    // Só o mês fechado, página por página: sem filtro a leitura trazia a conta
    // inteira e o PostgREST corta em 1.000 linhas sem avisar (soma parcial).
    const [l, mh, p, hist, authUser] = await Promise.all([
      lerTodasAsPaginas<Lancamento>((de, ate) =>
        supabaseAdmin
          .from("lancamentos")
          .select("tipo, valor, data")
          .eq("user_id", userId)
          .gte("data", periodo.inicio)
          .lt("data", periodo.fimExclusivo)
          .order("data", { ascending: true })
          .order("id", { ascending: true })
          .range(de, ate),
      ),
      lerMetaDeHoje(userId),
      supabaseAdmin
        .from("produtos")
        .select(
          "nome, preco_venda, preco_custo, calculadora_breakdown, historico_precos, preco_atualizado_em, created_at, updated_at",
        )
        .eq("user_id", userId)
        .eq("arquivado", false)
        .then(({ data, error }) => {
          // Igual ao caminho manual: sem produtos o raio-x sai sem o ranking.
          if (error) console.error("raiox-cron: falha ao ler produtos", error);
          return (data ?? []) as ProdutoDoBanco[];
        }),
      lerMetaDoHistorico(userId, periodo.mesLabel),
      supabaseAdmin.auth.admin.getUserById(userId),
    ]);
    lancamentos = l;
    metaDeHoje = mh;
    produtos = p;
    metaDoHistorico = hist;
    email = (authUser?.data?.user?.email as string | undefined) ?? null;
  } catch (erro) {
    // Lançamentos que falham não podem virar "mês sem lançamento" nem soma
    // parcial: pula a usuária, a próxima rodada do cron tenta de novo.
    console.error("raiox-cron: falha ao ler os lançamentos", erro);
    return "erro";
  }

  const { entradas, saidas, resultado, total } = resultadoDoMes(
    lancamentos,
    periodo.mes,
    periodo.ano,
  );
  if (total === 0) return "pulado"; // sem dado, não gera nem manda e-mail
  const dadoRalo = total <= 2;

  const escolhaMeta = escolherMetaDoRaioX(metaDoHistorico, metaDeHoje);
  const doMes = produtosDoMesFechado(produtos, periodo.fimExclusivo);
  const avisos = avisosDoRaioX({
    ano: periodo.ano,
    mes: periodo.mes,
    usaMetaDeHoje: escolhaMeta.usaMetaDeHoje,
    usaPrecoDeHoje: doMes.usaPrecoDeHoje,
    usaCustoDeHoje: doMes.usaCustoDeHoje,
  });
  const prompt = montarPromptRaioX({
    mes: periodo.mesLabel,
    entradas,
    saidas,
    resultado,
    metaAlvo: escolhaMeta.valorAlvo,
    // "Atingido" = entradas do mês lido, a mesma conta do Financeiro.
    metaAtual: escolhaMeta.valorAlvo != null ? entradas : null,
    produtos: produtosPorSobra(doMes.produtos),
    dadoRalo,
    avisos,
  });

  // A geração automática é presente do plano e não come o limite da usuária
  // (ia_uso), então não reserva cota.
  try {
    const resposta = await geminiClient().models.generateContent({
      model: MODELO_PRO,
      contents: prompt,
      config: {
        systemInstruction: VOZ_SISTEMA,
        httpOptions: { timeout: TIMEOUT_GEMINI_MS },
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });
    const json = JSON.parse(sanitizarTextoIA(resposta.text ?? "{}"));
    const parsed = respostaIaSchema.parse(json);
    const sugestoesLimpa = parsed.sugestoes.map((s) => ({
      texto: s.texto,
      rota: s.rota && ROTAS_VALIDAS.has(s.rota) ? s.rota : null,
    }));

    await gravarGeracao(
      {
        user_id: userId,
        mes: periodo.mesLabel,
        placar: parsed.placar,
        causas: parsed.causas,
        sugestoes: sugestoesLimpa,
        dado_ralo: dadoRalo,
        email_enviado_em: new Date().toISOString(),
      },
      avisos,
    );
    await supabaseAdmin.from("ia_geracoes").insert({
      user_id: userId,
      feature: FEATURE,
      modelo: MODELO_PRO,
      tokens_in: resposta.usageMetadata?.promptTokenCount ?? null,
      tokens_out: resposta.usageMetadata?.candidatesTokenCount ?? null,
      sucesso: true,
    });

    if (email) await enviarEmailAviso(email, periodo.mesLabel);
    return "gerado";
  } catch (erro) {
    // Sem estorno em ia_uso: a geração automática não reservou cota.
    await supabaseAdmin.from("ia_geracoes").insert({
      user_id: userId,
      feature: FEATURE,
      modelo: MODELO_PRO,
      sucesso: false,
      erro: erro instanceof Error ? erro.message : String(erro),
    });
    return "erro";
  }
}

/**
 * Roda `fn` em até `limite` itens ao mesmo tempo. Para de começar item novo
 * quando `deveParar()` diz que sim; devolve quantos ficaram sem começar.
 * `fn` não pode lançar (processarUsuaria já devolve "erro").
 */
async function comConcorrencia<T>(
  itens: readonly T[],
  limite: number,
  deveParar: () => boolean,
  fn: (item: T) => Promise<void>,
): Promise<number> {
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < itens.length && !deveParar()) {
      const item = itens[proximo++];
      await fn(item);
    }
  };
  const n = Math.max(1, Math.min(limite, itens.length));
  await Promise.all(Array.from({ length: n }, trabalhador));
  return itens.length - proximo;
}

Deno.serve(async (req: Request) => {
  if (!autenticado(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const inicioExecucao = Date.now();
  // Sempre lê o mês ANTERIOR ao atual em Brasília (o que acabou de fechar).
  const { ano, mes } = mesFechadoEmBrasilia(new Date());
  const { inicio, fimExclusivo } = intervaloDoMes(ano, mes);
  const periodo: Periodo = { ano, mes, mesLabel: inicio.slice(0, 7), inicio, fimExclusivo };

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
    if (flag.estado === "beta" && ((flag.beta_user_ids ?? []) as string[]).includes(userId)) {
      return true;
    }
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

  let usuarias: string[];
  try {
    const linhas = await lerTodasAsPaginas<{ id: string }>((de, ate) =>
      supabaseAdmin
        .from("profiles")
        .select("id")
        .in("plano", PLANOS_COM_RAIOX)
        .order("id", { ascending: true })
        .range(de, ate),
    );
    usuarias = linhas.map((u) => u.id);
  } catch (erro) {
    console.error("raiox-cron: falha ao listar as contas Pro", erro);
    return new Response(JSON.stringify({ ok: false, motivo: "falha_leitura" }), { status: 500 });
  }

  let gerados = 0;
  let pulados = 0;
  let erros = 0;

  const pendentes = await comConcorrencia(
    usuarias,
    CONCORRENCIA,
    () => Date.now() - inicioExecucao > ORCAMENTO_MS,
    async (userId) => {
      let desfecho: Desfecho;
      try {
        desfecho = await processarUsuaria(userId, periodo, flagLiberaPara);
      } catch (erro) {
        console.error("raiox-cron: falha inesperada", erro);
        desfecho = "erro";
      }
      if (desfecho === "gerado") gerados++;
      else if (desfecho === "pulado") pulados++;
      else erros++;
    },
  );

  return new Response(
    JSON.stringify({ ok: true, mes: periodo.mesLabel, gerados, pulados, erros, pendentes }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});
