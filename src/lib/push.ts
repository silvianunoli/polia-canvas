import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/platform";

// Avisos push no app Android (AND-06, 27/10/2026). Só existe dentro do app
// (Capacitor); no navegador tudo aqui vira "indisponivel" e não faz nada.
//
// Caminho: permissão do Android → register() → o Firebase devolve um token →
// RPC registrar_aparelho_push grava na conta logada. Quem envia é a edge
// function push-lembretes (servidor). Ao sair da conta, esquecerAparelhoPush()
// tira o celular da conta antes do signOut (depois não há mais sessão pra isso).

export type EstadoPush = "indisponivel" | "pendente" | "ativo" | "negado";

const TOKEN_KEY = "polia-push-token";
const JA_PEDIU_KEY = "polia-push-ja-pediu";

function lerStorage(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravarStorage(chave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch {
    // storage bloqueado: o pior caso é pedir a permissão de novo
  }
}

/** Só rota interna ("/vendas"), nunca URL de fora vinda do aviso. */
export function rotaSegura(rota: unknown): string | null {
  if (typeof rota !== "string") return null;
  return /^\/(?!\/)[\w\-/]*$/.test(rota) ? rota : null;
}

export async function estadoPush(): Promise<EstadoPush> {
  if (!isNativeApp()) return "indisponivel";
  const { receive } = await PushNotifications.checkPermissions();
  if (receive === "granted") return "ativo";
  if (receive === "denied") return "negado";
  return "pendente";
}

/** Pede a permissão (se ainda não decidida) e registra o celular. */
export async function ativarPush(): Promise<EstadoPush> {
  if (!isNativeApp()) return "indisponivel";
  gravarStorage(JA_PEDIU_KEY, "1");
  let { receive } = await PushNotifications.checkPermissions();
  if (receive !== "granted" && receive !== "denied") {
    ({ receive } = await PushNotifications.requestPermissions());
  }
  if (receive !== "granted") return "negado";
  await PushNotifications.register();
  return "ativo";
}

/**
 * Liga os ouvintes uma vez por abertura da área logada: grava o token quando
 * o Firebase entrega, abre a tela do aviso tocado e, na primeira vez, pede a
 * permissão. Devolve a função que desliga os ouvintes.
 */
export async function iniciarPush(abrirRota: (rota: string) => void): Promise<() => void> {
  if (!isNativeApp()) return () => {};

  const ouvintes = await Promise.all([
    PushNotifications.addListener("registration", ({ value }) => {
      void supabase
        .rpc("registrar_aparelho_push", { p_token: value, p_plataforma: "android" })
        .then(({ error }) => {
          if (error) {
            console.error("[push] Falha ao registrar o aparelho:", error.message);
            return;
          }
          gravarStorage(TOKEN_KEY, value);
        });
    }),
    PushNotifications.addListener("registrationError", (erro) => {
      console.error("[push] O Firebase não registrou o aparelho:", erro.error);
    }),
    PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const rota = rotaSegura(notification.data?.rota);
      if (rota) abrirRota(rota);
    }),
  ]);

  const estado = await estadoPush();
  if (estado === "ativo") {
    // Token pode trocar (reinstalação, outra conta no mesmo celular): registra
    // de novo a cada abertura, a RPC só atualiza.
    await PushNotifications.register();
  } else if (estado === "pendente" && !lerStorage(JA_PEDIU_KEY)) {
    await ativarPush();
  }

  return () => {
    for (const o of ouvintes) void o.remove();
  };
}

/** Chamar antes do signOut: este celular para de receber avisos da conta. */
export async function esquecerAparelhoPush(): Promise<void> {
  const token = lerStorage(TOKEN_KEY);
  if (!token) return;
  try {
    await supabase.rpc("esquecer_aparelho_push", { p_token: token });
  } catch {
    // sem rede: o token fica, e a próxima conta que entrar aqui assume ele
  }
  gravarStorage(TOKEN_KEY, null);
}

export type ResultadoTeste = "ok" | "sem_aparelho" | "falha";

export async function mandarAvisoDeTeste(): Promise<ResultadoTeste> {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; motivo: string | null }>(
    "push-teste",
    { method: "POST" },
  );
  if (error || !data) return "falha";
  if (data.ok) return "ok";
  return data.motivo === "sem_aparelho" ? "sem_aparelho" : "falha";
}
