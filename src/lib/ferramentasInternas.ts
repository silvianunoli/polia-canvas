// Planner e Caderno saíram das usuárias (decisão da Sil em 28/10/2026): o
// quadro de Pedidos virou a rotina. Ficam só pra conta interna, pelas flags
// `planner` e `caderno` em founder_flags (estado beta, beta_user_ids). Os dados
// de quem já usou continuam guardados. Aqui só a regra; a leitura das flags fica
// em hooks/useFerramentasInternas.ts e na guarda de _authenticated.
//
// O Planejamento (os 6 módulos) e os documentos que nascem dele, Marca e Mapa
// de Mercado, saíram da Pólia One em 31/10/2026 (decisão da Sil): viram
// ferramenta do Pólia Lab depois. Ficam só pra conta interna pela flag
// `planejamento` (migration 20261031200000). Os dados continuam no banco.
//
// O Caderno não é bloqueado na rota: o fim do Módulo 5 abre /caderno, e o guia
// de presença (canais, voz e bio) mora no topo dele. Sem a flag a tela mostra
// só o guia; as notas e o item do menu é que ficam pra conta interna.

export type FerramentaInterna = "planner" | "caderno" | "planejamento";

export type AcessoInterno = Record<FerramentaInterna, boolean>;

export const SEM_ACESSO_INTERNO: AcessoInterno = {
  planner: false,
  caderno: false,
  planejamento: false,
};

/** Ferramenta que a guarda da rota bloqueia sem a flag. */
export type FerramentaBloqueada = "planner" | "planejamento";

/** Pra onde a rota bloqueada leva quem não tem a flag. */
export const DESTINO_SEM_ACESSO = { planner: "/pedidos", planejamento: "/painel" } as const;

function bate(prefixo: string, pathname: string): boolean {
  return pathname === prefixo || pathname.startsWith(prefixo + "/");
}

/**
 * Rota que a guarda bloqueia sem a flag: o Planner inteiro, menos o antigo
 * /planner/pedidos (que só redireciona pros Pedidos); o Planejamento inteiro
 * (módulos e /planejamento/completo) e os documentos Marca e Mercado. O
 * Caderno nunca.
 */
export function rotaBloqueadaSemFlag(pathname: string): FerramentaBloqueada | null {
  if (bate("/planner/pedidos", pathname)) return null;
  if (bate("/planner", pathname)) return "planner";
  if (bate("/planejamento", pathname) || bate("/marca", pathname) || bate("/mercado", pathname)) {
    return "planejamento";
  }
  return null;
}

const ITEM_DE_MENU: Record<string, FerramentaInterna> = {
  "/planner": "planner",
  "/caderno": "caderno",
  "/planejamento": "planejamento",
};

/** O item de menu aparece: item comum sempre; Planner, Caderno e Planejamento só com a flag. */
export function rotaVisivel(to: string, acesso: AcessoInterno): boolean {
  const f = ITEM_DE_MENU[to];
  return f === undefined || acesso[f];
}
