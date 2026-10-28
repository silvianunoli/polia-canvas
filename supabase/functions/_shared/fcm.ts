// Envio de push pelo Firebase Cloud Messaging, API HTTP v1 (AND-06, 27/10/2026).
//
// A chave da conta de serviço do projeto Firebase polia-7134a mora no segredo
// FIREBASE_SERVICE_ACCOUNT_B64 (o .json inteiro em base64). Com ela a função
// assina um JWT RS256, troca por um access token do Google (vale 1 hora, fica
// em memória enquanto a instância vive) e chama messages:send por aparelho.

export type ContaDeServico = {
  project_id: string;
  client_email: string;
  private_key: string;
};

export type Aviso = { titulo: string; corpo: string; rota: string };

export type ResultadoEnvio = "ok" | "token_invalido" | "erro";

export function lerContaDeServico(base64: string): ContaDeServico | null {
  if (!base64) return null;
  try {
    const json = JSON.parse(new TextDecoder().decode(base64ParaBytes(base64)));
    if (
      typeof json?.project_id !== "string" ||
      typeof json?.client_email !== "string" ||
      typeof json?.private_key !== "string"
    ) {
      return null;
    }
    return {
      project_id: json.project_id,
      client_email: json.client_email,
      private_key: json.private_key,
    };
  } catch {
    return null;
  }
}

function base64ParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function base64Url(dados: Uint8Array | string): string {
  const bytes = typeof dados === "string" ? new TextEncoder().encode(dados) : dados;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemParaPkcs8(pem: string): Uint8Array<ArrayBuffer> {
  const corpo = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  return base64ParaBytes(corpo);
}

let tokenEmCache: { valor: string; venceEm: number } | null = null;

async function tokenDeAcesso(conta: ContaDeServico): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  if (tokenEmCache && tokenEmCache.venceEm - 60 > agora) return tokenEmCache.valor;

  const cabecalho = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = base64Url(
    JSON.stringify({
      iss: conta.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: agora,
      exp: agora + 3600,
    }),
  );
  const chave = await crypto.subtle.importKey(
    "pkcs8",
    pemParaPkcs8(conta.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      chave,
      new TextEncoder().encode(`${cabecalho}.${corpo}`),
    ),
  );
  const jwt = `${cabecalho}.${corpo}.${base64Url(assinatura)}`;

  const resposta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!resposta.ok) {
    throw new Error(`token do Google recusado (${resposta.status})`);
  }
  const dados = await resposta.json();
  tokenEmCache = { valor: dados.access_token, venceEm: agora + Number(dados.expires_in ?? 3600) };
  return tokenEmCache.valor;
}

/**
 * Manda um aviso pra um aparelho. "token_invalido" = o app foi desinstalado ou
 * o token trocou: quem chama apaga o token da tabela.
 */
export async function enviarPush(
  conta: ContaDeServico,
  token: string,
  aviso: Aviso,
): Promise<ResultadoEnvio> {
  const acesso = await tokenDeAcesso(conta);
  const resposta = await fetch(
    `https://fcm.googleapis.com/v1/projects/${conta.project_id}/messages:send`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${acesso}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: aviso.titulo, body: aviso.corpo },
          data: { rota: aviso.rota },
          android: { priority: "high" },
        },
      }),
    },
  );
  if (resposta.ok) return "ok";
  return classificarErroFcm(resposta.status, await resposta.text());
}

/** 404 UNREGISTERED e 400 de token mal formado querem dizer: esquece esse aparelho. */
export function classificarErroFcm(status: number, corpo: string): ResultadoEnvio {
  if (status === 404 || corpo.includes("UNREGISTERED")) return "token_invalido";
  if (status === 400 && corpo.includes("registration token")) return "token_invalido";
  return "erro";
}
