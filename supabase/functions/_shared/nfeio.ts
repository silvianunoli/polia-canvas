// Cliente mínimo da API da NFE.io pra NFS-e (PAY-32, 12/10/2026). Só fetch,
// sem SDK: roda no Deno do stripe-webhook. A chave vai no header
// Authorization, sem prefixo, como a NFE.io pede.
//
// Configuração (secrets do Supabase, nunca no código):
//   NFEIO_API_KEY        chave da empresa no painel da NFE.io
//   NFEIO_COMPANY_ID     id da empresa emissora (Nunoli) na NFE.io
//   NFEIO_CODIGO_SERVICO código de serviço municipal que o contador definir
//   NFEIO_DESCRICAO      opcional, texto da nota (padrão abaixo)

const BASE = "https://api.nfe.io/v1";
const TEMPO_LIMITE_MS = 25_000;

export interface ConfigNfeio {
  apiKey: string;
  companyId: string;
  codigoServico: string;
  descricao: string;
}

export function lerConfigNfeio(env: (nome: string) => string | undefined): ConfigNfeio | null {
  const apiKey = env("NFEIO_API_KEY");
  const companyId = env("NFEIO_COMPANY_ID");
  const codigoServico = env("NFEIO_CODIGO_SERVICO");
  if (!apiKey || !companyId || !codigoServico) return null;
  return {
    apiKey,
    companyId,
    codigoServico,
    descricao: env("NFEIO_DESCRICAO") || "Assinatura do software Pólia One",
  };
}

export interface RespostaNfeio {
  ok: boolean;
  /** 0 quando nem chegou resposta (rede caiu ou tempo esgotado). */
  statusHttp: number;
  corpo: Record<string, unknown> | null;
  erro: string | null;
}

async function chamar(
  config: ConfigNfeio,
  metodo: "POST" | "DELETE",
  caminho: string,
  corpo?: unknown,
): Promise<RespostaNfeio> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    const res = await fetch(`${BASE}/companies/${config.companyId}${caminho}`, {
      method: metodo,
      headers: {
        Authorization: config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: controle.signal,
    });
    const texto = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = texto ? (JSON.parse(texto) as Record<string, unknown>) : null;
    } catch {
      json = null;
    }
    return {
      ok: res.ok,
      statusHttp: res.status,
      corpo: json,
      // Só a mensagem, cortada: o corpo pode trazer dado da cliente.
      erro: res.ok ? null : mensagemDeErro(json, texto),
    };
  } catch (err) {
    return {
      ok: false,
      statusHttp: 0,
      corpo: null,
      erro: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

function mensagemDeErro(json: Record<string, unknown> | null, texto: string): string {
  const m = json?.message ?? json?.error ?? (json?.errors as unknown[] | undefined)?.[0];
  const base = typeof m === "string" ? m : m ? JSON.stringify(m) : texto;
  return base.slice(0, 300);
}

export function emitirNfse(
  config: ConfigNfeio,
  dados: { tomador: Record<string, unknown>; valor: number; externalId: string },
): Promise<RespostaNfeio> {
  return chamar(config, "POST", "/serviceinvoices", {
    cityServiceCode: config.codigoServico,
    description: config.descricao,
    servicesAmount: dados.valor,
    borrower: dados.tomador,
    // id da fatura do Stripe: liga a nota à cobrança também do lado da NFE.io.
    externalId: dados.externalId,
  });
}

export function cancelarNfse(config: ConfigNfeio, nfeioId: string): Promise<RespostaNfeio> {
  return chamar(config, "DELETE", `/serviceinvoices/${encodeURIComponent(nfeioId)}`);
}

/**
 * Código IBGE da cidade e bairro pelo CEP (ViaCEP, público e gratuito). A nota
 * pede o código da cidade; o Stripe só guarda o nome. Falhou, devolve null e
 * a nota sai sem endereço em vez de não sair.
 */
export async function buscarCep(
  cep: string,
): Promise<{ codigoIbge: string; bairro: string | null } | null> {
  const digitos = cep.replace(/\D/g, "");
  if (digitos.length !== 8) return null;
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), 8_000);
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, {
      signal: controle.signal,
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { ibge?: string; bairro?: string; erro?: unknown };
    if (j.erro || !j.ibge) return null;
    return { codigoIbge: j.ibge, bairro: j.bairro || null };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
