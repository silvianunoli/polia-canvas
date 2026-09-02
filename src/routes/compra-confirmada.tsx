import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { BTN_CONTORNO } from "@/components/site/Editorial";

export const Route = createFileRoute("/compra-confirmada")({
  head: () => ({
    meta: [
      { title: "Compra confirmada · Pólia" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CompraConfirmadaPage,
});

function CompraConfirmadaPage() {
  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader />
      <main className="mx-auto max-w-[560px] px-6 py-24 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-pink)]">
          <Mail size={28} aria-hidden="true" />
        </div>
        <h1 className="font-cabinet text-[32px] leading-tight text-[var(--ink)] md:text-[40px]">
          Compra confirmada.
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-[var(--ink-soft)]">
          Confira seu e-mail nos próximos minutos: chega um link pra você criar sua senha e entrar
          na Pólia pela primeira vez.
        </p>
        <p className="mt-3 text-[14px] text-[var(--muted)]">
          Não achou? Olha a caixa de spam. Se não chegar, escreve pra{" "}
          <a href="mailto:oi@usepolia.com.br" className="text-[var(--ink)] underline">
            oi@usepolia.com.br
          </a>
          .
        </p>
        <Link to="/" className={`${BTN_CONTORNO} mt-8`}>
          Voltar ao início
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
