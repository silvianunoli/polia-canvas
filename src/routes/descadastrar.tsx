import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";
import { descadastrarLeadQuiz, reinscreverLeadQuiz } from "@/lib/quiz.functions";

// Saída de um clique do e-mail do quiz. O consentimento promete "você sai
// quando quiser", e essa promessa mora aqui.
//
// O descadastro acontece no load, sem botão de confirmar: quem clicou em "Não
// quero mais receber" já disse o que queria, e pedir confirmação depois disso é
// atrito pra segurar quem quer sair. O preço é que um leitor automático de link
// (antivírus, scanner de caixa corporativa) pode disparar sem a pessoa querer,
// e é por isso que existe o "Voltar a receber" na tela: desfazer é um clique
// também, e o token continua valendo.
//
// O token vem só na query, nunca o e-mail: endereço em URL vaza no histórico,
// no referer e no log de qualquer proxy no caminho.

export const Route = createFileRoute("/descadastrar")({
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === "string" ? search.t : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Descadastro · Pólia" },
      // Página de link privado: não entra em buscador.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DescadastrarPage,
});

type Estado = "processando" | "saiu" | "voltou" | "falhou";

function DescadastrarPage() {
  const { t } = Route.useSearch();
  const [estado, setEstado] = useState<Estado>("processando");
  const [ocupado, setOcupado] = useState(false);
  const jaRodou = useRef(false);

  useEffect(() => {
    // Em dev o React monta duas vezes; sem essa trava o descadastro sairia
    // duplicado (inofensivo aqui, mas o mesmo padrão evita bug em quem copiar).
    if (jaRodou.current) return;
    jaRodou.current = true;

    if (!t) {
      setEstado("falhou");
      return;
    }
    descadastrarLeadQuiz({ data: { token: t } })
      .then((r) => setEstado(r.ok ? "saiu" : "falhou"))
      .catch(() => setEstado("falhou"));
  }, [t]);

  async function voltarAReceber() {
    if (!t) return;
    setOcupado(true);
    try {
      const r = await reinscreverLeadQuiz({ data: { token: t } });
      setEstado(r.ok ? "voltou" : "falhou");
    } catch {
      setEstado("falhou");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="polia-v3 flex min-h-screen flex-col bg-white text-[var(--ink)]">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto flex max-w-[640px] items-center px-6 py-5">
          <PoliaWordmark className="h-6 w-auto" />
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 py-10 md:py-16">
        <div className="w-full max-w-[560px]">
          {estado === "processando" && (
            <p className="text-[17px] leading-[1.5] text-[var(--ink-soft)]">Tirando da lista…</p>
          )}

          {estado === "saiu" && (
            <div>
              <h1 className="font-cabinet text-[28px] leading-[1.15] tracking-[-0.02em] md:text-[32px]">
                Pronto, sem mais e-mails
              </h1>
              <p className="mt-4 text-[17px] leading-[1.5] text-[var(--ink-soft)]">
                Esse endereço saiu da lista da Pólia. O diagnóstico que já chegou continua na sua
                caixa.
              </p>
              <p className="mt-6 text-[15px] leading-[1.5] text-[var(--muted)]">
                Clicou sem querer?
              </p>
              <button
                type="button"
                onClick={voltarAReceber}
                disabled={ocupado}
                className="mt-2 rounded-xl border border-[var(--line)] px-6 py-3 text-[16px] font-semibold transition-colors hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {ocupado ? "Voltando…" : "Voltar a receber"}
              </button>
            </div>
          )}

          {estado === "voltou" && (
            <div>
              <h1 className="font-cabinet text-[28px] leading-[1.15] tracking-[-0.02em] md:text-[32px]">
                De volta à lista
              </h1>
              <p className="mt-4 text-[17px] leading-[1.5] text-[var(--ink-soft)]">
                Esse endereço volta a receber os e-mails da Pólia. Pra sair de novo, o link do
                rodapé continua valendo.
              </p>
            </div>
          )}

          {estado === "falhou" && (
            <div>
              <h1 className="font-cabinet text-[28px] leading-[1.15] tracking-[-0.02em] md:text-[32px]">
                Esse link não funcionou
              </h1>
              <p className="mt-4 text-[17px] leading-[1.5] text-[var(--ink-soft)]">
                Pode ter vindo cortado pelo programa de e-mail. Abra o link direto do rodapé da
                mensagem, ou escreva pra oi@usepolia.com.br que a gente tira na mão.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
