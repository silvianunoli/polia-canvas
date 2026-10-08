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
// edição) segue igual. Inserir e apagar só pelo service role (sem policy de
// insert/delete pra usuária, ver a migration do plano de conteúdo).

const entrada = z.object({
  ano: z.number().int().min(2024).max(2100),
  nichos: z.array(z.string()).min(1).max(MAX_NICHOS),
});

export type ResultadoPlanoBanco =
  | { ok: true; dias: number }
  | { ok: false; motivo: "plano_insuficiente" | "nicho_invalido" | "falha" };

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

    const linhas = montarAnoDoBanco(data.ano, data.nichos)
      .filter((d) => !jaTem.has(d.data))
      .map((d) => ({
        user_id: context.userId,
        ano: data.ano,
        data: d.data,
        tipo: d.tipo,
        titulo: d.titulo,
        ideia: d.ideia,
      }));

    const { error: erroApagar } = await supabaseAdmin
      .from("ia_plano_conteudo" as never)
      .delete()
      .eq("user_id", context.userId)
      .eq("ano", data.ano)
      .gte("data", hoje);
    if (erroApagar) return { ok: false, motivo: "falha" };

    if (linhas.length > 0) {
      const { error: erroInserir } = await supabaseAdmin
        .from("ia_plano_conteudo" as never)
        .insert(linhas as never);
      if (erroInserir) return { ok: false, motivo: "falha" };
    }
    return { ok: true, dias: linhas.length };
  });
