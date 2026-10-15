// Link de e-mail (confirmação, magiclink do lembrete) que voltou com erro do
// Supabase (15/10/2026). Puro: recebe pathname, hash e query, devolve o caso.
//
// Link vencido ou já usado chega como
// #error=access_denied&error_code=otp_expired&error_description=...
// no destino do link (hoje /painel). Sem tratar, o guard da área logada via
// "sem sessão" e mandava pro login sem explicação nenhuma, levando o erro
// escondido dentro do ?next=.
//
// access_denied sem otp_expired é outra coisa: ela desistiu na tela do Google
// (o OAuth também volta pro /painel). Isso não é link expirado: vai pra entrada
// com aviso neutro, como o __root já fazia.

export type LinkComErro = "link-vencido" | "entrada-cancelada";

// Telas que tratam o próprio link: o convite da compra e a redefinição de
// senha mostram a versão certa do "link expirado" pra elas.
const TRATAM_SOZINHAS = new Set([
  "/auth/redefinir-senha",
  "/auth/criar-senha",
  "/auth/link-expirado",
]);

function parametros(trecho: string): URLSearchParams {
  return new URLSearchParams(trecho.replace(/^[#?]/, ""));
}

export function lerLinkComErro(pathname: string, hash: string, search: string): LinkComErro | null {
  if (TRATAM_SOZINHAS.has(pathname)) return null;
  const doHash = parametros(hash);
  const daQuery = parametros(search);
  const codigo = doHash.get("error_code") ?? daQuery.get("error_code");
  if (codigo === "otp_expired") return "link-vencido";
  const erro = doHash.get("error") ?? daQuery.get("error");
  if (erro === "access_denied") return "entrada-cancelada";
  return null;
}
