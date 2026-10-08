import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MAX_NICHOS, montarAnoDoBanco, nichoPorChave } from "@/lib/bancoIdeias";
import { temProjete } from "@/lib/planos";
import { hojeEmBrasilia } from "@/lib/data.functions";

// Plano de conteúdo pelo banco fixo de ideias (05/10/2026, decisão da Sil):
// sem IA, sem cota e sem exigir o Planejamento completo. Grava na mesma tabela
// ia_plano_conteudo, então a tela (lista do ano, post do dia, "já postei",
// edição) segue igual. Inserir e apagar só pelo service role ou pela RPC
// substituir_plano_conteudo_do_ano (sem policy de insert/delete pra usuária,
// ver a migration do plano de conteúdo).

const entrada = z.object({
  ano: z.number().int().min(2024).max(2100),
  nichos: z.array(z.string()).min(1).max(MAX_NICHOS),
});

export type ResultadoPlanoBanco =
  | { ok: true; dias: number }
  | { ok: false; motivo: "plano_insuficiente" | "nicho_invalido" | "falha" };

export interface LinhaPlanoDoBanco {
  data: string; // AAAA-MM-DD
  tipo: string;
  titulo: string;
  ideia: string;
}

/**
 * Dias do ano montados pelo banco de ideias, sem os dias que já passaram e
 * já têm linha (o que passou, e o que ela marcou como postado, fica como está).
 */
export function montarLinhasDoPlano(
  ano: number,
  nichos: string[],
  jaTem: ReadonlySet<string>,
): LinhaPlanoDoBanco[] {
  return montarAnoDoBanco(ano, nichos)
    .filter((d) => !jaTem.has(d.data))
    .map((d) => ({ data: d.data, tipo: d.tipo, titulo: d.titulo, ideia: d.ideia }));
}

type Resposta = { error: unknown };

/** RPC ainda não criada (migração 20261008230200 pendente): PostgREST PGRST202, Postgres 42883. */
export function rpcInexistente(erro: unknown): boolean {
  const code = (erro as { code?: unknown } | null)?.code;
  return code === "PGRST202" || code === "42883";
}

export interface OperacoesPlano {
  /** Apaga e insere numa transação só (RPC substituir_plano_conteudo_do_ano). */
  substituirNaTransacao: (
    linhas: LinhaPlanoDoBanco[],
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  /** Caminho antigo, em dois passos, só enquanto a RPC não existe. */
  apagarDeHojeEmDiante: () => PromiseLike<Resposta>;
  inserir: (linhas: LinhaPlanoDoBanco[]) => PromiseLike<Resposta>;
}

export type ResultadoSubstituicao =
  | { ok: true; dias: number; via: "rpc" | "dois_passos" }
  | { ok: false; error: unknown };

/**
 * Troca o plano de hoje em diante. Antes era apagar e depois inserir sem
 * transação: se o insert falhava, o ano sumia da tela. A RPC faz os dois numa
 * transação só. Fallback pro jeito antigo SÓ quando a RPC não existe; qualquer
 * outro erro dela (permissão, plano, linha inválida) vira falha, sem apagar nada.
 */
export async function substituirPlanoDoAno(
  linhas: LinhaPlanoDoBanco[],
  ops: OperacoesPlano,
): Promise<ResultadoSubstituicao> {
  const viaRpc = await ops.substituirNaTransacao(linhas);
  if (!viaRpc.error) {
    const n = Number(viaRpc.data);
    return { ok: true, dias: Number.isFinite(n) ? n : linhas.length, via: "rpc" };
  }
  if (!rpcInexistente(viaRpc.error)) return { ok: false, error: viaRpc.error };

  const apagado = await ops.apagarDeHojeEmDiante();
  if (apagado.error) return { ok: false, error: apagado.error };
  if (linhas.length > 0) {
    const inserido = await ops.inserir(linhas);
    if (inserido.error) return { ok: false, error: inserido.error };
  }
  return { ok: true, dias: linhas.length, via: "dois_passos" };
}

export const montarPlanoConteudoDoBanco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entrada.parse(input))
  .handler(async ({ context, data }): Promise<ResultadoPlanoBanco> => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plano")
      .eq("id", context.userId)
      .maybeSingle();
    if (!temProjete(profile?.plano as string | null | undefined)) {
      return { ok: false, motivo: "plano_insuficiente" };
    }
    if (!data.nichos.every((c) => nichoPorChave(c))) {
      return { ok: false, motivo: "nicho_invalido" };
    }

    // Trocar de nicho refaz de hoje em diante: o que já passou (e o que ela
    // marcou como postado) fica como está. "Hoje" no horário de Brasília: o
    // Worker roda em UTC e, das 21h à meia-noite, o dia dela ainda não virou.
    const hoje = hojeEmBrasilia();
    const { data: passados, error: erroLeitura } = await supabaseAdmin
      .from("ia_plano_conteudo" as never)
      .select("data")
      .eq("user_id", context.userId)
      .eq("ano", data.ano)
      .lt("data", hoje);
    if (erroLeitura) return { ok: false, motivo: "falha" };
    const jaTem = new Set(((passados ?? []) as { data: string }[]).map((p) => p.data));

    const linhas = montarLinhasDoPlano(data.ano, data.nichos, jaTem);

    const resultado = await substituirPlanoDoAno(linhas, {
      // Pelo client da sessão dela (JWT), não pelo service role: a RPC confere
      // auth.uid() = p_user_id e o plano dentro do banco.
      substituirNaTransacao: (ls) =>
        context.supabase.rpc(
          "substituir_plano_conteudo_do_ano" as never,
          {
            p_user_id: context.userId,
            p_ano: data.ano,
            p_desde: hoje,
            p_linhas: ls,
          } as never,
        ),
      apagarDeHojeEmDiante: () =>
        supabaseAdmin
          .from("ia_plano_conteudo" as never)
          .delete()
          .eq("user_id", context.userId)
          .eq("ano", data.ano)
          .gte("data", hoje),
      inserir: (ls) =>
        supabaseAdmin
          .from("ia_plano_conteudo" as never)
          .insert(ls.map((l) => ({ user_id: context.userId, ano: data.ano, ...l })) as never),
    });

    if (!resultado.ok) {
      console.error("plano de conteúdo: falha ao gravar o ano", resultado.error);
      return { ok: false, motivo: "falha" };
    }
    return { ok: true, dias: resultado.dias };
  });
