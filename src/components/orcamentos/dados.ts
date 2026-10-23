// Leitura e escrita de orçamentos e da identidade da marca (ONE-129), do lado
// da dona (com login, RLS). A página pública da cliente usa
// lib/orcamentos.functions.ts, pelo servidor.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { urlCanonica } from "@/lib/seo";
import type { ItemOrcamento, Orcamento, StatusOrcamento } from "@/lib/orcamentos";

export const chaveOrcamentos = (userId: string | undefined) => ["orcamentos", userId] as const;
export const chaveIdentidade = (userId: string | undefined) =>
  ["identidade-marca", userId] as const;

/** Link que vai pra cliente. Sempre no domínio oficial, mesmo testando local. */
export const linkDoOrcamento = (token: string) => urlCanonica(`/o/${token}`);

type OrcamentoBanco = {
  id: string;
  numero: number;
  cliente_id: string | null;
  cliente_nome: string | null;
  itens: Json;
  subtotal: number;
  desconto: number;
  frete: number;
  total: number;
  validade: string;
  observacao: string | null;
  status: string;
  aprovado_em: string | null;
  venda_id: string | null;
  link_token: string;
  created_at: string;
};

const daLinha = (r: OrcamentoBanco): Orcamento => ({
  id: r.id,
  numero: r.numero,
  clienteId: r.cliente_id,
  clienteNome: r.cliente_nome,
  itens: (r.itens as unknown as ItemOrcamento[]).map((i) => ({
    ...i,
    quantidade: Number(i.quantidade),
    preco_unitario: Number(i.preco_unitario),
  })),
  subtotal: Number(r.subtotal),
  desconto: Number(r.desconto),
  frete: Number(r.frete),
  total: Number(r.total),
  validade: r.validade,
  observacao: r.observacao,
  status: r.status as StatusOrcamento,
  aprovadoEm: r.aprovado_em,
  vendaId: r.venda_id,
  linkToken: r.link_token,
  createdAt: r.created_at,
});

export function useOrcamentos(userId: string | undefined) {
  return useQuery({
    queryKey: chaveOrcamentos(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select(
          "id, numero, cliente_id, cliente_nome, itens, subtotal, desconto, frete, total, validade, observacao, status, aprovado_em, venda_id, link_token, created_at",
        )
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return ((data ?? []) as OrcamentoBanco[]).map(daLinha);
    },
  });
}

export interface NovoOrcamento {
  clienteId: string | null;
  clienteNome: string | null;
  itens: ItemOrcamento[];
  desconto: number;
  frete: number;
  validade: string;
  observacao: string | null;
}

/** Cria e devolve o orçamento já com número e link (o banco gera os dois). */
export async function criarOrcamento(userId: string, o: NovoOrcamento) {
  const { data, error } = await supabase
    .from("orcamentos")
    .insert({
      user_id: userId,
      cliente_id: o.clienteId,
      cliente_nome: o.clienteNome,
      itens: o.itens as unknown as Json,
      desconto: o.desconto,
      frete: o.frete,
      validade: o.validade,
      observacao: o.observacao,
    })
    .select(
      "id, numero, cliente_id, cliente_nome, itens, subtotal, desconto, frete, total, validade, observacao, status, aprovado_em, venda_id, link_token, created_at",
    )
    .single();
  if (error) console.error("orcamento_criar", error);
  return { orcamento: data ? daLinha(data as OrcamentoBanco) : null, error };
}

// Aprovar é da cliente (pelo link) e virar venda é da converter_orcamento: o
// gatilho do banco recusa os dois por aqui. Daqui só sai o cancelamento.
export const cancelarOrcamento = (id: string) =>
  supabase.from("orcamentos").update({ status: "cancelado" }).eq("id", id);

export const excluirOrcamento = (id: string) => supabase.from("orcamentos").delete().eq("id", id);

// ── identidade da marca ────────────────────────────────────────────────────

export interface IdentidadeMarca {
  nome: string;
  logoPath: string | null;
  logoUrl: string | null;
  cor: string | null;
}

export const urlDoLogo = (path: string | null) =>
  path ? supabase.storage.from("marca-logos").getPublicUrl(path).data.publicUrl : null;

export function useIdentidadeMarca(userId: string | undefined) {
  return useQuery({
    queryKey: chaveIdentidade(userId),
    enabled: !!userId,
    queryFn: async (): Promise<IdentidadeMarca> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("business_name, full_name, logo_path, cor_marca")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return {
        nome: data?.business_name?.trim() || data?.full_name?.trim() || "",
        logoPath: data?.logo_path ?? null,
        logoUrl: urlDoLogo(data?.logo_path ?? null),
        cor: data?.cor_marca ?? null,
      };
    },
  });
}

export const LOGO_TIPOS = ["image/png", "image/jpeg", "image/webp"] as const;
export const LOGO_MAX_BYTES = 1024 * 1024;

/**
 * Sobe o logo novo com nome único (o link público muda junto e o navegador não
 * mostra o antigo do cache), grava o caminho e apaga o arquivo anterior.
 */
export async function trocarLogo(userId: string, arquivo: File, caminhoAntigo: string | null) {
  const ext = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg";
  const caminho = `${userId}/logo-${Date.now()}.${ext}`;
  const up = await supabase.storage
    .from("marca-logos")
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
  if (up.error) return { error: up.error };
  const { error } = await supabase.from("profiles").update({ logo_path: caminho }).eq("id", userId);
  if (error) {
    await supabase.storage.from("marca-logos").remove([caminho]);
    return { error };
  }
  if (caminhoAntigo) await supabase.storage.from("marca-logos").remove([caminhoAntigo]);
  return { error: null };
}

export async function removerLogo(userId: string, caminho: string) {
  const { error } = await supabase.from("profiles").update({ logo_path: null }).eq("id", userId);
  if (!error) await supabase.storage.from("marca-logos").remove([caminho]);
  return { error };
}

export const salvarCorMarca = (userId: string, cor: string | null) =>
  supabase.from("profiles").update({ cor_marca: cor }).eq("id", userId);
