import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { getCookieConsent, setCookieConsent, type CookieConsentValue } from "@/lib/cookieConsent";
import { BTN_CONTORNO, BTN_PRIMARIO } from "@/lib/botoes";

// Tela de entrada do app Android (AND-10, 07/11/2026). O app abre aqui
// (server.url do capacitor.config.ts), no lugar da home de marketing: quem
// baixou o app já decidiu usar a Pólia One. Uma ação principal: Entrar.
// Com sessão, vai direto pra aba Hoje. Wireframe aprovado pela Sil em 07/11.
//
// Dentro do app o aviso flutuante de cookies não aparece (CookieConsent): a
// escolha fica na linha do rodapé desta tela, sem tampar os botões.
export function TelaEntradaApp() {
  const { user, loading } = useSupabaseSession();
  const router = useRouter();
  // Só depois de montar: o servidor não lê o localStorage.
  const [pedirCookies, setPedirCookies] = useState(false);

  useEffect(() => {
    setPedirCookies(getCookieConsent() === null);
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    router.navigate({ to: "/hoje", replace: true });
  }, [loading, user, router]);

  const escolherCookies = (valor: CookieConsentValue) => {
    setCookieConsent(valor);
    setPedirCookies(false);
  };

  // Enquanto a sessão carrega (ou ela vai pra aba Hoje), fica só a marca no
  // fundo pedra, a mesma cara da abertura do Android: nada de botão piscando.
  const decidindo = loading || !!user;

  return (
    <main
      aria-busy={decidindo}
      className="polia-v3 flex min-h-[100dvh] flex-col bg-[var(--bg)] px-6 pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))] text-[var(--ink)]"
    >
      <PoliaWordmark className="h-8 w-auto self-start" />

      {decidindo ? (
        <p className="sr-only" role="status">
          Abrindo a Pólia One
        </p>
      ) : (
        <>
          <div className="mt-auto pt-12">
            <p className="font-accent text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              O sistema da sua marca
            </p>
            <h1 className="font-cabinet mt-3 text-[32px] leading-[1.1] tracking-[-0.02em]">
              Cada encomenda num lugar só.
            </h1>
            <p className="mt-3 text-[16px] leading-[1.5] text-[var(--ink-soft)]">
              Pedidos, entregas e quanto cada um lucra.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <Link to="/auth/login" className={`${BTN_PRIMARIO} w-full`}>
                Entrar
              </Link>
              <Link
                to="/auth/cadastro"
                search={{ origem: "app" }}
                className={`${BTN_CONTORNO} w-full`}
              >
                Criar conta grátis
              </Link>
            </div>
          </div>

          {pedirCookies && (
            <div
              role="group"
              aria-label="Cookies de análise"
              className="mt-8 flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-[var(--line)] pt-4 text-[13px] leading-[1.5] text-[var(--muted)]"
            >
              <span>Cookies de análise:</span>
              <button
                type="button"
                onClick={() => escolherCookies("accepted")}
                className="inline-flex min-h-11 items-center px-1 font-semibold text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ink)]"
              >
                Aceitar
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => escolherCookies("essential")}
                className="inline-flex min-h-11 items-center px-1 font-semibold text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ink)]"
              >
                Só essenciais
              </button>
              <Link
                to="/privacidade"
                className="ml-auto inline-flex min-h-11 items-center text-[var(--secondary-text)] underline underline-offset-[3px]"
              >
                Privacidade
              </Link>
            </div>
          )}
        </>
      )}
    </main>
  );
}
