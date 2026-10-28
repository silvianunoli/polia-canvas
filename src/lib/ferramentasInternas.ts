// Planner e Caderno saíram das usuárias (decisão da Sil em 28/10/2026): o
// quadro de Pedidos virou a rotina. Ficam só pra conta interna, pelas flags
// `planner` e `caderno` em founder_flags (estado beta, beta_user_ids). Os dados
// de quem já usou continuam guardados. Aqui só a regra; a leitura das flags fica
// em hooks/useFerramentasInternas.ts e na guarda de _authenticated.
//
// O Caderno não é bloqueado na rota: o fim do Módulo 5 abre /caderno, e o guia
// de presença (canais, voz e bio) mora no topo dele. Sem a flag a tela mostra
// só o guia; as notas e o item do menu é que ficam pra conta interna.

export type FerramentaInterna = "planner" | "caderno";

export type AcessoInterno = Record<FerramentaInterna, boolean>;

export const SEM_ACESSO_INTERNO: AcessoInterno = { planner: false, caderno: false };

/** Pra onde a rota bloqueada leva quem não tem a flag. */
export const DESTINO_SEM_ACESSO = { planner: "/pedidos" } as const;

/**
 * Rota que a guarda bloqueia sem a flag: o Planner inteiro, menos o antigo
 * /planner/pedidos (que só redireciona pros Pedidos). O Caderno nunca.
 */
export function rotaBloqueadaSemFlag(pathname: string): "planner" | null {
  if (pathname === "/planner/pedidos" || pathname.startsWith("/planner/pedidos/")) return null;
  if (pathname === "/planner" || pathname.startsWith("/planner/")) return "planner";
  return null;
}

const ITEM_DE_MENU: Record<string, FerramentaInterna> = {
  "/planner": "planner",
  "/caderno": "caderno",
};

/** O item de menu aparece: item comum sempre; Planner e Caderno só com a flag. */
export function rotaVisivel(to: string, acesso: AcessoInterno): boolean {
  const f = ITEM_DE_MENU[to];
  return f === undefined || acesso[f];
}
