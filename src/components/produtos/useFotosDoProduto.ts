// Fotos do modal de produto (ONE-163): até 4 por produto, na mesma tabela
// produto_fotos e no mesmo bucket produtos-fotos que a tela Catálogo usa, então
// a loja e o cadastro mostram as mesmas fotos. Nada sobe antes do "Salvar":
// arquivo novo fica só em memória (com prévia) e foto tirada só some no Salvar.
// A primeira foto vira foto_url, que é o que o cartão de Produtos mostra.

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MAX_FOTOS_PRODUTO } from "@/lib/loja";
import {
  problemaDaFoto,
  removerFotoProduto,
  subirFotoProduto,
  type FotoProduto,
} from "@/components/catalogo/dados";

export type FotoNoModal =
  | { tipo: "salva"; chave: string; url: string; foto: FotoProduto }
  | { tipo: "nova"; chave: string; url: string; arquivo: File };

const BUCKET = "produtos-fotos";
const urlDaFoto = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

/** Caminho no bucket quando a URL é uma foto pública da própria dona (botão de foto única de 30/10). */
export function caminhoNoBucket(url: string | null | undefined, userId: string): string | null {
  if (!url) return null;
  const marca = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marca);
  if (i < 0) return null;
  const path = decodeURIComponent(url.slice(i + marca.length).split("?")[0]);
  return path.startsWith(`${userId}/`) ? path : null;
}

let contador = 0;

export function useFotosDoProduto(
  userId: string,
  produtoId: string | null,
  fotoUrlInicial: string | null,
) {
  const { data: doBanco, isLoading } = useQuery({
    queryKey: ["produto-fotos", produtoId],
    enabled: !!produtoId,
    // Sem cache entre aberturas: o modal lê o banco uma vez só, então dado velho em cache ficaria na tela.
    gcTime: 0,
    queryFn: async (): Promise<FotoProduto[]> => {
      const { data, error } = await supabase
        .from("produto_fotos" as never)
        .select("id, path, ordem")
        .eq("produto_id", produtoId!)
        .order("ordem");
      if (error) throw error;
      return ((data ?? []) as unknown as Array<{ id: string; path: string; ordem: number }>).map(
        (f) => ({
          ...f,
          url: urlDaFoto(f.path),
        }),
      );
    },
  });

  const [itens, setItens] = useState<FotoNoModal[]>([]);
  const [removidas, setRemovidas] = useState<FotoProduto[]>([]);
  // Foto enviada pelo botão de foto única (só em foto_url, sem linha em produto_fotos):
  // entra como primeira foto e ganha a linha no Salvar.
  const [adotar, setAdotar] = useState<string | null>(null);
  // Link colado (foto fora do bucket): só vale quando não há foto enviada.
  const [link, setLink] = useState(() =>
    caminhoNoBucket(fotoUrlInicial, userId) ? "" : (fotoUrlInicial ?? ""),
  );

  // Lê o banco uma vez só: refetch (foco na janela) não pode ressuscitar foto tirada.
  const iniciado = useRef(false);
  useEffect(() => {
    if (!doBanco || iniciado.current) return;
    iniciado.current = true;
    const salvas: FotoNoModal[] = doBanco.map((f) => ({
      tipo: "salva",
      chave: f.id,
      url: f.url,
      foto: f,
    }));
    const path = doBanco.length ? null : caminhoNoBucket(fotoUrlInicial, userId);
    if (path) {
      setAdotar(path);
      salvas.push({
        tipo: "salva",
        chave: "adotada",
        url: urlDaFoto(path),
        foto: { id: "", path, ordem: 0, url: urlDaFoto(path) },
      });
    }
    setItens((atual) => [...salvas, ...atual.filter((x) => x.tipo === "nova")]);
  }, [doBanco, fotoUrlInicial, userId]);

  // Prévia em object URL: libera quando a foto sai da lista ou o modal fecha.
  const previas = useRef(new Set<string>());
  useEffect(() => {
    const abertas = previas.current;
    return () => {
      for (const u of abertas) URL.revokeObjectURL(u);
    };
  }, []);

  /** Põe arquivos na fila até completar 4. Devolve o motivo quando algum fica de fora. */
  const adicionar = (arquivos: File[]): string | null => {
    let aviso: string | null = null;
    const novas: FotoNoModal[] = [];
    for (const arquivo of arquivos) {
      if (itens.length + novas.length >= MAX_FOTOS_PRODUTO) {
        aviso = "Cada produto leva até 4 fotos.";
        break;
      }
      const problema = problemaDaFoto(arquivo);
      if (problema) {
        aviso = problema;
        continue;
      }
      const url = URL.createObjectURL(arquivo);
      previas.current.add(url);
      novas.push({ tipo: "nova", chave: `nova-${++contador}`, url, arquivo });
    }
    if (novas.length) setItens((atual) => [...atual, ...novas]);
    return aviso;
  };

  const tirar = (chave: string) => {
    const item = itens.find((x) => x.chave === chave);
    if (!item) return;
    if (item.tipo === "nova") {
      URL.revokeObjectURL(item.url);
      previas.current.delete(item.url);
    } else if (item.chave === "adotada") setAdotar(null);
    else setRemovidas((r) => [...r, item.foto]);
    setItens((atual) => atual.filter((x) => x.chave !== chave));
  };

  /**
   * Grava as fotos do produto e devolve a foto_url que o produto deve guardar
   * (a primeira foto, ou o link colado quando não há foto enviada).
   */
  const salvar = async (id: string): Promise<{ erro: string | null; fotoUrl: string | null }> => {
    for (const f of removidas) {
      const r = await removerFotoProduto(f);
      if (r.error) return { erro: r.error, fotoUrl: null };
    }
    const { data: atuais, error } = await supabase
      .from("produto_fotos" as never)
      .select("ordem")
      .eq("produto_id", id);
    if (error) return { erro: "A Pólia One não conseguiu guardar as fotos agora.", fotoUrl: null };
    const ocupadas = ((atuais ?? []) as unknown as Array<{ ordem: number }>).map((f) => f.ordem);
    if (adotar && !ocupadas.includes(0)) {
      const { error: e } = await supabase
        .from("produto_fotos" as never)
        .insert({ user_id: userId, produto_id: id, path: adotar, ordem: 0 } as never);
      if (e) return { erro: "A Pólia One não conseguiu guardar as fotos agora.", fotoUrl: null };
      ocupadas.push(0);
    }
    for (const x of itens) {
      if (x.tipo !== "nova") continue;
      const r = await subirFotoProduto(userId, id, x.arquivo, ocupadas);
      if (r.error) return { erro: r.error, fotoUrl: null };
      ocupadas.push([0, 1, 2, 3].find((o) => !ocupadas.includes(o)) ?? 3);
    }
    const { data: primeira } = await supabase
      .from("produto_fotos" as never)
      .select("path")
      .eq("produto_id", id)
      .order("ordem")
      .limit(1);
    const path = ((primeira ?? []) as unknown as Array<{ path: string }>)[0]?.path;
    return { erro: null, fotoUrl: path ? urlDaFoto(path) : link.trim() || null };
  };

  return { itens, carregando: !!produtoId && isLoading, adicionar, tirar, link, setLink, salvar };
}
