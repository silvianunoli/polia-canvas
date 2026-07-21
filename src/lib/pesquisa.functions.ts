import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verificarTurnstileServer } from "@/lib/turnstile.server";
import { PESQUISA_DISCOVERY, SLUG_PESQUISA } from "@/lib/pesquisa-discovery.config";
import type { Json, Tables, TablesUpdate } from "@/integrations/supabase/types";

function db() {
  return supabaseAdmin;
}

type PesquisaRow = Tables<"pesquisas">;

function estaAberta(p: Pick<PesquisaRow, "ativa" | "abre_em" | "fecha_em">): boolean {
  const agora = Date.now();
  if (!p.ativa) return false;
  if (p.abre_em && Date.parse(p.abre_em) > agora) return false;
  if (p.fecha_em && Date.parse(p.fecha_em) < agora) return false;
  return true;
}

// GET: a página pública usa isto pra saber se renderiza o formulário ou uma tela
// de "pesquisa encerrada", e pra pegar título/subtítulo. Não expõe a tabela: lê
// pelo service role no servidor.
export const getPesquisaAberta = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await db()
    .from("pesquisas")
    .select("id, titulo, subtitulo, ativa, abre_em, fecha_em")
    .eq("slug", SLUG_PESQUISA)
    .maybeSingle();

  const row = data as PesquisaRow | null;
  if (!row) return { aberta: false, titulo: "", subtitulo: "" };
  return {
    aberta: estaAberta(row),
    titulo: row.titulo,
    subtitulo: row.subtitulo ?? "",
  };
});

// Limpa as respostas contra a config: só entram perguntas e opções que existem,
// texto aberto é aparado. Blinda contra payload inflado ou forjado.
function sanitizarRespostas(brutas: Record<string, unknown>): Json {
  const limpo: Record<string, unknown> = {};
  for (const p of PESQUISA_DISCOVERY.perguntas) {
    const v = brutas[p.id];
    if (v === undefined || v === null) continue;

    if (p.tipo === "aberta") {
      if (typeof v === "string" && v.trim()) limpo[p.id] = v.trim().slice(0, 2000);
      continue;
    }

    const idsValidos = new Set((p.opcoes ?? []).map((o) => o.id));

    if (p.tipo === "multipla") {
      if (Array.isArray(v)) {
        const filtrado = Array.from(
          new Set(v.filter((x): x is string => typeof x === "string" && idsValidos.has(x))),
        ).slice(0, p.maxSelecoes ?? 8);
        if (filtrado.length) limpo[p.id] = filtrado;
      }
      continue;
    }

    // unica
    if (typeof v === "string" && idsValidos.has(v)) limpo[p.id] = v;
  }
  return limpo as Json;
}

const salvarSchema = z.object({
  sessaoId: z.string().trim().min(8).max(64),
  progresso: z.number().int().min(0).max(500),
  concluida: z.boolean(),
  respostas: z.record(z.unknown()).default({}),
  turnstileToken: z.string().optional(),
  // Honeypot: campo invisível que só bot preenche. Veio preenchido, fingimos
  // sucesso e não gravamos nada.
  hp: z.string().optional(),
});

// POST: cria/atualiza a resposta da sessão (upsert por sessao_id).
// - Criar a linha exige Turnstile válido (gate anti-abuso, uma vez por sessão).
// - Atualizações seguintes da MESMA sessão não repetem o Turnstile (o token é de
//   uso único); a linha já existe e é só avançar progresso / mesclar respostas.
// Escrita só aqui, via service role: a RLS não dá insert/update pra anon.
export const salvarPesquisa = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => salvarSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.hp) return { ok: true as const };

    const { data: pesquisaData } = await db()
      .from("pesquisas")
      .select("id, ativa, abre_em, fecha_em")
      .eq("slug", SLUG_PESQUISA)
      .maybeSingle();

    const pesquisa = pesquisaData as Pick<
      PesquisaRow,
      "id" | "ativa" | "abre_em" | "fecha_em"
    > | null;
    if (!pesquisa) return { ok: false as const, motivo: "nao_encontrada" as const };
    if (!estaAberta(pesquisa)) return { ok: false as const, motivo: "fechada" as const };

    const respostas = sanitizarRespostas(data.respostas);

    const { data: existenteData } = await db()
      .from("pesquisa_respostas")
      .select("id, progresso")
      .eq("pesquisa_id", pesquisa.id)
      .eq("sessao_id", data.sessaoId)
      .maybeSingle();

    const existente = existenteData as { id: string; progresso: number } | null;

    if (!existente) {
      // Criar a linha: exige Turnstile válido.
      if (!(await verificarTurnstileServer(data.turnstileToken))) {
        return { ok: false as const, motivo: "turnstile" as const };
      }
      const { error } = await db().from("pesquisa_respostas").insert({
        pesquisa_id: pesquisa.id,
        sessao_id: data.sessaoId,
        progresso: data.progresso,
        concluida: data.concluida,
        respostas,
      });
      if (error) {
        // 23505 = corrida: a linha foi criada entre o select e o insert. Trata
        // como sucesso; o próximo save atualiza.
        if ((error as { code?: string }).code === "23505") return { ok: true as const };
        console.error("[Pesquisa] Falha ao inserir:", error);
        return { ok: false as const, motivo: "erro" as const };
      }
      return { ok: true as const };
    }

    // Atualizar: progresso nunca anda pra trás; respostas vêm completas do cliente.
    // Se vier vazio (ex.: recarregou na intro e o estado do cliente zerou), NÃO
    // apaga o parcial já gravado — só mexe em progresso/concluída.
    const novoProgresso = Math.max(existente.progresso ?? 0, data.progresso);
    const patch: TablesUpdate<"pesquisa_respostas"> = {
      progresso: novoProgresso,
      concluida: data.concluida,
      atualizado_em: new Date().toISOString(),
    };
    if (Object.keys(respostas as Record<string, unknown>).length > 0) patch.respostas = respostas;
    const { error } = await db().from("pesquisa_respostas").update(patch).eq("id", existente.id);
    if (error) {
      console.error("[Pesquisa] Falha ao atualizar:", error);
      return { ok: false as const, motivo: "erro" as const };
    }
    return { ok: true as const };
  });
