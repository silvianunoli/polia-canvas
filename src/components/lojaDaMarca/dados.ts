// Acesso a dados da tela Loja da marca. A regra mora em lib/lojaDaMarca.ts.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FOTO_TIPOS } from "@/lib/loja";
import {
  arquivosQueSairam,
  corpoDaVitrine,
  enderecoDaLoja,
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
  /** Nome e logo próprios da loja (24/11/2026): não vêm de Configurações. */
  nome: string;
  logoPath: string | null;
  blocos: unknown;
  titulos: Record<BlocoComTitulo, TituloDoBloco>;
  banners: BannerDaLoja[];
  /** Endereço público do site (site_url ou o domínio). */
  endereco: string;
  emBreve: boolean;
  fraseEmBreve: string;
  /** Token do link de teste: só a dona lê (RLS). */
  tokenDeTeste: string;
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
        .select(
          "dominio, nome, logo_path, conteudo, em_breve, em_breve_texto, previa_token, site_url",
        )
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const linha = data as unknown as {
        dominio: string;
        nome: string | null;
        logo_path: string | null;
        conteudo: Record<string, unknown> | null;
        em_breve: boolean;
        em_breve_texto: string | null;
        previa_token: string;
        site_url: string | null;
      };
      const c = linha.conteudo ?? {};
      return {
        dominio: linha.dominio,
        nome: linha.nome ?? "",
        logoPath: linha.logo_path,
        blocos: c.blocos,
        titulos: lerTitulos(c.rotulos),
        banners: lerBanners(c.banners),
        endereco: enderecoDaLoja(linha.site_url, linha.dominio),
        emBreve: linha.em_breve === true,
        fraseEmBreve: linha.em_breve_texto ?? "",
        tokenDeTeste: linha.previa_token,
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

/**
 * Grava o nome e o logo da loja. O logo antigo só é apagado do bucket se o perfil
 * (Logo e cor de Configurações) não usa o mesmo arquivo: na carga inicial os dois
 * apontam pro mesmo logo.
 */
export async function salvarIdentidadeDaLoja(
  userId: string,
  nome: string,
  logoPath: string | null,
  logoAntes: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc(
    "loja_marca_salvar_identidade" as never,
    { p_nome: nome.trim(), p_logo_path: logoPath } as never,
  );
  if (error) {
    console.error("loja_marca_salvar_identidade", error);
    return { error: "A Pólia One não conseguiu salvar o nome e o logo da loja. Tenta de novo." };
  }
  if (logoAntes && logoAntes !== logoPath) {
    const { data: perfil } = await supabase
      .from("profiles")
      .select("logo_path")
      .eq("id", userId)
      .maybeSingle();
    // Sem conseguir ler o perfil, o arquivo fica: melhor sobrar do que sumir.
    if (perfil && perfil.logo_path !== logoAntes)
      await supabase.storage.from(BUCKET).remove([logoAntes]);
  }
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

/** Liga ou desliga o Em breve e grava a frase (vazia, a loja usa "Em breve."). */
export async function salvarEmBreve(
  ativo: boolean,
  frase: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc(
    "loja_marca_salvar_em_breve" as never,
    { p_ativo: ativo, p_texto: frase.trim() || null } as never,
  );
  if (error) {
    console.error("loja_marca_salvar_em_breve", error);
    return {
      error:
        "A Pólia One não conseguiu salvar agora. Tenta de novo, o que está na tela continua aqui.",
    };
  }
  return { error: null };
}

/** Gera um link de teste novo; o antigo para de abrir a loja. */
export async function trocarLinkDeTeste(): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("loja_marca_trocar_link_previa" as never);
  if (error) {
    console.error("loja_marca_trocar_link_previa", error);
    return {
      error: "A Pólia One não conseguiu trocar o link agora. O link de antes continua valendo.",
    };
  }
  return { error: null };
}
