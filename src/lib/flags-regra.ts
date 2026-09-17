// Regra pura das feature flags do Founder Dashboard (founder_flags). Fica
// separada do acesso ao banco pra ser a MESMA decisão no client, no servidor
// (Worker) e testável sem rede.

export interface FlagRegistro {
  estado: "on" | "off" | "beta";
  rollout_pct: number;
  beta_user_ids: string[];
}

export type Ambiente = "prod" | "preview";

// Bucket determinístico 0..99 a partir do sha256 de "userId:key": a mesma
// usuária cai sempre no mesmo lado do rollout, e mudar a flag não embaralha.
export function bucketDoHash(hashHex: string): number {
  return parseInt(hashHex.slice(0, 8), 16) % 100;
}

export async function bucketDaUsuaria(userId: string, key: string): Promise<number> {
  const dados = new TextEncoder().encode(`${userId}:${key}`);
  const digest = await crypto.subtle.digest("SHA-256", dados);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return bucketDoHash(hex);
}

// `padrao` é o que vale quando a flag não existe: kill-switch de IA assume
// ligado (como os leitores antigos), modal de CSAT assume desligado.
export function decidirFlag(
  flag: FlagRegistro | null,
  userId: string | null,
  bucket: number | null,
  padrao: boolean,
): boolean {
  if (!flag) return padrao;
  if (flag.estado === "off") return false;
  const dentroDoRollout = flag.rollout_pct >= 100 || (bucket !== null && bucket < flag.rollout_pct);
  if (flag.estado === "beta") {
    if (userId && flag.beta_user_ids.includes(userId)) return true;
    return userId !== null && dentroDoRollout && flag.rollout_pct > 0;
  }
  // on
  if (flag.rollout_pct >= 100) return true;
  return userId !== null && dentroDoRollout;
}

export function ambienteDoHostname(hostname: string): Ambiente {
  return hostname === "one.usepolia.com.br" ? "prod" : "preview";
}
