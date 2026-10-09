import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Mail } from "lucide-react";
import { gtagEvent } from "@/lib/gtag";
import { pixelCompra } from "@/lib/metaPixel";
import { valorDoPlano } from "@/lib/planos";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Reveal } from "@/components/site/Reveal";
import { BTN_CONTORNO, BTN_PRIMARIO } from "@/components/site/Editorial";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

type CompraConfirmadaSearch = { plano?: string; session_id?: string };

export const Route = createFileRoute("/compra-confirmada")({
  validateSearch: (search: Record<string, unknown>): CompraConfirmadaSearch => ({
    plano: typeof search.plano === "string" ? search.plano : undefined,
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [{ title: "Compra confirmada · Pólia" }, { name: "robots", content: "noindex" }],
  }),
  component: CompraConfirmadaPage,
});

function CompraConfirmadaPage() {
  const { plano, session_id } = Route.useSearch();
  // Quem comprou já logada (ex.: tinha conta e entrou antes) vai direto pro
  // Painel em vez de voltar pra home (08/10/2026).
  const { user } = useSupabaseSession();

  // Conversão de compra pro GA4/Google Ads (FUN-09). O Stripe só manda pra cá
  // com o pagamento aprovado; o transaction_id faz o GA4 ignorar a mesma compra
  // contada de novo num recarregar da página.
  useEffect(() => {
    const valor = valorDoPlano(plano);
    if (valor === null || !session_id) return;
    gtagEvent("purchase", {
      transaction_id: session_id,
      value: valor,
      currency: "BRL",
      items: [{ item_id: plano, item_name: plano, price: valor, quantity: 1 }],
    });
    pixelCompra(valor, plano ?? "assinatura", session_id);
  }, [plano, session_id]);

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader />
      <main id="conteudo" className="mx-auto max-w-[560px] px-6 py-24 text-center">
        <Reveal>
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-pink)]">
            <Mail size={28} aria-hidden="true" />
          </div>
          <h1 className="font-cabinet text-[32px] leading-tight text-[var(--ink)] md:text-[40px]">
            Compra confirmada.
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed text-[var(--ink-soft)]">
            Confira seu e-mail nos próximos minutos: chega a confirmação da compra. Quem ainda não
            tinha conta recebe também o link para criar a senha e entrar na Pólia pela primeira vez.
          </p>
          <p className="mt-3 text-[14px] text-[var(--muted)]">
            Não achou? Olha a caixa de spam. Se não chegar, escreve pra{" "}
            <a href="mailto:oi@usepolia.com.br" className="text-[var(--ink)] underline">
              oi@usepolia.com.br
            </a>
            .
          </p>
          {user ? (
            <Link to="/painel" className={`${BTN_PRIMARIO} mt-8`}>
              Ir pro Painel
            </Link>
          ) : (
            <Link to="/" className={`${BTN_CONTORNO} mt-8`}>
              Voltar ao início
            </Link>
          )}
        </Reveal>
      </main>
      <SiteFooter />
    </div>
  );
}
