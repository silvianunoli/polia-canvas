import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FOTO_MAX_BYTES, FOTO_TIPOS, MAX_FOTOS_PRODUTO } from "@/lib/loja";

// Dados da tela Catálogo (ONE-148, fases 2 e 3). Produtos e fotos a dona mexe
// direto pelo Supabase, com RLS de dona (produtos: update; produto_fotos e o
// bucket produtos-fotos: só na pasta dela). A configuração da loja passa pelo
// servidor (loja.functions.ts), que confere o Pro.

export const CHAVE_CATALOGO = "catalogo-loja";
export const CHAVE_PRODUTOS_CATALOGO = "catalogo-produtos";

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
        .select("id, nome, preco_venda, no_catalogo, created_at")
        .eq("user_id", userId!)
        .eq("arquivado", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const lista = (prods ?? []) as unknown as Array<{ id: string; nome: string; preco_venda: number; no_catalogo: boolean }>;
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
        fotos: fotosPor.get(p.id) ?? [],
        variacoes: varPor.get(p.id) ?? 0,
      }));
    },
  });
}

export const alternarNaLoja = (produtoId: string, noCatalogo: boolean) =>
  supabase.from("produtos").update({ no_catalogo: noCatalogo } as never).eq("id", produtoId);

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
