import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  envioDoBanco,
  envioParaBanco,
  envioSchema,
  normalizarCep,
  problemasDoEnvio,
  type EnvioLoja,
} from "./envioLoja";

// Envio da loja de marca (ONE-189): configuração e conexão com o Melhor Envio. Só conta
// com linha em lojas_marca usa. Quem fala com o Melhor Envio é a função melhor-envio do
// Supabase; aqui só se manda o segredo interno e o user_id já autenticado.

const CANAL = "melhor_envio";
const SEM_LOJA = "Esta conta não tem loja.";

async function temLoja(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("lojas_marca" as never)
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data != null;
}

async function chamarMelhorEnvio<T>(corpo: Record<string, unknown>, prazoMs = 20000): Promise<T | null> {
  const { data: segredo } = await supabaseAdmin.rpc("melhor_envio_segredo_interno" as never);
  if (typeof segredo !== "string" || !segredo) return null;
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/functions/v1/melhor-envio`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-melhor-envio-segredo": segredo },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(prazoMs),
    });
    return (await r.json().catch(() => null)) as T | null;
  } catch (e) {
    console.error("[envioLoja] melhor-envio", e instanceof Error ? e.message : String(e));
    return null;
  }
}

export interface StatusEnvioLoja {
  temLoja: boolean;
  envio: EnvioLoja | null;
  conexao: { status: "conectada" | "erro" | "desconectada"; nome: string | null; erro: string | null };
}

export const statusEnvioLoja = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StatusEnvioLoja> => {
    const [{ data: loja }, { data: conexao }] = await Promise.all([
      supabaseAdmin.from("lojas_marca" as never).select("envio").eq("user_id", context.userId).maybeSingle(),
      supabaseAdmin
        .from("canal_conexoes" as never)
        .select("status, loja_nome, ultimo_erro")
        .eq("user_id", context.userId)
        .eq("canal", CANAL)
        .maybeSingle(),
    ]);
    const c = conexao as unknown as { status: string; loja_nome: string | null; ultimo_erro: string | null } | null;
    const status = c?.status === "conectada" ? "conectada" : c?.status === "erro" ? "erro" : "desconectada";
    return {
      temLoja: loja != null,
      envio: loja ? envioDoBanco((loja as unknown as { envio: unknown }).envio) : null,
      conexao: {
        status,
        nome: status === "conectada" ? (c?.loja_nome ?? null) : null,
        erro: status === "erro" ? (c?.ultimo_erro ?? null) : null,
      },
    };
  });

export const salvarEnvioLoja = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => envioSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error: string | null }> => {
    if (!(await temLoja(context.userId))) return { ok: false, error: SEM_LOJA };
    const problemas = problemasDoEnvio(data);
    if (problemas.length) return { ok: false, error: problemas[0] };
    const { error } = await supabaseAdmin
      .from("lojas_marca" as never)
      .update({ envio: envioParaBanco(data), updated_at: new Date().toISOString() } as never)
      .eq("user_id", context.userId);
    if (error) {
      console.error("[envioLoja] salvar", error.message);
      return { ok: false, error: "A Pólia One não conseguiu salvar o envio. Tenta de novo." };
    }
    return { ok: true, error: null };
  });

export const iniciarConexaoMelhorEnvio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string | null; error: string | null }> => {
    if (!(await temLoja(context.userId))) return { url: null, error: SEM_LOJA };
    const r = await chamarMelhorEnvio<{ url: string | null; erro: string | null }>({
      acao: "iniciar",
      user_id: context.userId,
    });
    if (r?.url) return { url: r.url, error: null };
    if (r?.erro === "ja_conectada") return { url: null, error: "O Melhor Envio já está conectado." };
    if (r?.erro === "nao_configurado")
      return { url: null, error: "A conexão com o Melhor Envio ainda não está ligada na Pólia One." };
    return { url: null, error: "A Pólia One não conseguiu iniciar a conexão. Tenta de novo." };
  });

// O code do Melhor Envio é longo e cresce com os escopos pedidos: passou de 1000 caracteres.
const finalizarInput = z.object({ code: z.string().min(1).max(4096), state: z.string().min(1).max(100) });

export const finalizarConexaoMelhorEnvio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => finalizarInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error: string | null; nome?: string }> => {
    const r = await chamarMelhorEnvio<{ ok: boolean; erro: string | null; nome?: string }>({
      acao: "trocar",
      user_id: context.userId,
      code: data.code,
      state: data.state,
    });
    if (r?.ok) return { ok: true, error: null, nome: r.nome };
    if (r?.erro === "state") return { ok: false, error: "Essa conexão expirou ou não é sua. Tenta conectar de novo." };
    return { ok: false, error: "O Melhor Envio não confirmou a autorização. Tenta conectar de novo." };
  });

export const desconectarMelhorEnvio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; error: string | null }> => {
    const r = await chamarMelhorEnvio<{ ok: boolean }>({ acao: "desconectar", user_id: context.userId });
    return r?.ok
      ? { ok: true, error: null }
      : { ok: false, error: "A Pólia One não conseguiu desconectar agora. Tenta de novo." };
  });

export type StatusEtiqueta = "carrinho" | "paga" | "gerada" | null;

export interface EtiquetaDoPedido {
  servico: string;
  empresa: string;
  freteCobrado: number;
  destino: string;
  status: StatusEtiqueta;
  custo: number | null;
}

/** Só pedido pago na loja com frete tem etiqueta. Os outros devolvem null. */
export const lerEtiquetaDoPedido = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ vendaId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<EtiquetaDoPedido | null> => {
    const { data: linha } = await supabaseAdmin
      .from("loja_checkouts" as never)
      .select("frete, frete_servico, endereco, etiqueta_status, etiqueta_custo")
      .eq("user_id", context.userId)
      .eq("venda_id", data.vendaId)
      .eq("status", "pago")
      .eq("entrega_tipo", "frete")
      .maybeSingle();
    const c = linha as unknown as {
      frete: number | string;
      frete_servico: { nome?: string; empresa?: string } | null;
      endereco: { cidade?: string; uf?: string } | null;
      etiqueta_status: StatusEtiqueta;
      etiqueta_custo: number | string | null;
    } | null;
    if (!c) return null;
    return {
      servico: c.frete_servico?.nome ?? "Frete",
      empresa: c.frete_servico?.empresa ?? "",
      freteCobrado: Number(c.frete),
      destino: [c.endereco?.cidade, c.endereco?.uf].filter(Boolean).join("/"),
      status: c.etiqueta_status,
      custo: c.etiqueta_custo == null ? null : Number(c.etiqueta_custo),
    };
  });

export interface ResultadoEtiqueta {
  ok: boolean;
  error: string | null;
  status?: StatusEtiqueta;
  custo?: number | null;
  saldo?: number | null;
  url?: string | null;
}

const ERROS_ETIQUETA: Record<string, string> = {
  sem_conexao: "O Melhor Envio não está conectado. Conecte de novo em Configurações.",
  sem_pedido: "Este pedido não tem etiqueta para esse passo.",
  ocupado: "Outra ação nesta etiqueta está em andamento. Tenta de novo em instantes.",
  sem_pacote: "Este pedido não guardou as medidas do pacote. Compre a etiqueta direto no Melhor Envio.",
  varias_caixas: "Esta transportadora não aceita mais de uma caixa na mesma etiqueta. Compre direto no Melhor Envio.",
  dados: "Faltam dados de entrega neste pedido.",
  carrinho: "O Melhor Envio não aceitou a etiqueta. Confira os dados do remetente em Configurações.",
  compra: "O Melhor Envio não concluiu a compra. Confira o saldo da carteira.",
  gerar: "A etiqueta foi paga, mas não foi gerada. Tenta gerar de novo.",
  imprimir: "O Melhor Envio não devolveu o link de impressão. Tenta de novo.",
  cancelar: "O Melhor Envio não cancelou a etiqueta. Se ela já foi postada, não dá mais para cancelar.",
};

export const acaoEtiqueta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ vendaId: z.string().uuid(), acao: z.enum(["preparar", "comprar", "imprimir", "cancelar"]) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ResultadoEtiqueta> => {
    if (!(await temLoja(context.userId))) return { ok: false, error: SEM_LOJA };
    const r = await chamarMelhorEnvio<{
      ok: boolean;
      erro?: string;
      mensagem?: string | null;
      status?: StatusEtiqueta;
      custo?: number | null;
      saldo?: number | null;
      url?: string | null;
    }>({ acao: `etiqueta_${data.acao}`, user_id: context.userId, venda_id: data.vendaId }, 50000);
    if (r?.ok) return { ok: true, error: null, status: r.status, custo: r.custo, saldo: r.saldo, url: r.url };
    const base = (r?.erro && ERROS_ETIQUETA[r.erro]) || "A Pólia One não conseguiu falar com o Melhor Envio agora. Tenta de novo.";
    return { ok: false, error: r?.mensagem ? `${base} Motivo: ${r.mensagem}` : base, status: r?.status };
  });

export interface EnderecoDoCep {
  rua: string;
  bairro: string;
  cidade: string;
  uf: string;
}

/** Endereço pelo CEP (BrasilAPI). Null quando o CEP não existe ou o serviço não responde. */
export const buscarCep = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ cep: z.string().max(12) }).parse(input))
  .handler(async ({ data }): Promise<EnderecoDoCep | null> => {
    const cep = normalizarCep(data.cep);
    if (!cep) return null;
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, { signal: AbortSignal.timeout(6000) });
      if (!r.ok) return null;
      const j = (await r.json()) as { street?: string; neighborhood?: string; city?: string; state?: string };
      return { rua: j.street ?? "", bairro: j.neighborhood ?? "", cidade: j.city ?? "", uf: j.state ?? "" };
    } catch {
      return null;
    }
  });
