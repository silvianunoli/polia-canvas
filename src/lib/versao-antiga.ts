// Aba aberta antes de um deploy pede um pedaço da página (chunk) que o deploy
// novo apagou: "Failed to fetch dynamically imported module" e a tela trava
// (FND-14, 23/10/2026: 12 erros em 7 dias, em /landing-b e /premium-b). O
// Vite avisa com o evento vite:preloadError antes de estourar; aqui a página
// recarrega uma vez e pega a versão nova. A trava de tempo impede loop se o
// arquivo faltar de verdade (aí o erro segue o caminho normal e vai pro log).

const CHAVE = "polia-recarga-versao-antiga";
const JANELA_MS = 30_000;

type Armazenamento = Pick<Storage, "getItem" | "setItem">;

/** Devolve true quando recarregou (e o erro não deve estourar). */
export function recarregarSeVersaoAntiga(
  armazenamento: Armazenamento | undefined,
  recarregar: () => void,
  agora: number = Date.now(),
): boolean {
  // sessionStorage ausente ou bloqueado (aba anônima de alguns navegadores):
  // sem a trava, não arrisca loop de recarga.
  if (!armazenamento) return false;
  try {
    const ultima = Number(armazenamento.getItem(CHAVE) ?? 0);
    if (ultima && agora - ultima < JANELA_MS) return false;
    armazenamento.setItem(CHAVE, String(agora));
  } catch {
    return false;
  }
  recarregar();
  return true;
}
