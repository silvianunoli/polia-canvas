import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ErrorPage, type ErrorPageProps } from "@/components/layout/ErrorPage";

/**
 * Versão "site" da ErrorPage — cabeçalho e rodapé públicos em volta, pra quem
 * está deslogada (seção 2 do PRD de erros de auth). Quem está logada continua
 * vendo a ErrorPage pura (sem navegação), como já era.
 */
export function SiteErrorPage(props: ErrorPageProps) {
  return (
    <div className="polia-v3 flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <div className="flex-1">
        <ErrorPage {...props} />
      </div>
      <SiteFooter />
    </div>
  );
}
