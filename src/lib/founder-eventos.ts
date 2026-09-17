import { supabase } from "@/integrations/supabase/client";
import { ambienteDoHost, featureDaRota, normalizarPagina } from "@/lib/founder-features";
import type { Json } from "@/integrations/supabase/types";

// Instrumentação de produto do Founder Dashboard (office.usepolia.com.br/founder),
// separada do track() de eventos_analytics: aqui é dado operacional do serviço
// contratado (quem tem conta usou o quê, quando), não rastreamento de
// navegação pública. Por isso grava sempre que há sessão logada, sem depender
// do consentimento de cookies de análise — decisão de 17/09/2026, registrada
// em docs/adr/0001-instrumentacao-founder-eventos.md e na política de
// privacidade. Minimização: sem IP, user agent, geo nem conteúdo digitado.
//
// Sessão = uuid em sessionStorage, renovado depois de 30 min sem evento.
// Heartbeat a cada 60 s só com a aba visível e atividade real nos últimos
// 2 min (é o que dá duração de sessão sem inflar com aba esquecida aberta).
// Eventos vão em lote (a cada 5 s ou 10 eventos) por fetch com keepalive,
// pra sobreviver ao fechamento da aba.

export type EventoFounder =
  | "signup"
  | "login"
  | "logout"
  | "onboarding_started"
  | "onboarding_completed"
  | "business_created"
  | "feature_opened"
  | "feature_completed"
  | "create_product"
  | "edit_product"
  | "create_goal"
  | "edit_goal"
  | "heartbeat"
  | "sessao_fim";

interface Opcoes {
  feature?: string;
  propriedades?: Record<string, Json | undefined>;
}

interface Linha {
  user_id: string | null;
  sessao_id: string;
  evento: EventoFounder;
  feature: string | null;
  pagina: string;
  ambiente: "prod" | "preview" | "dev";
  origem: "client";
  propriedades: Record<string, Json | undefined>;
}

const SESSAO_KEY = "polia-founder-sessao";
const ULTIMO_EVENTO_KEY = "polia-founder-ultimo";
const LOGIN_PENDENTE_KEY = "polia-founder-login-pendente";
const SESSAO_TIMEOUT_MS = 30 * 60 * 1000;
const FLUSH_MS = 5000;
const FLUSH_MAX = 10;
const HEARTBEAT_MS = 60 * 1000;
const JANELA_ATIVIDADE_MS = 2 * 60 * 1000;

let fila: Linha[] = [];
let timerFlush: ReturnType<typeof setTimeout> | null = null;
let ultimaAtividade = 0;

function noBrowser(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function sessaoId(): string {
  const agora = Date.now();
  let id = sessionStorage.getItem(SESSAO_KEY);
  const ultimo = Number(sessionStorage.getItem(ULTIMO_EVENTO_KEY) ?? 0);
  if (!id || agora - ultimo > SESSAO_TIMEOUT_MS) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSAO_KEY, id);
  }
  sessionStorage.setItem(ULTIMO_EVENTO_KEY, String(agora));
  return id;
}

async function sessaoSupabase() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

async function enviar(linhas: Linha[], keepalive: boolean): Promise<void> {
  if (linhas.length === 0) return;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!url || !apikey) return;
  const session = await sessaoSupabase();
  try {
    await fetch(`${url}/rest/v1/founder_eventos`, {
      method: "POST",
      keepalive,
      headers: {
        apikey,
        Authorization: `Bearer ${session?.access_token ?? apikey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(linhas),
    });
  } catch {
    // Instrumentação nunca pode quebrar a experiência da usuária.
  }
}

async function flush(keepalive = false): Promise<void> {
  if (timerFlush) {
    clearTimeout(timerFlush);
    timerFlush = null;
  }
  const lote = fila;
  fila = [];
  await enviar(lote, keepalive);
}

function agendarFlush() {
  if (fila.length >= FLUSH_MAX) {
    void flush();
    return;
  }
  if (!timerFlush) timerFlush = setTimeout(() => void flush(), FLUSH_MS);
}

export async function registrar(evento: EventoFounder, opcoes: Opcoes = {}): Promise<void> {
  if (!noBrowser()) return;
  try {
    const session = await sessaoSupabase();
    const pathname = window.location.pathname;
    fila.push({
      user_id: session?.user.id ?? null,
      sessao_id: sessaoId(),
      evento,
      feature: opcoes.feature ?? featureDaRota(pathname),
      pagina: normalizarPagina(pathname),
      ambiente: ambienteDoHost(window.location.hostname),
      origem: "client",
      propriedades: opcoes.propriedades ?? {},
    });
    agendarFlush();
  } catch {
    // idem: nunca quebra a tela.
  }
}

// Pra logout e outros pontos em que a página vai embora logo depois.
export async function registrarEAguardar(evento: EventoFounder, opcoes: Opcoes = {}) {
  await registrar(evento, opcoes);
  await flush(true);
}

export function registrarAberturaDeTela(pathname: string): void {
  const feature = featureDaRota(pathname);
  if (!feature) return;
  ultimaAtividade = Date.now();
  void registrar("feature_opened", { feature });
}

export function montarHeartbeat(): () => void {
  if (!noBrowser()) return () => {};
  ultimaAtividade = Date.now();
  const marcarAtividade = () => {
    ultimaAtividade = Date.now();
  };
  const opcoes: AddEventListenerOptions = { passive: true };
  window.addEventListener("pointerdown", marcarAtividade, opcoes);
  window.addEventListener("keydown", marcarAtividade, opcoes);
  window.addEventListener("scroll", marcarAtividade, opcoes);

  const intervalo = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - ultimaAtividade > JANELA_ATIVIDADE_MS) return;
    void registrar("heartbeat");
  }, HEARTBEAT_MS);

  const aoSair = () => {
    void registrar("sessao_fim");
    void flush(true);
  };
  window.addEventListener("pagehide", aoSair);

  return () => {
    clearInterval(intervalo);
    window.removeEventListener("pointerdown", marcarAtividade);
    window.removeEventListener("keydown", marcarAtividade);
    window.removeEventListener("scroll", marcarAtividade);
    window.removeEventListener("pagehide", aoSair);
  };
}

// Login/cadastro com Google sai da página antes de saber o resultado: marca a
// intenção e o primeiro mount da área logada decide se foi signup (conta
// criada há menos de 2 min) ou login.
export function marcarLoginPendente(metodo: "google"): void {
  if (!noBrowser()) return;
  sessionStorage.setItem(LOGIN_PENDENTE_KEY, metodo);
}

export async function consumirLoginPendente(): Promise<void> {
  if (!noBrowser()) return;
  const metodo = sessionStorage.getItem(LOGIN_PENDENTE_KEY);
  if (!metodo) return;
  sessionStorage.removeItem(LOGIN_PENDENTE_KEY);
  const session = await sessaoSupabase();
  if (!session) return;
  const criadoHa = Date.now() - new Date(session.user.created_at).getTime();
  const evento: EventoFounder = criadoHa < 2 * 60 * 1000 ? "signup" : "login";
  void registrar(evento, { feature: "conta", propriedades: { metodo } });
}
