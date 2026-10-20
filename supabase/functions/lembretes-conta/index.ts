import { createClient } from "npm:@supabase/supabase-js@2";
import {
  ehTipoRegua,
  montarEmailRegua,
  type TipoRegua,
  lembreteDeConfirmacao,
  lembreteDePreco,
  montarEmailConfirmacao,
  montarEmailPreco,
  type TipoConfirmacao,
  type TipoLembrete,
} from "../_shared/lembretesConta.ts";
import { nichoDoAnuncio } from "../_shared/nichosAnuncio.ts";
import { mascararEmail } from "../_shared/stripeWebhookRegras.ts";

// Lembretes pra conta nova (GRW-33, 14/10/2026). Chamada só pelo pg_cron
// (disparar_lembretes_conta(), migrações 20261014120000 e 20261015090000) a
// cada 15 min, e só quando há conta elegível pra algum dos lembretes abaixo.
// verify_jwt desligado: quem chama não tem sessão; o segredo do cron mora no
// Vault e é conferido por RPC.
//
// Dois tipos, cada um sai uma vez só por conta (lembretes_conta, marcado antes
// de enviar):
// - Confirmação de e-mail (confirmacao_1h e confirmacao_24h), pra conta não
//   confirmada (RPC contas_sem_confirmacao). O link é um magiclink novo: abrir
//   confirma o e-mail e já entra na conta.
// - Primeiro preço (preco_d1, 15/10/2026), pra conta confirmada entre 20 e 72
//   horas sem nenhum preço calculado (RPC contas_sem_preco). Copy pelo nicho do
//   anúncio (utm_content). Link normal pra Calculadora ou Painel, não magiclink:
//   o magiclink vence antes de o e-mail do dia seguinte ser aberto.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SITE_URL = "https://one.usepolia.com.br";
const LOTE = 30;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function autenticado(req: Request): Promise<boolean> {
  const recebido = req.headers.get("x-lembretes-conta-secret") ?? "";
  if (!recebido) return false;
  const { data, error } = await supabaseAdmin.rpc("conferir_segredo_lembretes_conta", {
    p_segredo: recebido,
  });
  if (error) {
    console.error("[lembretes-conta] Falha ao conferir o segredo:", error.message);
    return false;
  }
  return data === true;
}

async function linkQueConfirma(email: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${SITE_URL}/painel` },
  });
  if (error || !data?.properties?.action_link) {
    console.error("[lembretes-conta] Falha ao gerar link:", error?.message);
    return null;
  }
  return data.properties.action_link;
}

async function enviar(email: string, assunto: string, texto: string, html: string) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Pólia <naoresponda@usepolia.com.br>",
      reply_to: "oi@usepolia.com.br",
      to: [email],
      subject: assunto,
      text: texto,
      html,
    }),
  });
  return resp.ok ? null : `Resend HTTP ${resp.status}`;
}

type ContaSemConfirmacao = {
  user_id: string;
  email: string;
  criado_em: string;
  enviados: string[];
};
type ContaSemPreco = {
  user_id: string;
  email: string;
  criado_em: string;
  utm_content: string | null;
  ja_recebeu: boolean;
};
type ContaRegua = {
  user_id: string;
  email: string;
  tipo: string;
  nome: string | null;
  utm_content: string | null;
  teste_fim: string | null;
};
type Email = { assunto: string; texto: string; html: string };
type Envio = {
  user_id: string;
  email: string;
  tipo: TipoLembrete | TipoRegua;
  montar: () => Promise<Email | null>;
};

async function ler<T>(
  rpc: "contas_sem_confirmacao" | "contas_sem_preco" | "contas_regua_ativacao",
): Promise<T[] | null> {
  const { data, error } = await supabaseAdmin.rpc(rpc);
  if (error) {
    console.error(`[lembretes-conta] Falha ao ler ${rpc}:`, error.message);
    return null;
  }
  return (data ?? []) as T[];
}

Deno.serve(async (req: Request) => {
  if (!(await autenticado(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ ok: false, motivo: "sem_resend" }), { status: 500 });
  }

  const [semConfirmacao, semPreco, regua] = await Promise.all([
    ler<ContaSemConfirmacao>("contas_sem_confirmacao"),
    ler<ContaSemPreco>("contas_sem_preco"),
    ler<ContaRegua>("contas_regua_ativacao"),
  ]);
  // Uma leitura que falha não segura as outras; todas falhando é erro de verdade.
  if (!semConfirmacao && !semPreco && !regua) {
    return new Response(JSON.stringify({ ok: false, motivo: "falha_leitura" }), { status: 500 });
  }

  // Primeiro filtra o que cabe, depois corta o lote: quem já recebeu não ocupa
  // vaga de quem ainda não recebeu. Confirmação vem antes porque sem ela a
  // conta nem abre.
  const agora = new Date();
  const envios: Envio[] = [];
  for (const c of semConfirmacao ?? []) {
    const tipo: TipoConfirmacao | null = lembreteDeConfirmacao(
      new Date(c.criado_em),
      agora,
      new Set(c.enviados as TipoLembrete[]),
    );
    if (!tipo) continue;
    envios.push({
      user_id: c.user_id,
      email: c.email,
      tipo,
      montar: async () => {
        const link = await linkQueConfirma(c.email);
        return link ? montarEmailConfirmacao(tipo, link) : null;
      },
    });
  }
  for (const c of semPreco ?? []) {
    const tipo = lembreteDePreco(new Date(c.criado_em), agora, c.ja_recebeu);
    if (!tipo) continue;
    envios.push({
      user_id: c.user_id,
      email: c.email,
      tipo,
      montar: () => Promise.resolve(montarEmailPreco(nichoDoAnuncio(c.utm_content))),
    });
  }

  // Régua de ativação e do teste do Pro (GRW-66). O banco já escolheu um tipo
  // por conta, o mais urgente, e tirou quem recebeu e-mail nas últimas 20 horas.
  for (const c of regua ?? []) {
    if (!ehTipoRegua(c.tipo)) continue;
    const tipo = c.tipo;
    envios.push({
      user_id: c.user_id,
      email: c.email,
      tipo,
      montar: () =>
        Promise.resolve(montarEmailRegua(tipo, { nome: c.nome, testeFim: c.teste_fim, agora })),
    });
  }

  let enviados = 0;
  let falhas = 0;
  for (const envio of envios.slice(0, LOTE)) {
    // Marca antes de enviar: se o envio falhar, não insiste a cada 15 min
    // (na confirmação, o próximo lembrete da janela ainda vem; o preco_d1 é
    // um só e fica por isso mesmo). Conflito = outra execução já pegou.
    const { error: erroMarca } = await supabaseAdmin
      .from("lembretes_conta")
      .insert({ user_id: envio.user_id, tipo: envio.tipo });
    if (erroMarca) continue;

    const email = await envio.montar();
    if (!email) {
      falhas++;
      continue;
    }
    const erro = await enviar(envio.email, email.assunto, email.texto, email.html);
    if (erro) {
      falhas++;
      console.error(
        `[lembretes-conta] ${envio.tipo} não saiu pra ${mascararEmail(envio.email)}: ${erro}`,
      );
    } else {
      enviados++;
    }
  }

  return new Response(JSON.stringify({ ok: true, enviados, falhas }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
