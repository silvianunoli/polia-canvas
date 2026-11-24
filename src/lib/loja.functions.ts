import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { verificarTurnstileServer } from "@/lib/turnstile.server";
import { normalizarWhatsapp } from "@/lib/leads";
import { temVitrine } from "@/lib/planos";
import {
  configLojaSchema,
  linhaDaConfig,
  observacaoDoPedidoLoja,
  pedidoLojaSchema,
  maxCoresValido,
  opcoesDaPaleta,
  fotosParaLoja,
  slugValido,
  type CorLoja,
  type LojaPublica,
  type VariacaoLoja,
  type ResultadoPedidoLoja,
} from "@/lib/loja";
import { compararOrdemDaVitrine } from "@/lib/catalogoProdutos";
import { precoQueVale, promocionalQueVale } from "@/lib/precoPromocional";
import { codigoCupomValido, normalizarCodigoCupom, type CupomLoja } from "@/lib/lojaVitrine";

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
  favicon_path: string | null;
  whatsapp: string | null;
  instagram: string | null;
  prazo_dias_uteis: number;
  sinal_percentual: number;
  entrega_texto: string | null;
  pede_endereco: boolean;
  aviso: string | null;
  mostrar_cores: boolean;
  aviso_cor: string | null;
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
    // Fora do Premium e do Pro, a loja some como loja desligada. Sem nome de marca também.
    if (!perfil || !temVitrine(perfil.plano)) return { ok: false };
    const nome = perfil.business_name?.trim();
    if (!nome) return { ok: false };

    const { data: prods } = await supabaseAdmin
      .from("produtos")
      .select("id, nome, descricao, preco_venda, preco_promocional, foto_url, categoria_id, usa_paleta, cor_da_foto, pronta_entrega, controla_estoque, max_cores, preco_sob_consulta, cor_sob_consulta, tamanho_sob_consulta, catalogo_ordem, created_at")
      .eq("user_id", c.user_id)
      .eq("arquivado", false)
      .eq("no_catalogo" as never, true as never)
      .order("catalogo_ordem" as never, { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    const lista = (prods ?? []) as unknown as Array<{
      id: string;
      nome: string;
      descricao: string | null;
      preco_venda: number;
      preco_promocional: number | string | null;
      foto_url: string | null;
      categoria_id: string | null;
      usa_paleta: boolean;
      cor_da_foto: string | null;
      pronta_entrega: boolean;
      controla_estoque: boolean;
      max_cores: number | null;
      preco_sob_consulta: boolean;
      cor_sob_consulta: boolean;
      tamanho_sob_consulta: boolean;
      catalogo_ordem: number | null;
      created_at: string;
    }>;
    // Foto obrigatória (24/11/2026, Sil: "é obrigatório ter foto cadastrada pra
    // aparecer na loja ou na vitrine"): produto sem foto fica de fora da loja,
    // das categorias e do carrinho, mesmo marcado em "Mostrar na Vitrine online".
    const todos = [...lista].sort(compararOrdemDaVitrine);
    const { data: fotos } = todos.length
      ? await supabaseAdmin
          .from("produto_fotos" as never)
          .select("produto_id, path, ordem")
          .in("produto_id", todos.map((p) => p.id))
          .order("ordem")
      : { data: [] };
    const galeriaPor = new Map<string, string[]>();
    for (const f of (fotos ?? []) as unknown as Array<{ produto_id: string; path: string }>) {
      const url = urlPublica("produtos-fotos", f.path);
      if (url) galeriaPor.set(f.produto_id, [...(galeriaPor.get(f.produto_id) ?? []), url]);
    }
    const fotosPor = new Map(todos.map((p) => [p.id, fotosParaLoja(galeriaPor.get(p.id), p.foto_url)]));
    const visiveis = todos.filter((p) => (fotosPor.get(p.id) ?? []).length > 0);
    const ids = visiveis.map((p) => p.id);

    const idsCategorias = [...new Set(visiveis.map((p) => p.categoria_id).filter((c): c is string => !!c))];
    const [{ data: skus }, { data: banners }, { data: categorias }, { data: coresBanco }] = await Promise.all([
      ids.length
        ? supabaseAdmin
            .from("produto_skus")
            .select("id, produto_id, variacao")
            .in("produto_id", ids)
            .eq("arquivado", false)
            .not("variacao", "is", null)
            .order("variacao")
        : Promise.resolve({ data: [] }),
      supabaseAdmin.from("catalogo_banners" as never).select("path, ordem").eq("user_id", c.user_id).order("ordem"),
      idsCategorias.length
        ? supabaseAdmin
            .from("produto_categorias" as never)
            .select("id, nome")
            .eq("user_id", c.user_id)
            .in("id", idsCategorias)
            .order("ordem")
            .order("nome")
        : Promise.resolve({ data: [] }),
      supabaseAdmin
        .from("catalogo_cores" as never)
        .select("id, codigo, nome, hex")
        .eq("user_id", c.user_id)
        .order("ordem")
        .order("created_at"),
    ]);
    // Saldo só de quem é pronta entrega com estoque ligado: é o que vira "Esgotado".
    const comSaldo = visiveis.filter((p) => p.pronta_entrega && p.controla_estoque).map((p) => p.id);
    const { data: saldos } = comSaldo.length
      ? await supabaseAdmin
          .from("estoque_saldos" as never)
          .select("sku_id, produto_id, variacao, saldo")
          .in("produto_id", comSaldo)
      : { data: [] };
    const saldoDoSku = new Map<string, number>();
    const saldoSemVariacao = new Map<string, number>();
    for (const e of (saldos ?? []) as unknown as Array<{ sku_id: string; produto_id: string; variacao: string | null; saldo: number }>) {
      saldoDoSku.set(e.sku_id, Number(e.saldo));
      if (e.variacao == null) saldoSemVariacao.set(e.produto_id, (saldoSemVariacao.get(e.produto_id) ?? 0) + Number(e.saldo));
    }
    const cores = ((coresBanco ?? []) as unknown as CorLoja[]).map((k) => ({
      id: k.id,
      codigo: k.codigo,
      nome: k.nome,
      hex: k.hex,
    }));
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
        faviconUrl: urlPublica("marca-logos", c.favicon_path),
        banners: ((banners ?? []) as unknown as Array<{ path: string }>)
          .map((b) => urlPublica("produtos-fotos", b.path))
          .filter((u): u is string => !!u),
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
        produtos: visiveis.map((p) => {
          // Cor sob consulta tira a paleta desse produto: a cliente não escolhe cor.
          const usaPaleta = !!p.usa_paleta && cores.length > 0 && !p.cor_sob_consulta;
          const contaSaldo = p.pronta_entrega && p.controla_estoque;
          const variacoes: VariacaoLoja[] = usaPaleta
            ? opcoesDaPaleta(cores, p.cor_da_foto)
            : (varPor.get(p.id) ?? []).map((v) => (contaSaldo ? { ...v, esgotada: (saldoDoSku.get(v.id) ?? 0) <= 0 } : v));
          // Com variação própria, esgota quando todas esgotam; sem, olha o SKU sem variação.
          const esgotado =
            contaSaldo &&
            (!usaPaleta && variacoes.length ? variacoes.every((v) => v.esgotada) : (saldoSemVariacao.get(p.id) ?? 0) <= 0);
          return {
          id: p.id,
          nome: p.nome,
          descricao: p.descricao,
          // Com promocional, a cliente paga ele e a loja risca o preço de venda.
          preco: precoQueVale(p.preco_venda, p.preco_promocional),
          precoDe: promocionalQueVale(p.preco_venda, p.preco_promocional) != null ? Number(p.preco_venda) : null,
          fotos: fotosPor.get(p.id) ?? [],
          // Com paleta, as opções são as cores da loja (o SKU fica pro estoque).
          variacoes,
          categoriaId: p.categoria_id ?? null,
          usaPaleta,
          maxCores: usaPaleta ? maxCoresValido(p.max_cores) : 1,
          precoSobConsulta: !!p.preco_sob_consulta,
          corSobConsulta: !!p.cor_sob_consulta,
          tamanhoSobConsulta: !!p.tamanho_sob_consulta,
          prontaEntrega: !!p.pronta_entrega,
          esgotado,
          };
        }),
        cores,
        mostrarCores: c.mostrar_cores !== false,
        avisoCor: c.aviso_cor ?? null,
        categorias: ((categorias ?? []) as unknown as Array<{ id: string; nome: string }>).map((k) => ({
          id: k.id,
          nome: k.nome,
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
      p_cupom: data.cupom?.trim() || null,
    } as never);
    if (error) {
      console.error("[Loja] registrar_pedido_loja", error.code, error.message);
      return { ok: false, motivo: error.code === "23514" ? "invalido" : "erro" };
    }
    const res = String(r);
    if (res === "ok" || res === "repetido") return { ok: true, repetido: res === "repetido" };
    if (res === "limite") return { ok: false, motivo: "limite" };
    if (res === "cupom") return { ok: false, motivo: "cupom" };
    return { ok: false, motivo: "indisponivel" };
  });

/**
 * A loja confere o cupom antes de mostrar o desconto (ONE-239). Só lê: quem
 * grava o desconto é registrar_pedido_loja, que confere de novo. Cupom que não
 * existe, venceu ou esgotou volta igual (null), sem dizer qual dos três.
 * Cupom de Pix ou de frete grátis só vale na loja da marca: volta "so_loja".
 */
export const conferirCupomLoja = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(3).max(40), codigo: z.string().trim().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data }): Promise<CupomLoja | "so_loja" | null> => {
    const codigo = normalizarCodigoCupom(data.codigo);
    if (!codigoCupomValido(codigo)) return null;
    const { data: r, error } = await supabaseAdmin.rpc("cupom_da_loja" as never, {
      p_slug: data.slug.toLowerCase(),
      p_codigo: codigo,
    } as never);
    if (error) {
      console.error("[Loja] cupom_da_loja", error.code, error.message);
      return null;
    }
    const c = r as unknown as {
      codigo?: string;
      tipo?: string;
      valor?: number | string;
      produtos?: unknown;
      so_loja?: boolean;
    } | null;
    if (c?.so_loja) return "so_loja";
    if (!c?.codigo || (c.tipo !== "percentual" && c.tipo !== "valor")) return null;
    const produtos = Array.isArray(c.produtos) ? c.produtos.filter((x): x is string => typeof x === "string") : null;
    return { codigo: c.codigo, tipo: c.tipo, valor: Number(c.valor), produtos };
  });

// ── tela da dona ───────────────────────────────────────────────────────────

async function temPro(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from("profiles").select("plano").eq("id", userId).maybeSingle();
  return temVitrine(data?.plano as string | null | undefined);
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
      catalogo: c
        ? { ...c, capaUrl: urlPublica("marca-logos", c.capa_path), faviconUrl: urlPublica("marca-logos", c.favicon_path) }
        : null,
    };
  });

export const salvarCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => configLojaSchema.parse(input))
  .handler(async ({ context, data }) => {
    if (!(await temPro(context.userId))) return { ok: false as const, error: "A Vitrine online é do Premium e do Pro." };
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

/** O interruptor "Loja aberta" grava na hora, sem esperar o "Salvar a loja". */
export const abrirFecharLoja = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ativo: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    if (data.ativo && !(await temPro(context.userId)))
      return { ok: false as const, error: "A Vitrine online é do Premium e do Pro." };
    const { data: linha, error } = await supabaseAdmin
      .from("catalogos" as never)
      .update({ ativo: data.ativo } as never)
      .eq("user_id", context.userId)
      .select("slug")
      .maybeSingle();
    if (error) {
      console.error("[Loja] abrir/fechar", error.code, error.message);
      return { ok: false as const, error: "A Pólia One não conseguiu mudar a loja agora. Tenta de novo." };
    }
    if (!linha) return { ok: false as const, error: "Salve a loja uma vez antes de abrir." };
    return { ok: true as const };
  });

/** Grava a capa ou o favicon da loja (arquivo já no marca-logos) e apaga o anterior. */
async function trocarImagemDaLoja(userId: string, coluna: "capa_path" | "favicon_path", caminho: string | null, nome: string) {
  if (caminho && !caminho.startsWith(`${userId}/`)) return { ok: false as const, error: `Caminho de ${nome} inválido.` };
  const { data: atual } = await supabaseAdmin
    .from("catalogos" as never)
    .select(coluna)
    .eq("user_id", userId)
    .maybeSingle();
  const { error } = await supabaseAdmin
    .from("catalogos" as never)
    .update({ [coluna]: caminho } as never)
    .eq("user_id", userId);
  if (error) return { ok: false as const, error: `A Pólia One não conseguiu salvar ${nome === "capa" ? "a capa" : "o favicon"} agora.` };
  const antiga = (atual as unknown as Record<string, string | null> | null)?.[coluna];
  if (antiga && antiga !== caminho) await supabaseAdmin.storage.from("marca-logos").remove([antiga]);
  return { ok: true as const };
}

const caminhoDaImagem = (input: unknown) => z.object({ caminho: z.string().max(200).nullable() }).parse(input);

export const trocarCapaCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(caminhoDaImagem)
  .handler(({ context, data }) => trocarImagemDaLoja(context.userId, "capa_path", data.caminho, "capa"));

/** Favicon da Vitrine online (22/11/2026). null volta pro ícone da Pólia. */
export const trocarFaviconCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(caminhoDaImagem)
  .handler(({ context, data }) => trocarImagemDaLoja(context.userId, "favicon_path", data.caminho, "favicon"));
