import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

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
    <div className="polia-v3 min-h-screen bg-white text-[var(--ink)]">
      <SiteHeader />
      <main className="mx-auto max-w-[560px] px-6 py-24 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-pink)]">
          <Mail size={26} aria-hidden="true" />
        </div>
        <h1 className="font-fraunces text-[32px] leading-tight text-[var(--ink)] md:text-[40px]">
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
        <Link
          to="/"
          className="mt-8 inline-flex rounded-lg border border-[var(--line)] px-6 py-3 text-[15px] font-semibold text-[var(--ink)] no-underline transition-colors hover:bg-[var(--bg)]"
        >
          Voltar ao início
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
