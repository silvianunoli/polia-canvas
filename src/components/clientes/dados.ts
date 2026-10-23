// Leitura de Clientes e leads (VND-04). Regras em lib/leads.ts; aqui só a
// ponte com o Supabase.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { vendaDoBanco, type VendaLinha } from "@/components/vendas/dados";

/** Total comprado por cliente (vendas que valem), pro "de onde vem quem compra". */
export function useCompradoPorCliente(userId: string | undefined) {
  return useQuery({
    queryKey: ["clientes-comprado", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select("cliente_id, total")
        .eq("user_id", userId!)
        .neq("status", "cancelada")
        .not("cliente_id", "is", null);
      if (error) throw error;
      const mapa = new Map<string, number>();
      for (const v of data ?? []) {
        if (!v.cliente_id) continue;
        mapa.set(v.cliente_id, (mapa.get(v.cliente_id) ?? 0) + Number(v.total ?? 0));
      }
      return mapa;
    },
  });
}

/** Compras de uma cliente, mais recente primeiro (canceladas ficam de fora). */
export function useComprasDaCliente(clienteId: string | null) {
  return useQuery({
    queryKey: ["cliente-compras", clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<VendaLinha[]> => {
      const { data, error } = await supabase
        .from("vendas")
        .select(
          "id, canal, data, status, cliente_id, cliente_nome, subtotal, desconto, frete, taxa_canal, total, observacao, venda_itens(produto_id, produto_nome, variacao, quantidade, preco_unitario, custo_unitario)",
        )
        .eq("cliente_id", clienteId!)
        .neq("status", "cancelada")
        .order("data", { ascending: false })
        .limit(50);
      if (error) throw error;
      return ((data ?? []) as unknown as Parameters<typeof vendaDoBanco>[0][]).map(vendaDoBanco);
    },
  });
}

/** A dona abriu a ficha: some a etiqueta "novo". Falha aqui não atrapalha nada. */
export async function marcarComoVista(clienteId: string) {
  const { error } = await supabase.from("clientes").update({ novo: false }).eq("id", clienteId);
  if (error) console.error("cliente_vista", error);
}

export interface LinkCaptura {
  slug: string;
  ativo: boolean;
  titulo: string | null;
  pergunta: string | null;
}

export function useLinkCaptura(userId: string | undefined) {
  return useQuery({
    queryKey: ["link-captura", userId],
    enabled: !!userId,
    queryFn: async (): Promise<LinkCaptura | null> => {
      const { data, error } = await supabase
        .from("links_captura")
        .select("slug, ativo, titulo, pergunta")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export async function salvarLinkCaptura(userId: string, link: LinkCaptura) {
  return supabase.from("links_captura").upsert(
    {
      user_id: userId,
      slug: link.slug,
      ativo: link.ativo,
      titulo: link.titulo,
      pergunta: link.pergunta,
    },
    { onConflict: "user_id" },
  );
}
