// Acesso a dados da tela Loja da marca. A regra mora em lib/lojaDaMarca.ts.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FOTO_TIPOS } from "@/lib/loja";
import {
  arquivosQueSairam,
  corpoDaVitrine,
  lerBanners,
  lerTitulos,
  type BannerDaLoja,
  type BlocoComTitulo,
  type TituloDoBloco,
} from "@/lib/lojaDaMarca";

const BUCKET = "marca-logos";
/** Banner é imagem grande: até 5 MB (a foto de produto vai até 3). */
const IMAGEM_MAX_BYTES = 5 * 1024 * 1024;

export const urlDaImagemDaLoja = (path: string) =>
  supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

/** Mesma chave do bloco "Da loja online" em Clientes. */
export function useTemLojaDaMarca(userId: string | undefined) {
  return useQuery({
    queryKey: ["loja-marca-existe", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("lojas_marca" as never)
        .select("user_id")
        .eq("user_id", userId!)
        .maybeSingle();
      return !error && (data as unknown) != null;
    },
  });
}

export interface ConteudoDaLojaDaMarca {
  dominio: string;
  blocos: unknown;
  titulos: Record<BlocoComTitulo, TituloDoBloco>;
  banners: BannerDaLoja[];
}

export const chaveConteudoDaLoja = (userId: string | undefined) =>
  ["loja-marca-conteudo", userId] as const;

export function useConteudoDaLojaDaMarca(userId: string | undefined) {
  return useQuery({
    queryKey: chaveConteudoDaLoja(userId),
    enabled: !!userId,
    queryFn: async (): Promise<ConteudoDaLojaDaMarca | null> => {
      const { data, error } = await supabase
        .from("lojas_marca" as never)
        .select("dominio, conteudo")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const linha = data as unknown as {
        dominio: string;
        conteudo: Record<string, unknown> | null;
      };
      const c = linha.conteudo ?? {};
      return {
        dominio: linha.dominio,
        blocos: c.blocos,
        titulos: lerTitulos(c.rotulos),
        banners: lerBanners(c.banners),
      };
    },
  });
}

/** Sobe a imagem na pasta da dona e devolve o caminho. */
export async function subirImagemDaLoja(
  userId: string,
  arquivo: File,
  nome: string,
): Promise<{ path: string | null; error: string | null }> {
  if (!(FOTO_TIPOS as readonly string[]).includes(arquivo.type))
    return { path: null, error: "Use imagem em JPG, PNG ou WEBP." };
  if (arquivo.size > IMAGEM_MAX_BYTES)
    return { path: null, error: "A imagem passa de 5 MB. Diminua o tamanho e tente de novo." };
  const ext = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/loja/${nome}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, arquivo, { contentType: arquivo.type, upsert: false });
  if (error) return { path: null, error: "A Pólia One não conseguiu subir a imagem agora." };
  return { path, error: null };
}

/** Grava títulos e banners pela função do banco; depois apaga as imagens que saíram. */
export async function salvarVitrineDaLoja(
  titulos: Record<string, TituloDoBloco>,
  banners: BannerDaLoja[],
  bannersAntes: BannerDaLoja[],
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc(
    "loja_marca_salvar_vitrine" as never,
    corpoDaVitrine(titulos, banners) as never,
  );
  if (error) {
    console.error("loja_marca_salvar_vitrine", error);
    return {
      error:
        "A Pólia One não conseguiu salvar a loja agora. Tenta de novo, o que está na tela continua aqui.",
    };
  }
  const sairam = arquivosQueSairam(bannersAntes, banners);
  if (sairam.length) await supabase.storage.from(BUCKET).remove(sairam);
  return { error: null };
}

export interface ColecaoDaLoja {
  id: string;
  nome: string;
  capaPath: string | null;
}

export const chaveColecoes = (userId: string | undefined) =>
  ["loja-marca-colecoes", userId] as const;

export function useColecoesDaLoja(userId: string | undefined) {
  return useQuery({
    queryKey: chaveColecoes(userId),
    enabled: !!userId,
    queryFn: async (): Promise<ColecaoDaLoja[]> => {
      const { data, error } = await supabase
        .from("produto_categorias" as never)
        .select("id, nome, capa_path")
        .eq("user_id", userId!)
        .eq("tipo", "colecao")
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return (
        (data ?? []) as unknown as Array<{ id: string; nome: string; capa_path: string | null }>
      ).map((c) => ({
        id: c.id,
        nome: c.nome,
        capaPath: c.capa_path,
      }));
    },
  });
}

/** Troca (ou tira, com null) a capa da coleção e apaga a imagem antiga. */
export async function trocarCapaDaColecao(
  colecao: ColecaoDaLoja,
  path: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("produto_categorias" as never)
    .update({ capa_path: path } as never)
    .eq("id", colecao.id);
  if (error) return { error: "A Pólia One não conseguiu trocar a capa agora." };
  if (colecao.capaPath && colecao.capaPath !== path)
    await supabase.storage.from(BUCKET).remove([colecao.capaPath]);
  return { error: null };
}
