import { z } from "zod";

// Origem de campanha do cadastro: de qual landing a conta veio e com quais UTMs
// do anúncio. Existe pro teste A/B entre /landing-a e /landing-b (06/10/2026):
// sem isso o anúncio mede clique, mas ninguém sabe qual página virou conta.
//
// Viaja pela URL (landing → /auth/cadastro?origem=...&utm_...) e termina no
// user_metadata da conta. Nenhum cookie. A única exceção é o login pelo Google:
// o OAuth sai do site e volta, então a origem fica guardada no sessionStorage
// da própria aba até a volta e é apagada assim que é lida.

export const CHAVES_UTM = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type ChaveUtm = (typeof CHAVES_UTM)[number];

export type OrigemCampanha = Partial<Record<"origem" | ChaveUtm, string>>;

// Allowlist: letras (com acento), números, espaço e . _ - / | +, até 100
// caracteres. Cobre slug e também o nome de campanha que o Meta manda com
// {{campaign.name}} ("Abertura | Orçamento"). Fora disso (<, aspas, quebra de
// linha, texto longo) o valor é descartado em vez de saneado, porque vai pro banco.
const VALOR_VALIDO = /^[\p{L}\p{N} ._\-/|+]{1,100}$/u;

function valorLimpo(valor: unknown): string | undefined {
  // Número e booleano chegam assim quando o router faz JSON.parse da URL
  // (?utm_content=120212345678 vira number); viram texto de novo aqui.
  if (typeof valor === "number" || typeof valor === "boolean") valor = String(valor);
  if (typeof valor !== "string") return undefined;
  const v = valor.trim();
  return VALOR_VALIDO.test(v) ? v : undefined;
}

/** Só as UTMs válidas de um objeto de busca. */
export function lerUtms(busca: Record<string, unknown>): Partial<Record<ChaveUtm, string>> {
  const saida: Partial<Record<ChaveUtm, string>> = {};
  for (const chave of CHAVES_UTM) {
    const v = valorLimpo(busca[chave]);
    if (v) saida[chave] = v;
  }
  return saida;
}

/** Origem + UTMs válidas. Objeto vazio quando nada veio. */
export function lerOrigemCampanha(busca: Record<string, unknown>): OrigemCampanha {
  const origem = valorLimpo(busca.origem);
  return { ...(origem ? { origem } : {}), ...lerUtms(busca) };
}

/**
 * UTMs lidas da query crua, sem o JSON.parse do router: ID de anúncio com 18
 * dígitos perderia precisão virando number.
 */
export function lerUtmsDaQuery(searchStr: string): Partial<Record<ChaveUtm, string>> {
  const params = new URLSearchParams(searchStr.startsWith("?") ? searchStr.slice(1) : searchStr);
  return lerUtms(Object.fromEntries(params.entries()));
}

/**
 * fbclid que o Meta põe no link do anúncio. Não é origem de campanha (não vai
 * pro user_metadata): só viaja até o cadastro pra API de Conversões casar o
 * cadastro com o clique. Formato do Meta: letras, números, _ e -.
 */
export function lerFbclidDaQuery(searchStr: string): string | undefined {
  const params = new URLSearchParams(searchStr.startsWith("?") ? searchStr.slice(1) : searchStr);
  const v = params.get("fbclid")?.trim();
  return v && /^[A-Za-z0-9_-]{10,500}$/.test(v) ? v : undefined;
}

export function temOrigemCampanha(o: OrigemCampanha): boolean {
  return Object.keys(o).length > 0;
}

/**
 * Campo de busca tolerante pro validateSearch: aceita texto, número ou booleano
 * (o que o router entrega depois do JSON.parse) e nunca derruba a rota.
 */
export const campoDeBusca = z
  .union([z.string(), z.number(), z.boolean()])
  .transform(String)
  .optional()
  .catch(undefined);

/* ───────────────────────── login pelo Google ───────────────────────── */

const CHAVE_OAUTH = "polia-origem-campanha-oauth";

export function guardarOrigemParaOAuth(o: OrigemCampanha): void {
  if (!temOrigemCampanha(o)) return;
  try {
    sessionStorage.setItem(CHAVE_OAUTH, JSON.stringify(o));
  } catch {
    // Sem storage (aba privada, bloqueio): a conta só fica sem origem.
  }
}

/** Lê e apaga. Devolve null se não havia nada ou se o conteúdo não presta. */
export function consumirOrigemDoOAuth(): OrigemCampanha | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE_OAUTH);
    if (!bruto) return null;
    sessionStorage.removeItem(CHAVE_OAUTH);
    const dado: unknown = JSON.parse(bruto);
    if (typeof dado !== "object" || dado === null) return null;
    const o = lerOrigemCampanha(dado as Record<string, unknown>);
    return temOrigemCampanha(o) ? o : null;
  } catch {
    return null;
  }
}
