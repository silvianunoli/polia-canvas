// Domínio da área de gestão (/admin), separado do domínio do produto —
// fonte única usada tanto no redirecionamento de servidor (src/server.ts)
// quanto na trava de navegação client-side (routes/__root.tsx), já que
// navegação dentro do SPA não passa pelo servidor.
export const DOMINIO_GESTAO = "silvianunoli.com.br";
export const PREFIXOS_PERMITIDOS_NO_DOMINIO_GESTAO = [
  "/admin",
  "/central",
  "/auth",
  "/_serverFn",
  "/assets",
  "/favicon",
  "/health",
];

export function caminhoPermitidoNoDominioGestao(pathname: string): boolean {
  return PREFIXOS_PERMITIDOS_NO_DOMINIO_GESTAO.some((prefixo) => pathname.startsWith(prefixo));
}
