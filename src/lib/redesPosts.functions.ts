import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { acessoAgendaRedes, obterAcessoRede } from "@/lib/redesSociaisAcesso.server";
import type { Rede } from "../../supabase/functions/_shared/redesSociais.ts";
import { lerCriadorTiktok } from "../../supabase/functions/_shared/redesSociaisCliente.ts";
import {
  PRIVACIDADES_TIKTOK,
  horarioDoPost,
  infoCriadorDaResposta,
  normalizarEscolhas,
  pastaDoPost,
  podeCancelar,
  problemasDoPost,
  type EntradaPost,
  type InfoCriadorTiktok,
  type StatusDestino,
} from "../../supabase/functions/_shared/redesPosts.ts";

// Posts da Agenda das redes (ONE-155): ler a conta do TikTok, listar, agendar e
// cancelar. O navegador sobe os arquivos direto pro bucket privado redes-midias,
// na pasta {user_id}/{post_id}/, e só depois chama agendarPostRedes, que confere
// tudo de novo (regras em _shared/redesPosts.ts) antes de gravar. As tabelas não
// aceitam escrita do navegador: só este arquivo grava.
//
// Nesta fase nada publica: o post fica "agendado" até o publicador (ONE-156).

const BUCKET = "redes-midias";
const SO_NO_PRO = "A Agenda das redes é do plano Pro.";
const FORA = "A Agenda das redes ainda não está disponível.";

async function liberada(userId: string): Promise<string | null> {
  const { visivel, pro } = await acessoAgendaRedes(userId);
  if (!visivel) return FORA;
  if (!pro) return SO_NO_PRO;
  return null;
}

async function redesConectadas(userId: string): Promise<Rede[]> {
  const { data } = await supabaseAdmin
    .from("redes_conexoes" as never)
    .select("rede")
    .eq("user_id", userId)
    .eq("status", "conectada");
  return ((data as unknown as { rede: Rede }[] | null) ?? []).map((c) => c.rede);
}

async function criadorDaHora(
  userId: string,
): Promise<{ info: InfoCriadorTiktok | null; motivo: string | null }> {
  const { acesso, error } = await obterAcessoRede(userId, "tiktok");
  if (!acesso) return { info: null, motivo: error };
  const r = await lerCriadorTiktok(acesso.accessToken);
  if (!r) return { info: null, motivo: "A Pólia One não conseguiu falar com o TikTok agora." };
  return infoCriadorDaResposta(r);
}

/** creator_info na hora de abrir o bloco do TikTok, como pedem as regras dele. */
export const lerContaTiktok = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const barrada = await liberada(context.userId);
    if (barrada) return { info: null, motivo: barrada };
    return criadorDaHora(context.userId);
  });

export type DestinoNaLista = {
  rede: Rede;
  status: StatusDestino;
  url: string | null;
  erro: string | null;
};

export type PostNaLista = {
  id: string;
  tipo: "video" | "fotos";
  legenda: string;
  status: string;
  agendadoPara: string | null;
  capaUrl: string | null;
  quantidade: number;
  destinos: DestinoNaLista[];
  podeCancelar: boolean;
};

export const listarPostsRedes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ posts: PostNaLista[]; error: string | null }> => {
    const barrada = await liberada(context.userId);
    if (barrada) return { posts: [], error: barrada };

    const { data, error } = await supabaseAdmin
      .from("redes_posts" as never)
      .select(
        "id, tipo, legenda, status, agendado_para, redes_post_midias(ordem, tipo, caminho), redes_post_destinos(rede, status, externo_url, erro)",
      )
      .eq("user_id", context.userId)
      .neq("status", "rascunho")
      .order("agendado_para", { ascending: false })
      .limit(50);
    if (error) return { posts: [], error: "A Pólia One não conseguiu carregar os posts agora." };

    type Linha = {
      id: string;
      tipo: "video" | "fotos";
      legenda: string;
      status: string;
      agendado_para: string | null;
      redes_post_midias: { ordem: number; tipo: string; caminho: string }[];
      redes_post_destinos: {
        rede: Rede;
        status: StatusDestino;
        externo_url: string | null;
        erro: string | null;
      }[];
    };
    const linhas = (data as unknown as Linha[] | null) ?? [];

    // Capa: a primeira foto, por link assinado de 1 h (o bucket é privado).
    const capas = linhas
      .map((l) => [...l.redes_post_midias].sort((a, b) => a.ordem - b.ordem)[0])
      .filter((m): m is Linha["redes_post_midias"][number] => !!m && m.tipo === "imagem")
      .map((m) => m.caminho);
    const urls = new Map<string, string>();
    if (capas.length) {
      const { data: assinadas } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrls(capas, 3600);
      for (const a of assinadas ?? []) if (a.path && a.signedUrl) urls.set(a.path, a.signedUrl);
    }

    return {
      error: null,
      posts: linhas.map((l) => {
        const primeira = [...l.redes_post_midias].sort((a, b) => a.ordem - b.ordem)[0];
        return {
          id: l.id,
          tipo: l.tipo,
          legenda: l.legenda,
          status: l.status,
          agendadoPara: l.agendado_para,
          capaUrl: primeira ? (urls.get(primeira.caminho) ?? null) : null,
          quantidade: l.redes_post_midias.length,
          destinos: l.redes_post_destinos.map((d) => ({
            rede: d.rede,
            status: d.status,
            url: d.externo_url,
            erro: d.erro,
          })),
          podeCancelar: podeCancelar(l.status, l.redes_post_destinos),
        };
      }),
    };
  });

const escolhasSchema = z.object({
  privacidade: z.enum(PRIVACIDADES_TIKTOK).nullable(),
  permiteComentario: z.boolean(),
  permiteDueto: z.boolean(),
  permiteStitch: z.boolean(),
  divulgaMarca: z.boolean(),
  marcaPropria: z.boolean(),
  conteudoDeMarca: z.boolean(),
  conteudoIa: z.boolean(),
});

const entradaSchema = z.object({
  postId: z.string().uuid(),
  tipo: z.enum(["video", "fotos"]),
  legenda: z.string().max(2200),
  titulo: z.string().max(90).nullable(),
  midias: z
    .array(
      z.object({
        ordem: z.number().int().min(0).max(34),
        tipo: z.enum(["video", "imagem"]),
        caminho: z.string().min(3).max(500),
        mime: z.string().max(40),
        bytes: z.number().int().positive(),
        largura: z.number().int().positive().nullable(),
        altura: z.number().int().positive().nullable(),
        duracaoS: z.number().positive().max(36000).nullable(),
      }),
    )
    .min(1)
    .max(35),
  redes: z
    .array(z.enum(["tiktok", "instagram"]))
    .min(1)
    .max(2),
  tiktok: escolhasSchema.nullable(),
  quando: z.union([
    z.object({ modo: z.literal("agora") }),
    z.object({ modo: z.literal("agendar"), em: z.string().max(40) }),
  ]),
  consentiu: z.boolean(),
});

/** Os arquivos que a lista cita precisam estar mesmo na pasta do post. */
async function arquivosNaPasta(
  userId: string,
  postId: string,
  caminhos: string[],
): Promise<boolean> {
  const pasta = pastaDoPost(userId, postId).slice(0, -1);
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(pasta, { limit: 100 });
  if (error) return false;
  const nomes = new Set((data ?? []).map((f) => `${pasta}/${f.name}`));
  return caminhos.every((c) => nomes.has(c));
}

export const agendarPostRedes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entradaSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; erros: string[] }> => {
    const userId = context.userId;
    const barrada = await liberada(userId);
    if (barrada) return { ok: false, erros: [barrada] };

    const entrada: EntradaPost = {
      ...data,
      redes: [...new Set(data.redes)],
      titulo: data.titulo?.trim() ? data.titulo.trim() : null,
      tiktok: data.tiktok ? normalizarEscolhas(data.tiktok, data.tipo) : null,
    };
    const temTt = entrada.redes.includes("tiktok");
    const [conectadas, criador] = await Promise.all([
      redesConectadas(userId),
      temTt ? criadorDaHora(userId) : Promise.resolve({ info: null, motivo: null }),
    ]);
    if (temTt && !criador.info)
      return { ok: false, erros: [criador.motivo ?? "O TikTok não respondeu agora."] };

    const agora = Date.now();
    const erros = problemasDoPost(entrada, { userId, agora, conectadas, criador: criador.info });
    if (erros.length) return { ok: false, erros };

    const caminhos = entrada.midias.map((m) => m.caminho);
    if (!(await arquivosNaPasta(userId, entrada.postId, caminhos)))
      return { ok: false, erros: ["Um dos arquivos não chegou na Pólia One. Sobe de novo."] };

    const { data: existe } = await supabaseAdmin
      .from("redes_posts" as never)
      .select("id")
      .eq("id", entrada.postId)
      .maybeSingle();
    if (existe) return { ok: false, erros: ["Esse post já foi agendado."] };

    const quando = new Date(horarioDoPost(entrada.quando, agora) ?? agora).toISOString();
    const falha = { ok: false, erros: ["A Pólia One não conseguiu agendar agora. Tenta de novo."] };

    const { error: e1 } = await supabaseAdmin.from("redes_posts" as never).insert({
      id: entrada.postId,
      user_id: userId,
      tipo: entrada.tipo,
      legenda: entrada.legenda,
      titulo: entrada.titulo,
      // Rascunho até as mídias e os destinos entrarem: o publicador (ONE-156)
      // só pega "agendado", e um "Publicar agora" pela metade sairia sem destino.
      status: "rascunho",
      agendado_para: quando,
    } as never);
    if (e1) return falha;

    const consentiuEm = new Date(agora).toISOString();
    const tt = entrada.tiktok;
    const [{ error: e2 }, { error: e3 }] = await Promise.all([
      supabaseAdmin.from("redes_post_midias" as never).insert(
        entrada.midias.map((m) => ({
          post_id: entrada.postId,
          user_id: userId,
          ordem: m.ordem,
          tipo: m.tipo,
          caminho: m.caminho,
          mime: m.mime,
          bytes: m.bytes,
          largura: m.largura,
          altura: m.altura,
          duracao_s: m.duracaoS,
        })) as never,
      ),
      supabaseAdmin.from("redes_post_destinos" as never).insert(
        entrada.redes.map((rede) => ({
          post_id: entrada.postId,
          user_id: userId,
          rede,
          status: "pendente",
          consentiu_em: consentiuEm,
          ...(rede === "tiktok" && tt
            ? {
                tt_privacidade: tt.privacidade,
                tt_permite_comentario: tt.permiteComentario,
                tt_permite_dueto: tt.permiteDueto,
                tt_permite_stitch: tt.permiteStitch,
                tt_divulga_marca: tt.divulgaMarca,
                tt_marca_propria: tt.marcaPropria,
                tt_conteudo_de_marca: tt.conteudoDeMarca,
                conteudo_ia: tt.conteudoIa,
              }
            : {}),
        })) as never,
      ),
    ]);
    const { error: e4 } =
      e2 || e3
        ? { error: true }
        : await supabaseAdmin
            .from("redes_posts" as never)
            .update({ status: "agendado", updated_at: new Date().toISOString() } as never)
            .eq("id", entrada.postId)
            .eq("status", "rascunho");
    if (e4) {
      // As linhas filhas saem junto (on delete cascade); os arquivos ficam pra ela tentar de novo.
      await supabaseAdmin
        .from("redes_posts" as never)
        .delete()
        .eq("id", entrada.postId);
      return falha;
    }
    return { ok: true, erros: [] };
  });

export const cancelarPostRedes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ postId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error: string | null }> => {
    const { data: post } = await supabaseAdmin
      .from("redes_posts" as never)
      .select("id, status, redes_post_destinos(status), redes_post_midias(caminho)")
      .eq("id", data.postId)
      .eq("user_id", context.userId)
      .maybeSingle();
    const p = post as unknown as {
      status: string;
      redes_post_destinos: { status: string }[];
      redes_post_midias: { caminho: string }[];
    } | null;
    if (!p) return { ok: false, error: "Esse post não foi encontrado." };
    if (!podeCancelar(p.status, p.redes_post_destinos))
      return { ok: false, error: "Esse post já começou a sair e não dá mais pra cancelar." };

    const agora = new Date().toISOString();
    // Só cancela o que ainda está agendado: se o publicador pegou no meio, nada muda.
    const { data: mudou, error } = await supabaseAdmin
      .from("redes_posts" as never)
      .update({ status: "cancelado", updated_at: agora } as never)
      .eq("id", data.postId)
      .eq("user_id", context.userId)
      .eq("status", "agendado")
      .select("id");
    if (error || !(mudou as unknown[] | null)?.length)
      return { ok: false, error: "A Pólia One não conseguiu cancelar agora. Tenta de novo." };

    await supabaseAdmin
      .from("redes_post_destinos" as never)
      .update({ status: "cancelado", updated_at: agora } as never)
      .eq("post_id", data.postId)
      .eq("status", "pendente");
    // O arquivo não serve mais pra nada: libera o espaço.
    const caminhos = p.redes_post_midias.map((m) => m.caminho);
    if (caminhos.length) await supabaseAdmin.storage.from(BUCKET).remove(caminhos);
    return { ok: true, error: null };
  });
