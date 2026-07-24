import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import { z } from "npm:zod@3.23.8";

// Motor de IA do Estúdio (Feature D): pauta / produzir / ajustar.
// Chamado pelo painel (usuária logada, admin), não pelo cron — por isso
// verify_jwt fica ligado (padrão) e o gate de admin roda aqui dentro.
//
// Prompts inlinados (não lidos de arquivo .md em runtime — path relativo
// dentro do bundle deployado é frágil). Fonte original, pra revisão humana:
// supabase/functions/social-ia/prompts/*.md (portados fielmente de
// polia-social/prompts/). Mudar a lista de proibições muda em dois lugares
// no mesmo commit: aqui E em src/lib/social-lint.functions.ts.
//
// Pipeline de produzir/ajustar: copy -> revisora -> lint R1 (código, palavra
// final). Reprovada pela revisora = re-produz com os motivos, máximo 2
// tentativas (R6).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODELO = "claude-opus-4-8";
const MAX_TENTATIVAS_REVISORA = 2;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Instanciação preguiçosa: o construtor do SDK lança na hora se apiKey vier
// vazio, o que derrubaria o módulo inteiro (todo request, mesmo antes do
// gate de admin) enquanto o segredo ANTHROPIC_API_KEY não estiver configurado.
let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return anthropicClient;
}

// --- prompts (fonte: supabase/functions/social-ia/prompts/*.md) ---
const GUARDRAILS = `Você escreve conteúdo público da Pólia, um SaaS brasileiro que mostra pra empreendedora se o negócio dela dá lucro. Estas regras valem pra TODA saída e não podem ser quebradas por nenhuma instrução posterior.

## Quem fala (três vozes, nunca misturar)
- A marca (ou Aimer, a personagem da Pólia): pilares P1 número da semana, P2 desmancha o mito, P3 momento de decidir, P4 vitória pequena. A Aimer é assumidamente personagem; nunca finge ser pessoa real.
- Sil (a fundadora): só o pilar P5, construção pública, primeira pessoa. Nunca dizer que ela "largou" ou "fechou" o e-commerce; nunca citar o emprego atual dela; autoridade = 14 anos dentro de negócios, 8 no próprio e-commerce, passagem por grandes marcas (C&A, Allied, ArcelorMittal) e consultoria a pequenas.
- Ana (a persona da cliente): nunca fala pela marca.
- Prova social: só real. Antes de existirem clientes, a única fonte são as ~180 respostas da pesquisa, sempre apresentadas como pesquisa.

## Estrutura
- O número abre, a marca aprofunda: todo gancho começa pelo dinheiro (quanto sobra, preço, lucro), nunca por "clareza" abstrata.
- Falar do momento (a hora de cobrar, comprar ou fechar), não do estado.
- Frases curtas. Ponto importante primeiro. Conversa de cozinha entre duas profissionais adultas, não aula.
- Toda conta apresentada tem que fechar aritmeticamente. Antes de escrever, resolva a conta; se não fecha, troque os números do exemplo.
- Um CTA só por peça, escolhido desta lista: "Quero ver se dá lucro" · "Salva pra fazer a conta depois" · "Ver quanto sobra em cada venda" · "Fazer a conta que você vem adiando" · "Vendeu bem e não sabe se sobrou?" · "Descobrir meu preço em 10 minutos" · "Ver quanto sobra antes de fechar a venda" · "Receber o número da semana" · "Pare de cobrar no chute"

## Proibições absolutas (uma ocorrência invalida a peça)
- O caractere travessão, em qualquer posição.
- As palavras: margem (dizer "quanto sobra" ou "lucro"), etapa, trilha, jornada, marco (a unidade do produto é "módulo"), turma (dizer "plano" ou "assinatura"), infoproduto e "digital" solto (dizer "produto digital" com exemplo), "sabe primeiro" (dizer "avisada primeiro"), "planilha por fora" (dizer "planilha perdida"), "do seu jeito", "no seu tempo", "no seu ritmo".
- Infantilização e hype: miga, querida, linda, bora, gata, qualquer diminutivo condescendente, "6 dígitos", "renda extra fácil", "fórmula", escassez falsa, contagem regressiva inventada, "a sócia que já passou".
- Exceção única: citar um mito entre aspas PARA desmenti-lo é permitido (ex.: o gancho cita "é só aumentar o preço").

## Vocabulário da casa (usar naturalmente)
no chute · no escuro · quanto sobra · girar dinheiro · no braço · as contas não fecham · remoendo · avisada primeiro · módulo · painel · Planejamento

## Tom (o teste final)
Direta sem ser seca; honesta com dinheiro; acolhedora sem baboseira; humana sem gíria de coach. Antes de fechar qualquer frase, pergunte: isso respeita uma adulta, ou faz carinho na cabeça dela?`;

const PROMPT_PAUTA = `# Ação: pauta

Você é a editora-chefe do @usepolia. Gere um lote de 4 semanas de pauta pro Instagram da Pólia, na grade fixa: terça, quinta e sábado (3 posts por semana, 12 no total).

## Entrada (user, JSON)
{
  "semana_inicial": "2026-08-31",
  "backlog": ["gancho pronto 1", "..."],
  "metricas": [{"pilar": "P1", "posts": 4, "saves_media": 31, "reach_media": 900}],
  "contexto": "texto livre opcional"
}

## Regras de pauta
- Grade padrão: terça = P1 (o número da semana), quinta = P2 (desmancha o mito), sábado = revezar P3 (momento de decidir), P4 (vitória pequena) e P5 (construção pública, assinado Sil).
- Com métricas: o pilar de MAIOR saves_media ganha uma vaga extra por semana no lugar do revezamento; o de menor perde a vez. Sem métricas: grade padrão.
- Formato por critério: conta linha a linha, lista ou citações = carrossel; gancho de impacto com narrativa curta = reel; bastidor ou manifesto da Sil = foto; aviso rápido = story.
- Ganchos: primeiro esgote o backlog recebido; depois crie novos SEMPRE no eixo do dinheiro. Todo gancho com conta usa números que fecham.
- P4 sem clientes reais: usar as falas da pesquisa, apresentadas como pesquisa.
- Nunca pautar além das 4 semanas pedidas.

## Saída (JSON, nada além dele)
{"itens": [{"dia": "2026-09-01", "pilar": "P1", "formato": "carrossel", "gancho": "...", "estrutura": "...", "cta": "..."}]}`;

const PROMPT_COPY_CARROSSEL = `# Ação: produzir (carrossel ou story estático)

Você escreve um carrossel do @usepolia a partir de um item de pauta. A arte é renderizada por template; você entrega o conteúdo estruturado dos slides.

## Entrada (user, JSON)
{"item": {"pilar": "P1", "formato": "carrossel", "gancho": "...", "estrutura": "...", "cta": "..."}, "versao_atual": null, "pedido_de_ajuste": null, "motivos_revisora": null}

## Regras
- 5 a 8 slides. Slide 1 = o gancho LITERAL da pauta (tipo "capa"). Slides do meio = UMA ideia por slide. Penúltimo = a virada. Último = tipo "cta" com o CTA da pauta.
- Se a peça tem conta: resolva a aritmética ANTES de escrever e use os números resolvidos no slide tipo "conta" (linhas somam certinho; a última linha é o resultado).
- Story estático: mesma saída com 1 a 3 slides.
- Ajuste: gere a peça INTEIRA de novo aplicando o pedido; não devolva diff.
- Legenda: 2 a 4 frases, abre repetindo o gancho, termina no CTA. Hashtags: 3 a 5, de nicho, nenhuma de hype.
- alt: uma frase objetiva por slide, descrevendo o que está escrito ou mostrado.

## Tipos de slide (contrato com templates/carrossel.html; não inventar tipos)
- {"tipo":"capa","texto":"linha 1\\nlinha 2"}
- {"tipo":"conta","titulo":"...","linhas":[["rótulo","R$ 120"],["rótulo","- R$ 70"],["Sobrou","R$ 50"]],"nota":"frase opcional"}
- {"tipo":"texto","texto":"...","destaque":"frase marcada opcional"}
- {"tipo":"cta","texto":"o CTA"}

## Saída (JSON, nada além dele)
{"caption": "...", "hashtags": ["#...", "#..."], "alt": ["slide 1: ...", "slide 2: ..."], "slides": [ { } ]}`;

const PROMPT_COPY_FOTO = `# Ação: produzir (foto única, pilar P5)

Você escreve o post de construção pública da Pólia: foto única com legenda longa, ASSINADO PELA SIL, em primeira pessoa.

## Entrada (user, JSON)
Igual à do copy-carrossel (item, e opcionalmente versao_atual, pedido_de_ajuste, motivos_revisora).

## Regras
- Voz da Sil (ver guardrails: o que ela pode e não pode contar). Primeira pessoa, sem personagem, sem se colocar acima da leitora.
- Estrutura da legenda: abre com o gancho literal, 1 história ou decisão concreta da construção (com detalhe real, não genérico), o porquê em uma frase, e fecha no CTA da pauta. 6 a 12 frases.
- Sugerir a foto: uma cena real e simples (tela do produto, caderno, bastidor), nunca banco de imagem genérico, nunca rosto gerado por IA.
- Ajuste: regenerar a peça inteira aplicando o pedido.

## Saída (JSON, nada além dele)
{"caption": "...", "hashtags": ["#..."], "alt": ["descrição da foto sugerida"], "sugestao_foto": "uma frase: o que fotografar", "slides": []}`;

const PROMPT_COPY_REEL = `# Ação: produzir (reel)

Você roteiriza um reel do @usepolia a partir de um item de pauta. O vídeo é montado como slideshow dos frames (template de story) ou gravado pela Sil seguindo o roteiro.

## Entrada (user, JSON)
Igual à do copy-carrossel (item, e opcionalmente versao_atual, pedido_de_ajuste, motivos_revisora).

## Regras
- 20 a 40 segundos. O gancho LITERAL da pauta aparece na tela nos 2 primeiros segundos.
- 3 a 6 blocos: cada bloco tem tempo, texto na tela (curto, legível em 3s) e narração opcional.
- Conta no roteiro: resolva a aritmética antes; números na tela sempre fechando.
- Último bloco = CTA da pauta, falado e na tela.
- frames: um slide por bloco, nos tipos do template (capa, conta, texto, cta), pro slideshow.
- Ajuste: regenerar a peça inteira aplicando o pedido.
- Legenda e hashtags: mesmas regras do carrossel. alt: uma frase descrevendo o vídeo.

## Saída (JSON, nada além dele)
{"caption": "...", "hashtags": ["#..."], "alt": ["..."], "roteiro": [{"tempo": "0-3s", "texto_tela": "...", "narracao": "...", "cena": "..."}], "slides": [ { } ]}`;

const PROMPT_REVISORA = `# Ação: revisão (roda depois de TODO produzir e ajustar)

Você é a revisora de conteúdo da Pólia. Você NÃO reescreve: aprova ou reprova com motivo. Seja dura: peça reprovada custa uma re-tentativa; peça errada publicada custa a marca.

## Entrada (user, JSON)
{"item": { }, "peca": { }}

## Audite nesta ordem
1. Aritmética: refaça TODA conta que aparece (slides tipo "conta", caption, roteiro), linha por linha. Qualquer número que não fecha reprova, e o motivo mostra a conta certa.
2. Proibições dos guardrails: procure literalmente cada termo proibido e o caractere travessão em TODOS os campos de texto. Cuidado com falsos positivos dentro de palavras (análise, comarca) e com a exceção de mito citado entre aspas pra ser desmentido.
3. Quem fala: P5 em primeira pessoa da Sil (e dentro dos limites dela); P1 a P4 na voz da marca; prova social só real.
4. Estrutura: gancho da pauta no slide 1 ou nos 2 primeiros segundos; UM CTA, e da lista permitida; conta antes de conselho; formato da saída respeitando o contrato de tipos de slide.
5. Tom: hype, culpa, infantilização ou didatismo condescendente reprovam. O teste: respeita uma adulta?

## Saída (JSON, nada além dele)
{"veredito": "APROVADA" | "REPROVADA", "motivos": [{"trecho": "...", "regra": "...", "correcao": "..."}], "avisos": ["..."]}`;

const PROMPTS_PRODUZIR: Record<string, string> = {
  carrossel: PROMPT_COPY_CARROSSEL,
  story: PROMPT_COPY_CARROSSEL,
  foto: PROMPT_COPY_FOTO,
  reel: PROMPT_COPY_REEL,
};

// --- schemas de validação (zod) ---
const itemPautaSchema = z.object({
  dia: z.string(),
  pilar: z.enum(["P1", "P2", "P3", "P4", "P5"]),
  formato: z.enum(["carrossel", "reel", "foto", "story"]),
  gancho: z.string(),
  estrutura: z.string(),
  cta: z.string(),
});
const pautaSaidaSchema = z.object({ itens: z.array(itemPautaSchema) });

// Os prompts (contrato com a IA) usam "foto"; o enum social_tipo do banco usa
// "feed" pro mesmo conceito. Conversão só nessa fronteira.
function formatoParaTipoSocial(formato: string): string {
  return formato === "foto" ? "feed" : formato;
}
function tipoSocialParaFormato(tipo: string): string {
  return tipo === "feed" ? "foto" : tipo;
}

const slideSchema = z
  .object({
    tipo: z.enum(["capa", "conta", "texto", "cta", "visual"]),
    texto: z.string().optional(),
    titulo: z.string().optional(),
    linhas: z.array(z.tuple([z.string(), z.string()])).optional(),
    nota: z.string().optional(),
    destaque: z.string().optional(),
    imagem: z.string().optional(),
    alt: z.string().optional(),
  })
  .passthrough();
const produzirSaidaSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
  alt: z.array(z.string()),
  slides: z.array(slideSchema),
  sugestao_foto: z.string().optional(),
  roteiro: z
    .array(
      z.object({
        tempo: z.string(),
        texto_tela: z.string(),
        narracao: z.string().optional(),
        cena: z.string(),
      }),
    )
    .optional(),
});
const revisoraSaidaSchema = z.object({
  veredito: z.enum(["APROVADA", "REPROVADA"]),
  motivos: z.array(z.object({ trecho: z.string(), regra: z.string(), correcao: z.string() })),
  avisos: z.array(z.string()),
});

// --- JSON Schema pro output_config.format (contrato equivalente aos zod acima) ---
const JSON_SCHEMA_PAUTA = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      itens: {
        type: "array",
        items: {
          type: "object",
          properties: {
            dia: { type: "string" },
            pilar: { type: "string", enum: ["P1", "P2", "P3", "P4", "P5"] },
            formato: { type: "string", enum: ["carrossel", "reel", "foto", "story"] },
            gancho: { type: "string" },
            estrutura: { type: "string" },
            cta: { type: "string" },
          },
          required: ["dia", "pilar", "formato", "gancho", "estrutura", "cta"],
          additionalProperties: false,
        },
      },
    },
    required: ["itens"],
    additionalProperties: false,
  },
};

const JSON_SCHEMA_PRODUZIR = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      caption: { type: "string" },
      hashtags: { type: "array", items: { type: "string" } },
      alt: { type: "array", items: { type: "string" } },
      slides: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tipo: { type: "string", enum: ["capa", "conta", "texto", "cta", "visual"] },
            texto: { type: "string" },
            titulo: { type: "string" },
            linhas: { type: "array", items: { type: "array", items: { type: "string" } } },
            nota: { type: "string" },
            destaque: { type: "string" },
            imagem: { type: "string" },
            alt: { type: "string" },
          },
          required: ["tipo"],
          additionalProperties: false,
        },
      },
      sugestao_foto: { type: "string" },
      roteiro: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tempo: { type: "string" },
            texto_tela: { type: "string" },
            narracao: { type: "string" },
            cena: { type: "string" },
          },
          required: ["tempo", "texto_tela", "cena"],
          additionalProperties: false,
        },
      },
    },
    required: ["caption", "hashtags", "alt", "slides"],
    additionalProperties: false,
  },
};

const JSON_SCHEMA_REVISORA = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      veredito: { type: "string", enum: ["APROVADA", "REPROVADA"] },
      motivos: {
        type: "array",
        items: {
          type: "object",
          properties: { trecho: { type: "string" }, regra: { type: "string" }, correcao: { type: "string" } },
          required: ["trecho", "regra", "correcao"],
          additionalProperties: false,
        },
      },
      avisos: { type: "array", items: { type: "string" } },
    },
    required: ["veredito", "motivos", "avisos"],
    additionalProperties: false,
  },
};

interface ItemPauta {
  pilar: string;
  formato: string;
  gancho: string;
  estrutura: string;
  cta: string;
}

async function assertAdmin(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseCaller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await supabaseCaller.auth.getUser();
  if (!userData.user) throw new Error("Unauthorized");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!profile?.is_admin) throw new Error("Forbidden");
  return userData.user.id;
}

async function chamarClaude(
  system: string,
  userJson: unknown,
  format: { type: string; schema: Record<string, unknown> },
): Promise<{ dados: unknown; tokensIn: number; tokensOut: number }> {
  const resposta = await getAnthropic().messages.create({
    model: MODELO,
    max_tokens: 8000,
    system,
    // deno-lint-ignore no-explicit-any
    output_config: { format } as any,
    messages: [{ role: "user", content: JSON.stringify(userJson) }],
  });
  // deno-lint-ignore no-explicit-any
  const bloco = (resposta.content as any[]).find((b) => b.type === "text");
  if (!bloco) throw new Error("Resposta da IA sem bloco de texto.");
  return {
    dados: JSON.parse(bloco.text),
    tokensIn: resposta.usage.input_tokens,
    tokensOut: resposta.usage.output_tokens,
  };
}

async function registrarGeracao(
  postId: string | null,
  acao: string,
  tokensIn: number,
  tokensOut: number,
  veredito?: string,
) {
  await supabaseAdmin.from("social_geracoes").insert({
    post_id: postId,
    acao,
    modelo: MODELO,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    veredito_revisora: veredito ?? null,
  });
}

/** Monday (segunda-feira, ISO) da semana que contém `diaIso`. */
function segundaFeiraDa(diaIso: string): string {
  const d = new Date(`${diaIso}T00:00:00Z`);
  const diaSemana = d.getUTCDay(); // 0=domingo
  const offset = diaSemana === 0 ? -6 : 1 - diaSemana;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function handlePauta(input: {
  semana_inicial: string;
  backlog?: string[];
  metricas?: unknown[];
  contexto?: string;
}) {
  const { dados, tokensIn, tokensOut } = await chamarClaude(
    `${GUARDRAILS}\n\n${PROMPT_PAUTA}`,
    input,
    JSON_SCHEMA_PAUTA,
  );
  const parsed = pautaSaidaSchema.parse(dados);
  await registrarGeracao(null, "pauta", tokensIn, tokensOut);

  const linhas = parsed.itens.map((item) => ({
    semana: segundaFeiraDa(item.dia),
    dia: item.dia,
    pilar: item.pilar,
    formato: formatoParaTipoSocial(item.formato),
    gancho: item.gancho,
    estrutura: item.estrutura,
    cta: item.cta,
    status: "sugerida",
  }));

  const { data: inseridos, error } = await supabaseAdmin.from("social_pauta").insert(linhas).select();
  if (error) throw new Error(`Falha ao salvar a pauta: ${error.message}`);
  return { itens: inseridos };
}

/** copy -> revisora -> (re-produz até 2x se reprovada). Sempre devolve a última versão + veredito. */
async function produzirComRevisao(
  item: ItemPauta,
  versaoAtual: unknown | null,
  pedidoDeAjuste: string | null,
  postIdParaLog: string | null,
): Promise<{ peca: z.infer<typeof produzirSaidaSchema>; veredito: z.infer<typeof revisoraSaidaSchema> }> {
  const promptFormato = PROMPTS_PRODUZIR[item.formato] ?? PROMPTS_PRODUZIR.carrossel;
  let motivosRevisora: unknown = null;
  let ultimaPeca: z.infer<typeof produzirSaidaSchema> | null = null;
  let ultimoVeredito: z.infer<typeof revisoraSaidaSchema> | null = null;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_REVISORA; tentativa++) {
    const entradaCopy = {
      item,
      versao_atual: versaoAtual,
      pedido_de_ajuste: pedidoDeAjuste,
      motivos_revisora: motivosRevisora,
    };
    const copy = await chamarClaude(`${GUARDRAILS}\n\n${promptFormato}`, entradaCopy, JSON_SCHEMA_PRODUZIR);
    const peca = produzirSaidaSchema.parse(copy.dados);
    await registrarGeracao(postIdParaLog, pedidoDeAjuste ? "ajuste" : "copy", copy.tokensIn, copy.tokensOut);

    const revisao = await chamarClaude(
      `${GUARDRAILS}\n\n${PROMPT_REVISORA}`,
      { item, peca },
      JSON_SCHEMA_REVISORA,
    );
    const veredito = revisoraSaidaSchema.parse(revisao.dados);
    await registrarGeracao(postIdParaLog, "revisao", revisao.tokensIn, revisao.tokensOut, veredito.veredito);

    ultimaPeca = peca;
    ultimoVeredito = veredito;
    if (veredito.veredito === "APROVADA") break;
    motivosRevisora = veredito.motivos;
  }

  return { peca: ultimaPeca!, veredito: ultimoVeredito! };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let userId: string;
  try {
    userId = await assertAdmin(req);
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "A chave da IA falhou. Confere o segredo ANTHROPIC_API_KEY." }),
      { status: 200 },
    );
  }

  let body: { acao: string; [key: string]: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Payload inválido." }), { status: 400 });
  }

  try {
    if (body.acao === "pauta") {
      const resultado = await handlePauta(body as unknown as Parameters<typeof handlePauta>[0]);
      return new Response(JSON.stringify(resultado), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (body.acao === "produzir") {
      const { pauta_id } = body as { pauta_id: string };
      const { data: pautaItem, error: erroPauta } = await supabaseAdmin
        .from("social_pauta")
        .select("*")
        .eq("id", pauta_id)
        .maybeSingle();
      if (erroPauta || !pautaItem) return new Response(JSON.stringify({ error: "Item de pauta não encontrado." }), { status: 404 });

      const item: ItemPauta = {
        pilar: pautaItem.pilar ?? "",
        formato: tipoSocialParaFormato(pautaItem.formato),
        gancho: pautaItem.gancho,
        estrutura: pautaItem.estrutura ?? "",
        cta: pautaItem.cta,
      };
      const { peca, veredito } = await produzirComRevisao(item, null, null, null);

      const tipoSocial = pautaItem.formato;
      const postId = crypto.randomUUID();
      const { error: erroInsert } = await supabaseAdmin.from("social_posts").insert({
        id: postId,
        tipo: tipoSocial,
        pilar: pautaItem.pilar,
        gancho: pautaItem.gancho,
        caption: peca.caption,
        alt_text: peca.alt,
        midias: [],
        status: "rascunho",
        origem_criacao: "ia",
        legenda_por_ia: true,
        slides: peca.slides,
        versoes: [{ v: 1, caption: peca.caption, slides: peca.slides, criado_em: new Date().toISOString() }],
      });
      if (erroInsert) return new Response(JSON.stringify({ error: "Não salvou a peça." }), { status: 500 });

      await supabaseAdmin.from("social_pauta").update({ status: "produzida", post_id: postId }).eq("id", pauta_id);
      await supabaseAdmin.from("admin_audit_log").insert({ admin_id: userId, acao: "produzir_peca_social", alvo: postId });

      return new Response(JSON.stringify({ post_id: postId, veredito }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (body.acao === "ajustar") {
      const { post_id, pedido_de_ajuste } = body as { post_id: string; pedido_de_ajuste: string };
      const { data: post, error: erroPost } = await supabaseAdmin
        .from("social_posts")
        .select("*")
        .eq("id", post_id)
        .maybeSingle();
      if (erroPost || !post) return new Response(JSON.stringify({ error: "Post não encontrado." }), { status: 404 });

      const item: ItemPauta = {
        pilar: post.pilar ?? "",
        formato: tipoSocialParaFormato(post.tipo),
        gancho: post.gancho,
        estrutura: "",
        cta: "",
      };
      const versaoAtual = { caption: post.caption, slides: post.slides };
      const { peca, veredito } = await produzirComRevisao(item, versaoAtual, pedido_de_ajuste, post_id);

      const versoesAtuais = Array.isArray(post.versoes) ? post.versoes : [];
      const novaVersao = {
        v: versoesAtuais.length + 1,
        caption: peca.caption,
        slides: peca.slides,
        pedido_de_ajuste,
        criado_em: new Date().toISOString(),
      };
      const novoStatus = post.status === "aprovado" || post.status === "agendado" ? "revisado" : post.status;

      const { error: erroUpdate } = await supabaseAdmin
        .from("social_posts")
        .update({
          caption: peca.caption,
          alt_text: peca.alt,
          slides: peca.slides,
          versoes: [...versoesAtuais, novaVersao],
          status: novoStatus,
        })
        .eq("id", post_id);
      if (erroUpdate) return new Response(JSON.stringify({ error: "Não salvou o ajuste." }), { status: 500 });

      await supabaseAdmin.from("admin_audit_log").insert({ admin_id: userId, acao: "ajustar_peca_social", alvo: post_id });
      return new Response(JSON.stringify({ post_id, veredito }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação desconhecida." }), { status: 400 });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: `O motor não respondeu. Tenta de novo. (${mensagem})` }), { status: 200 });
  }
});
