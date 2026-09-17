import { createClient } from "npm:@supabase/supabase-js@2";

// Monitor do Founder Dashboard (office.usepolia.com.br/founder). Roda a cada
// 10 min pelo pg_cron (disparar_founder_monitor -> header x-founder-secret) e
// sob demanda pelo botão "Verificar agora" do admin (JWT de admin no
// Authorization). Faz os health-checks por serviço, grava o snapshot diário
// de métricas, avalia as regras de alerta contra a baseline e, para alerta
// crítico novo, repassa ao alertas-criticos (Telegram, com o dedup dele).
//
// Escreve em founder_service_checks / founder_metricas_diarias /
// founder_alertas. Não toca em alerta_regras/alertas_abertos (motor antigo).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FOUNDER_MONITOR_SECRET = Deno.env.get("FOUNDER_MONITOR_SECRET") ?? "";
const ALERTAS_SECRET = Deno.env.get("ALERTAS_SECRET") ?? "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const URL_HEALTH_PRODUTO = "https://one.usepolia.com.br/health";
const URL_FOUNDER = "https://office.usepolia.com.br/founder";
const STATUS_ASSINATURA_ATIVA = ["active", "trialing", "past_due"];
const OFFSET_BRT_MS = 3 * 3600000;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type StatusServico = "operacional" | "atencao" | "critico" | "sem_dados";

interface Check {
  service: string;
  label: string;
  status: StatusServico;
  detalhe: string;
  latencia_ms: number | null;
}

async function medir<T>(fn: () => Promise<T>, timeoutMs = 8000) {
  const t0 = Date.now();
  try {
    const valor = await Promise.race<T>([
      fn(),
      new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
    ]);
    return { ms: Date.now() - t0, valor, erro: null as unknown };
  } catch (erro) {
    return { ms: Date.now() - t0, valor: undefined as T | undefined, erro };
  }
}

function statusPorLatencia(falhou: boolean, ms: number, limiteMs: number): StatusServico {
  if (falhou) return "critico";
  return ms > limiteMs ? "atencao" : "operacional";
}

// Mensagem de erro do provedor (Stripe/Resend devolvem JSON com message),
// curta e sem eco de credencial, pra explicar o status na tabela de saúde.
async function mensagemDoProvedor(resp: Response): Promise<string> {
  try {
    const corpo = await resp.json();
    const msg = corpo?.error?.message ?? corpo?.message ?? corpo?.name ?? "";
    return String(msg).slice(0, 120);
  } catch {
    return "";
  }
}

async function checarBanco(): Promise<Check> {
  const r = await medir(async () => {
    const { error } = await admin.from("profiles").select("id", { head: true, count: "exact" });
    if (error) throw error;
  });
  const falhou = r.erro !== null;
  return {
    service: "banco_dados",
    label: "Banco de dados",
    status: statusPorLatencia(falhou, r.ms, 1500),
    detalhe: falhou ? "Consulta de teste em profiles falhou." : `Consulta de teste em ${r.ms}ms.`,
    latencia_ms: r.ms,
  };
}

async function checarAuth(): Promise<Check> {
  const r = await medir(async () => {
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) throw error;
  });
  const falhou = r.erro !== null;
  return {
    service: "autenticacao",
    label: "Autenticação",
    status: statusPorLatencia(falhou, r.ms, 1500),
    detalhe: falhou ? "Listagem de teste no Auth falhou." : `Auth respondeu em ${r.ms}ms.`,
    latencia_ms: r.ms,
  };
}

async function checarStorage(): Promise<Check> {
  const r = await medir(async () => {
    const { error } = await admin.storage.listBuckets();
    if (error) throw error;
  });
  const falhou = r.erro !== null;
  return {
    service: "storage",
    label: "Storage",
    status: statusPorLatencia(falhou, r.ms, 1500),
    detalhe: falhou ? "Listagem de buckets falhou." : `Storage respondeu em ${r.ms}ms.`,
    latencia_ms: r.ms,
  };
}

async function checarApi(): Promise<Check> {
  const r = await medir(async () => {
    const resp = await fetch(URL_HEALTH_PRODUTO, { method: "GET" });
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    const corpo = await resp.json().catch(() => ({}));
    if (corpo?.status !== "ok") throw new Error("health sem status ok");
  });
  const falhou = r.erro !== null;
  return {
    service: "api",
    label: "API (one.usepolia.com.br)",
    status: statusPorLatencia(falhou, r.ms, 3000),
    detalhe: falhou ? "/health não respondeu ok a tempo." : `/health respondeu em ${r.ms}ms.`,
    latencia_ms: r.ms,
  };
}

async function checarPagamentos(): Promise<Check> {
  if (!STRIPE_SECRET_KEY) {
    return {
      service: "pagamentos",
      label: "Pagamentos",
      status: "sem_dados",
      detalhe: "STRIPE_SECRET_KEY não configurada no monitor.",
      latencia_ms: null,
    };
  }
  // prices é o recurso que a chave de checkout com certeza lê; balance exige
  // permissão que uma chave restrita pode não ter.
  const r = await medir(async () => {
    const resp = await fetch("https://api.stripe.com/v1/prices?limit=1", {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    return { status: resp.status, msg: resp.ok ? "" : await mensagemDoProvedor(resp) };
  });
  const status = r.erro !== null ? 0 : r.valor!.status;
  const msg = r.erro !== null ? "" : r.valor!.msg;
  const ok = status >= 200 && status < 300;
  return {
    service: "pagamentos",
    label: "Pagamentos",
    status: ok ? statusPorLatencia(false, r.ms, 2500) : status === 403 ? "atencao" : "critico",
    detalhe: ok
      ? `Stripe respondeu em ${r.ms}ms.`
      : status === 0
        ? "Stripe não respondeu a tempo."
        : `Stripe respondeu HTTP ${status}${msg ? `: ${msg}` : ""}`,
    latencia_ms: r.ms,
  };
}

async function checarEmails(): Promise<Check> {
  if (!RESEND_API_KEY) {
    return {
      service: "emails",
      label: "E-mails",
      status: "sem_dados",
      detalhe: "RESEND_API_KEY não configurada no monitor.",
      latencia_ms: null,
    };
  }
  // Chave "sending only" do Resend não lista domínios: 403 significa API de pé
  // e chave reconhecida, só sem permissão de leitura. 401 é chave inválida.
  const r = await medir(async () => {
    const resp = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });
    return { status: resp.status, msg: resp.ok ? "" : await mensagemDoProvedor(resp) };
  });
  const status = r.erro !== null ? 0 : r.valor!.status;
  const msg = r.erro !== null ? "" : r.valor!.msg;
  // Chave só de envio: o Resend responde que a chave não tem permissão de
  // leitura — a API está de pé e a chave é reconhecida, então é operacional.
  const chaveSoEnvio = status === 403 || (status === 400 && /restricted|permission/i.test(msg));
  const ok = (status >= 200 && status < 300) || chaveSoEnvio;
  return {
    service: "emails",
    label: "E-mails",
    status: ok ? statusPorLatencia(false, r.ms, 2500) : "critico",
    detalhe: ok
      ? chaveSoEnvio
        ? `Resend respondeu em ${r.ms}ms (chave só de envio, sem leitura).`
        : `Resend respondeu em ${r.ms}ms.`
      : status === 0
        ? "Resend não respondeu a tempo."
        : `Resend respondeu HTTP ${status}${msg ? `: ${msg}` : ""}`,
    latencia_ms: r.ms,
  };
}

async function checarIa(): Promise<{ check: Check; chamadas: number; falhas: number }> {
  const desde = new Date(Date.now() - 86400000).toISOString();
  const { data, error } = await admin.from("ia_geracoes").select("sucesso").gte("criado_em", desde);
  if (error) {
    return {
      check: {
        service: "ia",
        label: "IA",
        status: "critico",
        detalhe: "Não consegui ler ia_geracoes.",
        latencia_ms: null,
      },
      chamadas: 0,
      falhas: 0,
    };
  }
  const linhas = (data ?? []) as { sucesso: boolean }[];
  const chamadas = linhas.length;
  const falhas = linhas.filter((l) => !l.sucesso).length;
  if (chamadas === 0) {
    return {
      check: {
        service: "ia",
        label: "IA",
        status: "sem_dados",
        detalhe: "Nenhuma chamada de IA nas últimas 24h.",
        latencia_ms: null,
      },
      chamadas,
      falhas,
    };
  }
  const taxa = falhas / chamadas;
  return {
    check: {
      service: "ia",
      label: "IA",
      status: taxa > 0.5 ? "critico" : taxa > 0.3 ? "atencao" : "operacional",
      detalhe: `${chamadas} chamada(s) em 24h, ${falhas} falha(s).`,
      latencia_ms: null,
    },
    chamadas,
    falhas,
  };
}

function dataBRT(instante = Date.now()): string {
  return new Date(instante - OFFSET_BRT_MS).toISOString().slice(0, 10);
}

interface Snapshot {
  dia: string;
  usuarias_total: number;
  novas_contas: number;
  usuarias_ativas: number;
  assinantes: number;
  mrr_centavos: number;
  churn_pct: number | null;
  erros_dia: number;
  ia_chamadas: number;
  ia_falhas: number;
  jobs_falhos: number;
  pagamentos_falhos: number;
  dau: number;
  wau: number;
  mau: number;
  sessoes: number;
  api_requests: number;
  api_erros: number;
  api_p95_ms: number | null;
}

// "Ativa" = ação real no produto (nunca feature_opened/heartbeat) — mesma
// definição usada no /founder.
const EVENTOS_ATIVOS = [
  "feature_completed",
  "create_product",
  "edit_product",
  "create_goal",
  "edit_goal",
  "onboarding_completed",
  "business_created",
];

async function usuariasAtivasDesde(desde: string): Promise<number> {
  const { data } = await admin
    .from("founder_eventos")
    .select("user_id")
    .in("evento", EVENTOS_ATIVOS)
    .not("user_id", "is", null)
    .gte("criado_em", desde)
    .limit(20000);
  return new Set(((data ?? []) as { user_id: string }[]).map((l) => l.user_id)).size;
}

async function sessoesDesde(desde: string): Promise<number> {
  const { data } = await admin
    .from("founder_eventos")
    .select("sessao_id")
    .gte("criado_em", desde)
    .limit(50000);
  return new Set(((data ?? []) as { sessao_id: string }[]).map((l) => l.sessao_id)).size;
}

async function apiDesde(
  desde: string,
): Promise<{ requests: number; erros: number; p95: number | null }> {
  const { data } = await admin
    .from("founder_api_chamadas")
    .select("ok, latencia_ms")
    .gte("criado_em", desde)
    .limit(50000);
  const linhas = (data ?? []) as { ok: boolean; latencia_ms: number }[];
  if (linhas.length === 0) return { requests: 0, erros: 0, p95: null };
  const lat = linhas.map((l) => l.latencia_ms).sort((a, b) => a - b);
  const p95 = lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.95))];
  return { requests: linhas.length, erros: linhas.filter((l) => !l.ok).length, p95 };
}

async function contar(tabela: string, filtro?: (q: any) => any): Promise<number> {
  let q = admin.from(tabela).select("id", { head: true, count: "exact" });
  if (filtro) q = filtro(q);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

const cachePrecos = new Map<string, number>();
async function valorMensalDoPrice(priceId: string): Promise<number> {
  const emCache = cachePrecos.get(priceId);
  if (emCache !== undefined) return emCache;
  if (!STRIPE_SECRET_KEY) return 0;
  try {
    const resp = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    if (!resp.ok) return 0;
    const price = await resp.json();
    const valor: number = price.unit_amount ?? 0;
    const intervalo: string = price.recurring?.interval ?? "month";
    const mensal = intervalo === "year" ? Math.round(valor / 12) : valor;
    cachePrecos.set(priceId, mensal);
    return mensal;
  } catch {
    return 0;
  }
}

async function montarSnapshot(ia: { chamadas: number; falhas: number }): Promise<Snapshot> {
  const ontem = new Date(Date.now() - 86400000).toISOString();
  const semana = new Date(Date.now() - 7 * 86400000).toISOString();
  const mes = new Date(Date.now() - 30 * 86400000).toISOString();
  const [usuariasTotal, novasContas, errosDia, { data: assinaturas }, dau, wau, mau, sessoes, api] =
    await Promise.all([
      contar("profiles"),
      contar("profiles", (q) => q.gte("created_at", ontem)),
      contar("erros_app", (q) => q.gte("criado_em", ontem)),
      admin.from("assinaturas").select("price_id, status, updated_at"),
      usuariasAtivasDesde(ontem),
      usuariasAtivasDesde(semana),
      usuariasAtivasDesde(mes),
      sessoesDesde(ontem),
      apiDesde(ontem),
    ]);
  const usuariasAtivas = dau;

  const linhas = (assinaturas ?? []) as { price_id: string; status: string; updated_at: string }[];
  const ativas = linhas.filter((a) => STATUS_ASSINATURA_ATIVA.includes(a.status));
  const canceladas24h = linhas.filter((a) => a.status === "canceled" && a.updated_at >= ontem);
  const pagamentosFalhos = linhas.filter((a) => ["past_due", "unpaid"].includes(a.status)).length;

  let mrr = 0;
  for (const a of ativas) mrr += await valorMensalDoPrice(a.price_id);

  const baseChurn = ativas.length + canceladas24h.length;
  const churn = baseChurn > 0 ? (canceladas24h.length / baseChurn) * 100 : null;

  let jobsFalhos = 0;
  const { data: jf } = await admin.rpc("founder_jobs_falhos", { p_horas: 24 });
  if (typeof jf === "number") jobsFalhos = jf;

  return {
    dia: dataBRT(),
    usuarias_total: usuariasTotal,
    novas_contas: novasContas,
    usuarias_ativas: usuariasAtivas,
    assinantes: ativas.length,
    mrr_centavos: mrr,
    churn_pct: churn,
    erros_dia: errosDia,
    ia_chamadas: ia.chamadas,
    ia_falhas: ia.falhas,
    jobs_falhos: jobsFalhos,
    pagamentos_falhos: pagamentosFalhos,
    dau,
    wau,
    mau,
    sessoes,
    api_requests: api.requests,
    api_erros: api.erros,
    api_p95_ms: api.p95,
  };
}

interface AlertaNovo {
  chave: string;
  tipo: string;
  severidade: "atencao" | "critico";
  titulo: string;
  mensagem: string;
  detalhes: Record<string, unknown>;
  link: string;
}

interface Baseline {
  dias: number;
  errosDiaMedia: number | null;
  apiErrosMedia: number | null;
  apiP95Media: number | null;
  dauMedia: number | null;
}

function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

async function carregarBaseline(): Promise<Baseline> {
  const hoje = dataBRT();
  const { data } = await admin
    .from("founder_metricas_diarias")
    .select("erros_dia, api_erros, api_p95_ms, dau")
    .lt("dia", hoje)
    .order("dia", { ascending: false })
    .limit(7);
  const linhas = (data ?? []) as {
    erros_dia: number;
    api_erros: number;
    api_p95_ms: number | null;
    dau: number;
  }[];
  if (linhas.length < 3) {
    return {
      dias: linhas.length,
      errosDiaMedia: null,
      apiErrosMedia: null,
      apiP95Media: null,
      dauMedia: null,
    };
  }
  return {
    dias: linhas.length,
    errosDiaMedia: media(linhas.map((l) => l.erros_dia)),
    apiErrosMedia: media(linhas.map((l) => l.api_erros)),
    apiP95Media: media(
      linhas.filter((l) => l.api_p95_ms !== null).map((l) => l.api_p95_ms as number),
    ),
    dauMedia: media(linhas.map((l) => l.dau)),
  };
}

async function ultimoStatusAnterior(service: string): Promise<StatusServico | null> {
  const { data } = await admin
    .from("founder_service_checks")
    .select("status")
    .eq("service", service)
    .order("checado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.status as StatusServico | undefined) ?? null;
}

async function avaliarRegras(
  checks: Check[],
  anteriores: Map<string, StatusServico | null>,
  snap: Snapshot,
  baseline: Baseline,
): Promise<{ desejados: AlertaNovo[]; chavesAvaliadas: string[] }> {
  const desejados: AlertaNovo[] = [];
  const chavesAvaliadas: string[] = [];

  for (const c of checks) {
    const chave = `servico_indisponivel:${c.service}`;
    chavesAvaliadas.push(chave);
    // Só depois de duas rodadas seguidas em crítico: um timeout isolado não é queda.
    if (c.status === "critico" && anteriores.get(c.service) === "critico") {
      desejados.push({
        chave,
        tipo: "servico_indisponivel",
        severidade: "critico",
        titulo: `Serviço indisponível: ${c.label}`,
        mensagem: c.detalhe,
        detalhes: { service: c.service, latencia_ms: c.latencia_ms },
        link: `${URL_FOUNDER}/saude`,
      });
    }
  }

  chavesAvaliadas.push("falha_pagamento");
  if (snap.pagamentos_falhos > 0) {
    desejados.push({
      chave: "falha_pagamento",
      tipo: "falha_pagamento",
      severidade: "atencao",
      titulo: "Assinatura(s) com pagamento pendente",
      mensagem: `${snap.pagamentos_falhos} assinatura(s) em past_due/unpaid.`,
      detalhes: { quantidade: snap.pagamentos_falhos },
      link: `${URL_FOUNDER}/negocio/assinaturas`,
    });
  }

  chavesAvaliadas.push("jobs_falhos");
  if (snap.jobs_falhos > 0) {
    desejados.push({
      chave: "jobs_falhos",
      tipo: "jobs_falhos",
      severidade: snap.jobs_falhos >= 5 ? "critico" : "atencao",
      titulo: "Job(s) agendado(s) falhando",
      mensagem: `${snap.jobs_falhos} execução(ões) de pg_cron falharam nas últimas 24h.`,
      detalhes: { falhas_24h: snap.jobs_falhos },
      link: `${URL_FOUNDER}/operacao/jobs`,
    });
  }

  chavesAvaliadas.push("ia_falhas");
  if (snap.ia_chamadas >= 5 && snap.ia_falhas / snap.ia_chamadas > 0.3) {
    desejados.push({
      chave: "ia_falhas",
      tipo: "ia_falhas",
      severidade: "atencao",
      titulo: "IA falhando acima do normal",
      mensagem: `${snap.ia_falhas} de ${snap.ia_chamadas} chamadas falharam nas últimas 24h.`,
      detalhes: { chamadas: snap.ia_chamadas, falhas: snap.ia_falhas },
      link: `${URL_FOUNDER}/infra/ia`,
    });
  }

  chavesAvaliadas.push("api_erros_acima_normal");
  if (baseline.apiErrosMedia !== null) {
    const limite = Math.max(10, baseline.apiErrosMedia * 3);
    if (snap.api_erros > limite) {
      desejados.push({
        chave: "api_erros_acima_normal",
        tipo: "api_erros_acima_normal",
        severidade: snap.api_erros > baseline.apiErrosMedia * 5 ? "critico" : "atencao",
        titulo: "Erros de API acima do normal",
        mensagem: `${snap.api_erros} chamada(s) com erro em 24h (de ${snap.api_requests}); a média dos últimos ${baseline.dias} dias era ${baseline.apiErrosMedia.toFixed(1)}.`,
        detalhes: {
          erros_24h: snap.api_erros,
          requests_24h: snap.api_requests,
          baseline: baseline.apiErrosMedia,
        },
        link: `${URL_FOUNDER}/infra/api`,
      });
    }
  }

  chavesAvaliadas.push("latencia_p95");
  if (baseline.apiP95Media !== null && snap.api_p95_ms !== null) {
    if (snap.api_p95_ms > 1500 && snap.api_p95_ms > baseline.apiP95Media * 2) {
      desejados.push({
        chave: "latencia_p95",
        tipo: "latencia_p95",
        severidade: "atencao",
        titulo: "Latência da API acima do normal",
        mensagem: `p95 de ${snap.api_p95_ms} ms nas últimas 24h; a média dos últimos ${baseline.dias} dias era ${baseline.apiP95Media.toFixed(0)} ms.`,
        detalhes: { p95_ms: snap.api_p95_ms, baseline_ms: baseline.apiP95Media },
        link: `${URL_FOUNDER}/infra/api`,
      });
    }
  }

  chavesAvaliadas.push("queda_uso");
  if (baseline.dauMedia !== null && snap.mau >= 10 && snap.dau < baseline.dauMedia * 0.5) {
    desejados.push({
      chave: "queda_uso",
      tipo: "queda_uso",
      severidade: "atencao",
      titulo: "Uso caiu em relação à semana",
      mensagem: `${snap.dau} usuária(s) ativa(s) hoje contra média de ${baseline.dauMedia.toFixed(1)} nos últimos ${baseline.dias} dias.`,
      detalhes: { dau: snap.dau, baseline: baseline.dauMedia, mau: snap.mau },
      link: `${URL_FOUNDER}/analytics`,
    });
  }

  chavesAvaliadas.push("pico_erros_app");
  if (baseline.errosDiaMedia !== null) {
    const limite = Math.max(10, baseline.errosDiaMedia * 3);
    if (snap.erros_dia > limite) {
      desejados.push({
        chave: "pico_erros_app",
        tipo: "pico_erros_app",
        severidade: snap.erros_dia > baseline.errosDiaMedia * 5 ? "critico" : "atencao",
        titulo: "Erros do app acima do normal",
        mensagem: `${snap.erros_dia} erro(s) em 24h; a média dos últimos ${baseline.dias} dias era ${baseline.errosDiaMedia.toFixed(1)}.`,
        detalhes: { erros_24h: snap.erros_dia, baseline: baseline.errosDiaMedia, janela: "24h" },
        link: `${URL_FOUNDER}/operacao/erros`,
      });
    }
  }

  return { desejados, chavesAvaliadas };
}

async function notificarCritico(a: AlertaNovo): Promise<void> {
  if (!ALERTAS_SECRET) return;
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/alertas-criticos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-alertas-secret": ALERTAS_SECRET },
      body: JSON.stringify({
        tipo: `founder:${a.tipo}`,
        titulo: a.titulo,
        detalhes: { mensagem: a.mensagem, ...a.detalhes },
        link: a.link,
      }),
    });
  } catch {
    // Telegram fora do ar não pode derrubar o monitor.
  }
}

async function sincronizarAlertas(desejados: AlertaNovo[], chavesAvaliadas: string[]) {
  const { data: abertosData } = await admin
    .from("founder_alertas")
    .select("id, chave_dedup")
    .eq("status", "aberto")
    .in("chave_dedup", chavesAvaliadas);
  const abertos = new Map(
    ((abertosData ?? []) as { id: string; chave_dedup: string }[]).map((a) => [
      a.chave_dedup,
      a.id,
    ]),
  );

  const novos = desejados.filter((d) => !abertos.has(d.chave));
  if (novos.length > 0) {
    await admin.from("founder_alertas").insert(
      novos.map((n) => ({
        chave_dedup: n.chave,
        tipo: n.tipo,
        severidade: n.severidade,
        titulo: n.titulo,
        mensagem: n.mensagem,
        detalhes: n.detalhes,
        link: n.link.replace("https://office.usepolia.com.br", ""),
        origem: "monitor",
      })),
    );
    for (const n of novos) if (n.severidade === "critico") await notificarCritico(n);
  }

  const chavesDesejadas = new Set(desejados.map((d) => d.chave));
  const resolver = [...abertos.entries()]
    .filter(([chave]) => !chavesDesejadas.has(chave))
    .map(([, id]) => id);
  if (resolver.length > 0) {
    await admin
      .from("founder_alertas")
      .update({ status: "resolvido", resolvido_em: new Date().toISOString() })
      .in("id", resolver);
  }

  return { novos: novos.length, resolvidos: resolver.length };
}

async function autorizado(req: Request): Promise<boolean> {
  const porSecret = req.headers.get("x-founder-secret");
  if (FOUNDER_MONITOR_SECRET && porSecret === FOUNDER_MONITOR_SECRET) return true;

  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice("Bearer ".length);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return false;
  const { data: perfil } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", data.user.id)
    .maybeSingle();
  return Boolean(perfil?.is_admin);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!(await autorizado(req))) return new Response("Unauthorized", { status: 401 });

  const [banco, auth, storage, api, pagamentos, emails, ia] = await Promise.all([
    checarBanco(),
    checarAuth(),
    checarStorage(),
    checarApi(),
    checarPagamentos(),
    checarEmails(),
    checarIa(),
  ]);
  const checks: Check[] = [api, banco, auth, pagamentos, emails, ia.check, storage];

  const anteriores = new Map<string, StatusServico | null>();
  for (const c of checks) anteriores.set(c.service, await ultimoStatusAnterior(c.service));

  await admin.from("founder_service_checks").insert(
    checks.map((c) => ({
      service: c.service,
      status: c.status,
      detalhe: c.detalhe,
      latencia_ms: c.latencia_ms,
    })),
  );

  const baseline = await carregarBaseline();
  const snapshot = await montarSnapshot({ chamadas: ia.chamadas, falhas: ia.falhas });
  await admin.from("founder_metricas_diarias").upsert(snapshot, { onConflict: "dia" });

  const { desejados, chavesAvaliadas } = await avaliarRegras(
    checks,
    anteriores,
    snapshot,
    baseline,
  );
  const resultado = await sincronizarAlertas(desejados, chavesAvaliadas);

  return new Response(
    JSON.stringify({
      ok: true,
      checado_em: new Date().toISOString(),
      servicos: checks.map((c) => ({ service: c.service, status: c.status })),
      alertas: resultado,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
