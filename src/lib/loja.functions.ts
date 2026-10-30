import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { verificarTurnstileServer } from "@/lib/turnstile.server";
import { normalizarWhatsapp } from "@/lib/leads";
import { temProjete } from "@/lib/planos";
import {
  configLojaSchema,
  linhaDaConfig,
  observacaoDoPedidoLoja,
  pedidoLojaSchema,
  slugValido,
  type LojaPublica,
  type ResultadoPedidoLoja,
} from "@/lib/loja";

// Loja do catálogo próprio (ONE-148, fases 2 e 3). Mesmo desenho do link de
// captura (captura.functions.ts): a cliente não tem login, então a leitura e o
// pedido passam pelo service role e a resposta leva só o que a página mostra.
// A tela da dona (/catalogo) lê e grava a configuração por aqui; produtos e
// fotos ela mexe direto pelo Supabase, com RLS de dona.

const urlPublica = (bucket: string, caminho: string | null) =>
  caminho ? supabaseAdmin.storage.from(bucket).getPublicUrl(caminho).data.publicUrl : null;

interface LinhaCatalogo {
  user_id: string;
  slug: string;
  ativo: boolean;
  chamada: string | null;
  subchamada: string | null;
  cor_destaque: string | null;
  capa_path: string | null;
  whatsapp: string | null;
  instagram: string | null;
  prazo_dias_uteis: number;
  sinal_percentual: number;
  entrega_texto: string | null;
  pede_endereco: boolean;
  aviso: string | null;
}

export type LeituraLoja = { ok: true; loja: LojaPublica } | { ok: false };

export const lerLojaPublica = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(3).max(40) }).parse(input))
  .handler(async ({ data }): Promise<LeituraLoja> => {
    const slug = data.slug.toLowerCase();
    if (!slugValido(slug)) return { ok: false };
    const { data: cat, error } = await supabaseAdmin
      .from("catalogos" as never)
      .select("*")
      .eq("slug", slug)
      .eq("ativo", true)
      .maybeSingle();
    if (error) console.error("[Loja] leitura", error.message);
    const c = cat as unknown as LinhaCatalogo | null;
    if (!c) return { ok: false };

    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("business_name, logo_path, cor_marca, plano")
      .eq("id", c.user_id)
      .maybeSingle();
    // Fora do Pro, a loja some como loja desligada. Sem nome de marca também.
    if (!perfil || !temProjete(perfil.plano)) return { ok: false };
    const nome = perfil.business_name?.trim();
    if (!nome) return { ok: false };

    const { data: prods } = await supabaseAdmin
      .from("produtos")
      .select("id, nome, descricao, preco_venda, catalogo_ordem, created_at")
      .eq("user_id", c.user_id)
      .eq("arquivado", false)
      .eq("no_catalogo" as never, true as never)
      .order("catalogo_ordem" as never, { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    const lista = (prods ?? []) as unknown as Array<{ id: string; nome: string; descricao: string | null; preco_venda: number }>;
    const ids = lista.map((p) => p.id);

    const [{ data: fotos }, { data: skus }] = await Promise.all([
      ids.length
        ? supabaseAdmin.from("produto_fotos" as never).select("produto_id, path, ordem").in("produto_id", ids).order("ordem")
        : Promise.resolve({ data: [] }),
      ids.length
        ? supabaseAdmin
            .from("produto_skus")
            .select("id, produto_id, variacao")
            .in("produto_id", ids)
            .eq("arquivado", false)
            .not("variacao", "is", null)
            .order("variacao")
        : Promise.resolve({ data: [] }),
    ]);
    const fotosPor = new Map<string, string[]>();
    for (const f of (fotos ?? []) as unknown as Array<{ produto_id: string; path: string }>) {
      const url = urlPublica("produtos-fotos", f.path);
      if (url) fotosPor.set(f.produto_id, [...(fotosPor.get(f.produto_id) ?? []), url]);
    }
    const varPor = new Map<string, Array<{ id: string; nome: string }>>();
    for (const s of (skus ?? []) as unknown as Array<{ id: string; produto_id: string; variacao: string }>) {
      varPor.set(s.produto_id, [...(varPor.get(s.produto_id) ?? []), { id: s.id, nome: s.variacao }]);
    }

    return {
      ok: true,
      loja: {
        slug: c.slug,
        nome,
        logoUrl: urlPublica("marca-logos", perfil.logo_path),
        capaUrl: urlPublica("marca-logos", c.capa_path),
        cor: c.cor_destaque ?? perfil.cor_marca ?? null,
        chamada: c.chamada,
        subchamada: c.subchamada,
        whatsapp: c.whatsapp,
        instagram: c.instagram,
        prazoDiasUteis: c.prazo_dias_uteis,
        sinalPercentual: c.sinal_percentual,
        entregaTexto: c.entrega_texto,
        pedeEndereco: c.pede_endereco,
        aviso: c.aviso,
        produtos: lista.map((p) => ({
          id: p.id,
          nome: p.nome,
          descricao: p.descricao,
          preco: Number(p.preco_venda),
          fotos: fotosPor.get(p.id) ?? [],
          variacoes: varPor.get(p.id) ?? [],
        })),
      },
    };
  });

/** Hash do IP com o dia junto (mesmo jeito da captura): limite por aparelho sem guardar o IP. */
async function hashDoAparelho(): Promise<string | null> {
  const ip = getRequest()?.headers.get("cf-connecting-ip");
  if (!ip) return null;
  const dia = new Date().toISOString().slice(0, 10);
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`loja|${dia}|${ip}`));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const enviarPedidoLoja = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => pedidoLojaSchema.parse(input))
  .handler(async ({ data }): Promise<ResultadoPedidoLoja> => {
    if (data.hp) return { ok: true, repetido: false };
    if (!(await verificarTurnstileServer(data.turnstileToken))) return { ok: false, motivo: "turnstile" };
    const whatsapp = normalizarWhatsapp(data.cliente.whatsapp);
    if (!whatsapp) return { ok: false, motivo: "whatsapp" };
    const { data: r, error } = await supabaseAdmin.rpc("registrar_pedido_loja" as never, {
      p_slug: data.slug.toLowerCase(),
      p_id_externo: data.id,
      p_itens: data.itens.map((i) => ({ produto_id: i.produtoId, sku_id: i.skuId ?? null, quantidade: i.quantidade })),
      p_cliente_nome: data.cliente.nome,
      p_whatsapp: whatsapp,
      p_observacao: observacaoDoPedidoLoja(data),
      p_ip_hash: await hashDoAparelho(),
    } as never);
    if (error) {
      console.error("[Loja] registrar_pedido_loja", error.code, error.message);
      return { ok: false, motivo: error.code === "23514" ? "invalido" : "erro" };
    }
    const res = String(r);
    if (res === "ok" || res === "repetido") return { ok: true, repetido: res === "repetido" };
    if (res === "limite") return { ok: false, motivo: "limite" };
    return { ok: false, motivo: "indisponivel" };
  });

// ── tela da dona ───────────────────────────────────────────────────────────

async function temPro(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from("profiles").select("plano").eq("id", userId).maybeSingle();
  return temProjete(data?.plano as string | null | undefined);
}

export const lerMeuCatalogo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data }, pro] = await Promise.all([
      supabaseAdmin.from("catalogos" as never).select("*").eq("user_id", context.userId).maybeSingle(),
      temPro(context.userId),
    ]);
    const c = data as unknown as LinhaCatalogo | null;
    return {
      liberado: pro,
      catalogo: c ? { ...c, capaUrl: urlPublica("marca-logos", c.capa_path) } : null,
    };
  });

export const salvarCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => configLojaSchema.parse(input))
  .handler(async ({ context, data }) => {
    if (!(await temPro(context.userId))) return { ok: false as const, error: "A loja do catálogo é do plano Pro." };
    if (data.whatsapp && !normalizarWhatsapp(data.whatsapp))
      return { ok: false as const, error: "Confira o WhatsApp da loja, com DDD." };
    const { error } = await supabaseAdmin
      .from("catalogos" as never)
      .upsert({ user_id: context.userId, ...linhaDaConfig(data) } as never, { onConflict: "user_id" });
    if (error) {
      if (error.code === "23505")
        return { ok: false as const, error: "Esse endereço já é de outra marca ou está reservado. Tente outro." };
      console.error("[Loja] salvar", error.code, error.message);
      return { ok: false as const, error: "A Pólia One não conseguiu salvar a loja agora." };
    }
    return { ok: true as const };
  });

export const trocarCapaCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caminho: z.string().max(200).nullable() }).parse(input))
  .handler(async ({ context, data }) => {
    if (data.caminho && !data.caminho.startsWith(`${context.userId}/`))
      return { ok: false as const, error: "Caminho de capa inválido." };
    const { data: atual } = await supabaseAdmin
      .from("catalogos" as never)
      .select("capa_path")
      .eq("user_id", context.userId)
      .maybeSingle();
    const { error } = await supabaseAdmin
      .from("catalogos" as never)
      .update({ capa_path: data.caminho } as never)
      .eq("user_id", context.userId);
    if (error) return { ok: false as const, error: "A Pólia One não conseguiu salvar a capa agora." };
    const antiga = (atual as unknown as { capa_path: string | null } | null)?.capa_path;
    if (antiga && antiga !== data.caminho) await supabaseAdmin.storage.from("marca-logos").remove([antiga]);
    return { ok: true as const };
  });
