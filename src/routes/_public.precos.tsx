import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check } from "lucide-react";

export const Route = createFileRoute("/_public/precos")({
  head: () => ({
    meta: [
      { title: "Preços · Pólia" },
      {
        name: "description",
        content: "Gratuito durante o beta. Simples, justo e feito pra quem está começando.",
      },
      { property: "og:title", content: "Preços · Pólia" },
      { property: "og:description", content: "Acesso beta gratuito. Lançamento maio/2026." },
    ],
  }),
  component: Precos,
});

function Precos() {
  return (
    <>
      {/* Voltar */}
      <div style={{ background: "var(--azul-noite)", paddingTop: 80 }}>
        <div className="max-w-3xl mx-auto px-6">
          <Link
            to="/"
            className="font-sans inline-flex items-center gap-2"
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.50)",
              textDecoration: "none",
              transition: "color 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.80)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.50)")}
          >
            <ArrowLeft size={16} />
            Voltar
          </Link>
        </div>
      </div>

      <section className="bg-[#1A1A2E] py-20 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <p className="font-sans font-semibold text-[#E89770] text-[12px] uppercase tracking-[0.18em] mb-4">
            Preços
          </p>
          <h1 className="font-serif text-[#FDF8F5] text-[40px] md:text-[56px] leading-tight mb-4">
            Simples. Justo. Feito pra quem está começando.
          </h1>
          <p className="caveat-decorativo text-[#E89770]">
            na landing tem o resumo. aqui tem tudo.
          </p>
        </div>
      </section>

      <section className="bg-[#FDF8F5] py-24">
        <div className="max-w-2xl mx-auto px-6">
          <div className="bg-white rounded-3xl border-2 border-[#C96B3E] p-10 shadow-lg">
            <p className="font-sans font-semibold text-[#C96B3E] text-[11px] uppercase tracking-[0.18em] mb-3">
              Acesso beta
            </p>
            <p className="font-serif text-[#1A1A2E] text-[56px] leading-none mb-1">Grátis</p>
            <p className="font-sans text-[#1A1A2E]/55 text-[14px] mb-8">
              durante o período de lançamento
            </p>

            <ul className="space-y-3 mb-10">
              {[
                "11 etapas completas com guia de IA",
                "Entregáveis salvos e sempre com você",
                "4 ferramentas vivas: Marca, Vitrine, Vendas e Financeiro",
                "Biblioteca editável de todos os entregáveis",
                "Kanban de tarefas por etapa",
                "Painel financeiro com meta mensal",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check size={20} className="text-[#1A8F5C] shrink-0 mt-0.5" />
                  <span className="font-sans text-[#1A1A2E] text-[15px]">{item}</span>
                </li>
              ))}
            </ul>

            <Link
              to="/lista-de-espera"
              className="block w-full text-center bg-[#C96B3E] text-[#FDF8F5] font-sans font-semibold text-[15px] py-4 rounded-xl hover:bg-[#B85A2D] transition-colors"
            >
              Entrar na lista de espera
            </Link>
          </div>

          <div className="mt-10 text-center">
            <p className="font-sans font-semibold text-[#1A1A2E]/60 text-[11px] uppercase tracking-wider mb-2">
              Pós-beta
            </p>
            <p className="font-serif text-[#1A1A2E] text-[22px] mb-2">R$ 29/mês ou R$ 247/ano</p>
            <p className="font-sans text-[#1A1A2E]/55 text-[14px] max-w-md mx-auto">
              Quem entrar na lista de espera vai receber a menor taxa possível — pra sempre.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
