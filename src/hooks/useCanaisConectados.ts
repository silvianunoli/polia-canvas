import { useQuery } from "@tanstack/react-query";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { statusConexaoMercadoLivre } from "@/lib/mercadoLivre.functions";
import { statusConexaoTiktok } from "@/lib/tiktokShop.functions";

// Canais de venda conectados, para o subnível "Anúncios nos canais" da sidebar
// e a tela /produtos/anuncios (VND-39). Usa as mesmas chaves de cache dos cards
// de Configurações > Integrações: conectar ou desconectar lá atualiza aqui.

export const CHAVE_STATUS_TIKTOK = "tiktok-status";
export const CHAVE_STATUS_ML = "mercado-livre-status";

export type CanalConectado = {
  canal: "mercado_livre" | "tiktok_shop";
  nome: string;
  loja: string | null;
  anunciosLigados: number;
  ultimoSync: string | null;
  /** Tela de ligar anúncios desse canal. */
  href: string;
};

export function useCanaisConectados() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const ml = useQuery({
    queryKey: [CHAVE_STATUS_ML, userId],
    enabled: !!userId,
    queryFn: () => statusConexaoMercadoLivre(),
    staleTime: 60_000,
  });
  const tiktok = useQuery({
    queryKey: [CHAVE_STATUS_TIKTOK, userId],
    enabled: !!userId,
    queryFn: () => statusConexaoTiktok(),
    staleTime: 60_000,
  });

  const canais: CanalConectado[] = [];
  // Só conta canal conectado e liberado no plano: quem perdeu o Pro não vê o atalho.
  if (ml.data?.configurado && ml.data.conectada && ml.data.liberado)
    canais.push({
      canal: "mercado_livre",
      nome: "Mercado Livre",
      loja: ml.data.lojaNome,
      anunciosLigados: ml.data.anunciosLigados,
      ultimoSync: ml.data.ultimoSync,
      href: "/produtos/anuncios/mercado-livre",
    });
  if (tiktok.data?.configurado && tiktok.data.conectada && tiktok.data.liberado)
    canais.push({
      canal: "tiktok_shop",
      nome: "TikTok Shop",
      loja: tiktok.data.lojaNome,
      anunciosLigados: tiktok.data.anunciosLigados,
      ultimoSync: tiktok.data.ultimoSync,
      href: "/produtos/anuncios/tiktok",
    });

  return {
    canais,
    carregando: ml.isLoading || tiktok.isLoading,
    erro: ml.isError || tiktok.isError,
  };
}
