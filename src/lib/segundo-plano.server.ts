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

const contexto = new AsyncLocalStorage<{ waitUntil: WaitUntil }>();
const pendentes = new Set<Promise<unknown>>();

export function comContextoDeExecucao<T>(ctx: unknown, fn: () => T | Promise<T>): Promise<T> {
  const waitUntil = (ctx as { waitUntil?: WaitUntil } | null | undefined)?.waitUntil;
  if (typeof waitUntil !== "function") return Promise.resolve(fn());
  return Promise.resolve(contexto.run({ waitUntil: (tarefa) => waitUntil.call(ctx, tarefa) }, fn));
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
export function drenarSegundoPlano(ctx: unknown): void {
  const waitUntil = (ctx as { waitUntil?: WaitUntil } | null | undefined)?.waitUntil;
  if (pendentes.size === 0 || typeof waitUntil !== "function") return;
  const tarefas = [...pendentes];
  pendentes.clear();
  waitUntil.call(ctx, Promise.allSettled(tarefas));
}
