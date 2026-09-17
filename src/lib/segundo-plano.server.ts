import { AsyncLocalStorage } from "node:async_hooks";

// No Cloudflare Workers, promessa que ninguém aguarda é cancelada assim que a
// resposta sai — a menos que passe pelo ctx.waitUntil do ExecutionContext.
// A telemetria do Founder Dashboard (middleware do start.ts,
// founder-eventos.server) registra a tarefa aqui; o fetch handler
// (src/server.ts) drena a fila e entrega ao waitUntil antes de devolver a
// resposta. O AsyncLocalStorage é o caminho preferido (liga a tarefa à
// requisição certa); a fila global é a rede de segurança caso o contexto não
// se propague por dentro do handler do TanStack/Nitro.

type WaitUntil = (tarefa: Promise<unknown>) => void;

export interface ContextoDeExecucao {
  waitUntil: WaitUntil;
}

const contexto = new AsyncLocalStorage<ContextoDeExecucao>();
const pendentes = new Set<Promise<unknown>>();

// O Nitro (preset cloudflare-module) não repassa o ExecutionContext como 3º
// argumento pro nosso fetch: ele chama `mod.fetch(req)` e pendura o contexto
// na própria Request (`req.waitUntil`, `req.runtime.cloudflare.context`).
// Procura nos três lugares, do mais direto ao mais interno.
export function resolverContextoDeExecucao(
  request: Request,
  ctx: unknown,
): ContextoDeExecucao | null {
  const direto = (ctx as { waitUntil?: unknown } | null | undefined)?.waitUntil;
  if (typeof direto === "function") {
    return { waitUntil: (t) => (direto as WaitUntil).call(ctx, t) };
  }
  const req = request as Request & {
    waitUntil?: unknown;
    runtime?: { cloudflare?: { context?: { waitUntil?: unknown } } };
  };
  if (typeof req.waitUntil === "function") {
    return { waitUntil: (t) => (req.waitUntil as WaitUntil)(t) };
  }
  const interno = req.runtime?.cloudflare?.context;
  if (interno && typeof interno.waitUntil === "function") {
    return { waitUntil: (t) => (interno.waitUntil as WaitUntil).call(interno, t) };
  }
  return null;
}

export function comContextoDeExecucao<T>(
  execucao: ContextoDeExecucao | null,
  fn: () => T | Promise<T>,
): Promise<T> {
  if (!execucao) return Promise.resolve(fn());
  return Promise.resolve(contexto.run(execucao, fn));
}

// Aceita thenable (o builder do supabase-js não é Promise de verdade). Fora
// de um Worker (dev, teste) a tarefa só roda solta com o erro engolido —
// telemetria nunca derruba o que a disparou.
export function emSegundoPlano(tarefa: PromiseLike<unknown>): void {
  const silenciosa = Promise.resolve(tarefa).catch(() => undefined);
  const store = contexto.getStore();
  if (store) {
    store.waitUntil(silenciosa);
    return;
  }
  pendentes.add(silenciosa);
  void silenciosa.finally(() => pendentes.delete(silenciosa));
}

// Chamado pelo fetch handler depois de montar a resposta: tudo que ficou na
// fila global vai pro waitUntil da requisição atual. Tarefa de outra
// requisição concorrente pode cair aqui também — inofensivo, só mantém o
// isolate vivo até ela terminar.
export function drenarSegundoPlano(execucao: ContextoDeExecucao | null): void {
  if (!execucao || pendentes.size === 0) return;
  const tarefas = [...pendentes];
  pendentes.clear();
  execucao.waitUntil(Promise.allSettled(tarefas));
}
