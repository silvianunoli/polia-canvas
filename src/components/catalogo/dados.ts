import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { slugDaCategoria } from "@/lib/lojaCombinacoes";
import { BANNER_TIPOS, FOTO_MAX_BYTES, FOTO_TIPOS, MAX_BANNERS, MAX_FOTOS_PRODUTO, problemaDoBanner, problemaDoFavicon } from "@/lib/loja";

// Dados da tela Vitrine online (rota /catalogo; ONE-148, fases 2 e 3). Produtos e fotos a dona mexe
// direto pelo Supabase, com RLS de dona (produtos: update; produto_fotos e o
// bucket produtos-fotos: só na pasta dela). A configuração da loja passa pelo
// servidor (loja.functions.ts), que confere o Pro.

export const CHAVE_CATALOGO = "catalogo-loja";
export const CHAVE_PRODUTOS_CATALOGO = "catalogo-produtos";
export const CHAVE_BANNERS_CATALOGO = "catalogo-banners";

export interface FotoProduto {
  id: string;
  path: string;
  ordem: number;
  url: string;
}

export interface ProdutoDoCatalogo {
  id: string;
  nome: string;
  preco: number;
  noCatalogo: boolean;
  /** Posição na vitrine (produtos.catalogo_ordem); null quando ela nunca ordenou. */
  ordem: number | null;
  /** produto_categorias.id; null = sem categoria. */
  categoriaId: string | null;
  /** produto_categorias.id de tipo coleção; null = sem coleção. */
  colecaoId: string | null;
  fotos: FotoProduto[];
  variacoes: number;
}

const urlDaFoto = (path: string) => supabase.storage.from("produtos-fotos").getPublicUrl(path).data.publicUrl;

export function useProdutosDoCatalogo(userId: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: [CHAVE_PRODUTOS_CATALOGO, userId],
    enabled: !!userId && habilitado,
    queryFn: async (): Promise<ProdutoDoCatalogo[]> => {
      const { data: prods, error } = await supabase
        .from("produtos")
        .select("id, nome, preco_venda, no_catalogo, catalogo_ordem, categoria_id, colecao_id, created_at")
        .eq("user_id", userId!)
        .eq("arquivado", false)
        // Mesma ordem da loja pública (lerLojaPublica): a dela primeiro, depois a de cadastro.
        .order("catalogo_ordem" as never, { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      const lista = (prods ?? []) as unknown as Array<{
        id: string;
        nome: string;
        preco_venda: number;
        no_catalogo: boolean;
        catalogo_ordem: number | null;
        categoria_id: string | null;
        colecao_id: string | null;
      }>;
      const ids = lista.map((p) => p.id);
      if (!ids.length) return [];
      const [{ data: fotos, error: e1 }, { data: skus, error: e2 }] = await Promise.all([
        supabase.from("produto_fotos" as never).select("id, produto_id, path, ordem").in("produto_id", ids).order("ordem"),
        supabase.from("produto_skus").select("produto_id").in("produto_id", ids).eq("arquivado", false).not("variacao", "is", null),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const fotosPor = new Map<string, FotoProduto[]>();
      for (const f of (fotos ?? []) as unknown as Array<{ id: string; produto_id: string; path: string; ordem: number }>) {
        fotosPor.set(f.produto_id, [...(fotosPor.get(f.produto_id) ?? []), { id: f.id, path: f.path, ordem: f.ordem, url: urlDaFoto(f.path) }]);
      }
      const varPor = new Map<string, number>();
      for (const s of (skus ?? []) as Array<{ produto_id: string }>) varPor.set(s.produto_id, (varPor.get(s.produto_id) ?? 0) + 1);
      return lista.map((p) => ({
        id: p.id,
        nome: p.nome,
        preco: Number(p.preco_venda),
        noCatalogo: !!p.no_catalogo,
        ordem: p.catalogo_ordem ?? null,
        categoriaId: p.categoria_id ?? null,
        colecaoId: p.colecao_id ?? null,
        fotos: fotosPor.get(p.id) ?? [],
        variacoes: varPor.get(p.id) ?? 0,
      }));
    },
  });
}


/**
 * Grava a ordem da vitrine: a posição de cada id na lista vira catalogo_ordem
 * (0, 1, 2...). Recebe a lista inteira já na ordem nova, pra não sobrar empate.
 */
export async function salvarOrdemDaVitrine(idsNaOrdem: string[]) {
  const resultados = await Promise.all(
    idsNaOrdem.map((id, i) => supabase.from("produtos").update({ catalogo_ordem: i } as never).eq("id", id)),
  );
  const falhou = resultados.find((r) => r.error);
  return { error: falhou ? "A Pólia One não conseguiu salvar a ordem agora. Tenta de novo." : null };
}

/** Troca o item de lugar com o vizinho (-1 sobe, +1 desce). Fora da lista, devolve igual. */
export function moverNaLista<T>(lista: readonly T[], indice: number, direcao: -1 | 1): T[] {
  const alvo = indice + direcao;
  if (indice < 0 || indice >= lista.length || alvo < 0 || alvo >= lista.length) return [...lista];
  const nova = [...lista];
  [nova[indice], nova[alvo]] = [nova[alvo], nova[indice]];
  return nova;
}

// ── categorias (mesma tabela da loja de marca, produto_categorias) ─────────

/** Categoria é o tipo do produto (menu da loja); coleção é o tema da estampa (22/11/2026). */
export type TipoDaCategoria = "categoria" | "colecao";

export interface CategoriaDaVitrine {
  id: string;
  nome: string;
  tipo: TipoDaCategoria;
}

/** Mesma chave da janela de produto (useLojaDoProduto): as duas telas ficam iguais. */
export const chaveCategorias = (userId: string | undefined) => ["produto-categorias", userId] as const;

export function useCategoriasDaVitrine(userId: string | undefined) {
  return useQuery({
    queryKey: chaveCategorias(userId),
    enabled: !!userId,
    queryFn: async (): Promise<CategoriaDaVitrine[]> => {
      const { data, error } = await supabase
        .from("produto_categorias" as never)
        .select("id, nome, tipo")
        .eq("user_id" as never, userId! as never)
        .order("ordem" as never)
        .order("nome" as never);
      if (error) throw error;
      return (data ?? []) as unknown as CategoriaDaVitrine[];
    },
  });
}

export async function mudarCategoria(produtoId: string, categoriaId: string | null, tipo: TipoDaCategoria = "categoria") {
  const campo = tipo === "colecao" ? { colecao_id: categoriaId } : { categoria_id: categoriaId };
  const { error } = await supabase.from("produtos").update(campo as never).eq("id", produtoId);
  return { error: error ? `A Pólia One não conseguiu mudar a ${tipo === "colecao" ? "coleção" : "categoria"} agora.` : null };
}

/** Cria a categoria (ou a coleção) e devolve o id. Nome repetido volta com o motivo. */
export async function criarCategoria(
  userId: string,
  nome: string,
  tipo: TipoDaCategoria = "categoria",
): Promise<{ id: string | null; error: string | null }> {
  const limpo = nome.trim().slice(0, 60);
  const slug = slugDaCategoria(limpo);
  if (!limpo || !slug) return { id: null, error: "Escreva um nome com letras ou números." };
  const { data, error } = await supabase
    .from("produto_categorias" as never)
    .insert({ user_id: userId, nome: limpo, slug, tipo } as never)
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return { id: null, error: "Já existe uma categoria ou coleção com esse nome." };
    return { id: null, error: `A Pólia One não conseguiu criar a ${tipo === "colecao" ? "coleção" : "categoria"}. Tenta de novo.` };
  }
  return { id: (data as unknown as { id: string }).id, error: null };
}

// ── paleta de cores (migration 20261122180000) ─────────────────────────────

export const CHAVE_CORES_CATALOGO = "catalogo-cores";
export const MAX_CORES = 200;

export interface CorDaPaleta {
  id: string;
  codigo: string | null;
  nome: string;
  hex: string;
  ordem: number;
}

export function useCoresDaVitrine(userId: string | undefined) {
  return useQuery({
    queryKey: [CHAVE_CORES_CATALOGO, userId],
    enabled: !!userId,
    queryFn: async (): Promise<CorDaPaleta[]> => {
      const { data, error } = await supabase
        .from("catalogo_cores" as never)
        .select("id, codigo, nome, hex, ordem")
        .eq("user_id" as never, userId! as never)
        .order("ordem" as never)
        .order("created_at" as never);
      if (error) throw error;
      return (data ?? []) as unknown as CorDaPaleta[];
    },
  });
}

/** Põe as cores no fim da paleta, na ordem em que vieram. */
export async function adicionarCores(
  userId: string,
  novas: Array<{ codigo: string | null; nome: string; hex: string }>,
  jaTem: number,
) {
  if (!novas.length) return { error: null };
  if (jaTem + novas.length > MAX_CORES) return { error: `A paleta leva até ${MAX_CORES} cores.` };
  const linhas = novas.map((c, i) => ({
    user_id: userId,
    codigo: c.codigo?.trim() || null,
    nome: c.nome.trim().slice(0, 40),
    hex: c.hex.toUpperCase(),
    ordem: Math.min(1000, jaTem + i),
  }));
  const { error } = await supabase.from("catalogo_cores" as never).insert(linhas as never);
  return { error: error ? "A Pólia One não conseguiu guardar as cores agora." : null };
}

export async function atualizarCor(id: string, campos: Partial<Pick<CorDaPaleta, "codigo" | "nome" | "hex">>) {
  const { error } = await supabase
    .from("catalogo_cores" as never)
    .update(campos as never)
    .eq("id" as never, id as never);
  return { error: error ? "A Pólia One não conseguiu salvar a cor agora." : null };
}

export async function removerCor(id: string) {
  const { error } = await supabase
    .from("catalogo_cores" as never)
    .delete()
    .eq("id" as never, id as never);
  return { error: error ? "A Pólia One não conseguiu tirar a cor agora." : null };
}

export async function salvarOrdemDasCores(lista: CorDaPaleta[]) {
  const r = await Promise.all(
    lista.map((c, i) =>
      supabase.from("catalogo_cores" as never).update({ ordem: Math.min(1000, i) } as never).eq("id" as never, c.id as never),
    ),
  );
  return { error: r.some((x) => x.error) ? "A Pólia One não conseguiu salvar a ordem das cores agora." : null };
}

// ── banner rotativo (migration 20261122150000) ─────────────────────────────

export interface BannerDaVitrine {
  id: string;
  path: string;
  ordem: number;
  url: string;
}

export function useBannersDaVitrine(userId: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: [CHAVE_BANNERS_CATALOGO, userId],
    enabled: !!userId && habilitado,
    queryFn: async (): Promise<BannerDaVitrine[]> => {
      const { data, error } = await supabase
        .from("catalogo_banners" as never)
        .select("id, path, ordem")
        .eq("user_id" as never, userId! as never)
        .order("ordem" as never);
      if (error) throw error;
      return ((data ?? []) as unknown as Array<{ id: string; path: string; ordem: number }>).map((b) => ({
        ...b,
        url: urlDaFoto(b.path),
      }));
    },
  });
}

/** Largura e altura reais da imagem, lidas no navegador. null se não abrir. */
async function medidaDaImagem(arquivo: File): Promise<{ largura: number; altura: number } | null> {
  try {
    const bmp = await createImageBitmap(arquivo);
    const medida = { largura: bmp.width, altura: bmp.height };
    bmp.close();
    return medida;
  } catch {
    return null;
  }
}

/** Sobe o banner no fim da fila. Mesmo bucket e limite das fotos de produto (3 MB). */
export async function subirBanner(userId: string, arquivo: File, atuais: BannerDaVitrine[]) {
  if (atuais.length >= MAX_BANNERS) return { error: `O banner leva até ${MAX_BANNERS} imagens.` };
  const problema = problemaDaFoto(arquivo);
  if (problema) return { error: problema };
  // Medida exata e só JPG/PNG: fora disso a vitrine cortaria o banner.
  if (!(BANNER_TIPOS as readonly string[]).includes(arquivo.type)) {
    return { error: problemaDoBanner(arquivo.type, 0, 0) };
  }
  const medida = await medidaDaImagem(arquivo);
  if (!medida) return { error: "A Pólia One não conseguiu abrir essa imagem. Confira se é um JPG ou PNG." };
  const foraDaMedida = problemaDoBanner(arquivo.type, medida.largura, medida.altura);
  if (foraDaMedida) return { error: foraDaMedida };
  const ordem = [0, 1, 2, 3, 4].find((o) => !atuais.some((b) => b.ordem === o)) ?? atuais.length;
  const ext = arquivo.type === "image/png" ? "png" : "jpg";
  const path = `${userId}/banner-loja-${Date.now()}.${ext}`;
  const up = await supabase.storage.from("produtos-fotos").upload(path, arquivo, { contentType: arquivo.type, upsert: false });
  if (up.error) return { error: "A Pólia One não conseguiu subir o banner agora." };
  const { error } = await supabase.from("catalogo_banners" as never).insert({ user_id: userId, path, ordem } as never);
  if (error) {
    await supabase.storage.from("produtos-fotos").remove([path]);
    return { error: "A Pólia One não conseguiu guardar o banner agora." };
  }
  return { error: null };
}

export async function removerBanner(b: BannerDaVitrine) {
  const { error } = await supabase.from("catalogo_banners" as never).delete().eq("id" as never, b.id as never);
  if (!error) await supabase.storage.from("produtos-fotos").remove([b.path]);
  return { error: error ? "A Pólia One não conseguiu tirar o banner agora." : null };
}

/** Regrava a ordem dos banners (0 a 4) na sequência da lista. */
export async function salvarOrdemDosBanners(lista: BannerDaVitrine[]) {
  const resultados = await Promise.all(
    lista.map((b, i) => supabase.from("catalogo_banners" as never).update({ ordem: i } as never).eq("id" as never, b.id as never)),
  );
  return { error: resultados.some((r) => r.error) ? "A Pólia One não conseguiu salvar a ordem dos banners agora." : null };
}

/** Recusa arquivo fora do tipo ou do tamanho antes de subir. null = pode subir. */
export function problemaDaFoto(arquivo: File): string | null {
  if (!(FOTO_TIPOS as readonly string[]).includes(arquivo.type)) return "Use foto em JPG, PNG ou WEBP.";
  if (arquivo.size > FOTO_MAX_BYTES) return "A foto passa de 3 MB. Diminua o tamanho e tente de novo.";
  return null;
}

/** Sobe a foto na primeira posição livre (até 4) e grava a linha. Se a linha falhar, apaga o arquivo. */
export async function subirFotoProduto(userId: string, produtoId: string, arquivo: File, ocupadas: number[]) {
  const ordem = [0, 1, 2, 3].find((o) => !ocupadas.includes(o));
  if (ordem === undefined || ocupadas.length >= MAX_FOTOS_PRODUTO) return { error: "Cada produto leva até 4 fotos." };
  const problema = problemaDaFoto(arquivo);
  if (problema) return { error: problema };
  const ext = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${produtoId}-${Date.now()}.${ext}`;
  const up = await supabase.storage.from("produtos-fotos").upload(path, arquivo, { contentType: arquivo.type, upsert: false });
  if (up.error) return { error: "A Pólia One não conseguiu subir a foto agora." };
  const { error } = await supabase
    .from("produto_fotos" as never)
    .insert({ user_id: userId, produto_id: produtoId, path, ordem } as never);
  if (error) {
    await supabase.storage.from("produtos-fotos").remove([path]);
    return { error: "A Pólia One não conseguiu guardar a foto agora." };
  }
  return { error: null };
}

export async function removerFotoProduto(foto: FotoProduto) {
  const { error } = await supabase.from("produto_fotos" as never).delete().eq("id", foto.id);
  if (!error) await supabase.storage.from("produtos-fotos").remove([foto.path]);
  return { error: error ? "A Pólia One não conseguiu tirar a foto agora." : null };
}

/** Capa da loja: no bucket do logo (marca-logos), na pasta da dona. Devolve o caminho. */
/** Sobe o favicon (PNG quadrado, 48 a 512 px). Quem grava na loja é trocarFaviconCatalogo. */
export async function subirFavicon(userId: string, arquivo: File) {
  if (arquivo.size > 1024 * 1024) return { error: "O favicon passa de 1 MB. Diminua o tamanho e tente de novo.", caminho: null };
  const medida = arquivo.type === "image/png" ? await medidaDaImagem(arquivo) : { largura: 0, altura: 0 };
  if (!medida) return { error: "A Pólia One não conseguiu abrir essa imagem. Confira se é um PNG.", caminho: null };
  const problema = problemaDoFavicon(arquivo.type, medida.largura, medida.altura);
  if (problema) return { error: problema, caminho: null };
  const caminho = `${userId}/favicon-loja-${Date.now()}.png`;
  const up = await supabase.storage.from("marca-logos").upload(caminho, arquivo, { contentType: "image/png", upsert: false });
  if (up.error) return { error: "A Pólia One não conseguiu subir o favicon agora.", caminho: null };
  return { error: null, caminho };
}

export async function subirCapa(userId: string, arquivo: File) {
  const problema = problemaDaFoto(arquivo);
  if (problema) return { error: problema, caminho: null };
  if (arquivo.size > 1024 * 1024) return { error: "A capa passa de 1 MB. Diminua o tamanho e tente de novo.", caminho: null };
  const ext = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg";
  const caminho = `${userId}/capa-loja-${Date.now()}.${ext}`;
  const up = await supabase.storage.from("marca-logos").upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
  if (up.error) return { error: "A Pólia One não conseguiu subir a capa agora.", caminho: null };
  return { error: null, caminho };
}
