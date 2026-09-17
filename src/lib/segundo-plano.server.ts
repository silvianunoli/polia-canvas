import { AsyncLocalStorage } from "node:async_hooks";

// No Cloudflare Workers, promessa que ninguém aguarda pode ser cancelada
// assim que a resposta sai — a menos que passe pelo ctx.waitUntil do
// ExecutionContext. O fetch handler (src/server.ts) guarda o contexto aqui,
// por AsyncLocalStorage, pra qualquer telemetria disparada no meio da
// requisição (middleware do start.ts, founder-eventos.server) conseguir
// registrar a própria tarefa sem carregar o ctx pela mão.

type WaitUntil = (tarefa: Promise<unknown>) => void;

const contexto = new AsyncLocalStorage<{ waitUntil: WaitUntil }>();

export function comContextoDeExecucao<T>(ctx: unknown, fn: () => T | Promise<T>): Promise<T> {
  const waitUntil = (ctx as { waitUntil?: WaitUntil } | null | undefined)?.waitUntil;
  if (typeof waitUntil !== "function") return Promise.resolve(fn());
  return Promise.resolve(contexto.run({ waitUntil: (tarefa) => waitUntil.call(ctx, tarefa) }, fn));
}

// Registra a tarefa pra terminar depois da resposta. Aceita thenable (o
// builder do supabase-js não é Promise de verdade). Fora de um Worker (dev,
// teste) só engole o erro — telemetria nunca derruba o que a disparou.
export function emSegundoPlano(tarefa: PromiseLike<unknown>): void {
  const silenciosa = Promise.resolve(tarefa).catch(() => undefined);
  const store = contexto.getStore();
  if (store) {
    store.waitUntil(silenciosa);
  } else {
    void silenciosa;
  }
}
