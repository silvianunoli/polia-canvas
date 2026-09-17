import { supabase } from "@/integrations/supabase/client";
import {
  ambienteDoHostname,
  bucketDaUsuaria,
  decidirFlag,
  type Ambiente,
  type FlagRegistro,
} from "@/lib/flags-regra";

// Leitor de feature flags no client (founder_flags, leitura pública). Cache
// de 60 s por chave+ambiente pra não bater no banco a cada render. Uso:
//   if (await flagAtiva("csat_modal_ativo", userId, false)) ...
const CACHE_MS = 60 * 1000;
const cache = new Map<string, { em: number; flag: FlagRegistro | null }>();

function ambienteAtual(): Ambiente {
  if (typeof window === "undefined") return "prod";
  return ambienteDoHostname(window.location.hostname);
}

async function lerFlag(key: string, ambiente: Ambiente): Promise<FlagRegistro | null> {
  const chave = `${ambiente}:${key}`;
  const emCache = cache.get(chave);
  if (emCache && Date.now() - emCache.em < CACHE_MS) return emCache.flag;
  const { data } = await supabase
    .from("founder_flags")
    .select("estado, rollout_pct, beta_user_ids")
    .eq("key", key)
    .eq("ambiente", ambiente)
    .maybeSingle();
  const flag = (data as FlagRegistro | null) ?? null;
  cache.set(chave, { em: Date.now(), flag });
  return flag;
}

export async function flagAtiva(
  key: string,
  userId: string | null | undefined,
  padrao = false,
): Promise<boolean> {
  try {
    const flag = await lerFlag(key, ambienteAtual());
    const bucket = userId ? await bucketDaUsuaria(userId, key) : null;
    return decidirFlag(flag, userId ?? null, bucket, padrao);
  } catch {
    return padrao;
  }
}
