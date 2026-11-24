/**
 * Guia oficial de cada canal pra abrir a conta de vendedora (ONE-255,
 * 24/11/2026). Sem endereço conferido, fica null e o link não aparece: os
 * sites dos canais bloqueiam leitura automática, então a Sil confere no
 * navegador antes de entrar aqui. Nunca pôr endereço de cabeça.
 */
export const GUIA_VENDEDORA: Record<"mercado_livre" | "tiktok_shop", string | null> = {
  mercado_livre: null,
  tiktok_shop: null,
};
