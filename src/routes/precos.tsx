import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FieldError } from "@/components/ui/FieldError";
import { iniciarCompraPublica } from "@/lib/compra-publica.functions";
import { track } from "@/lib/analytics";

const VALOR_PLANO_MENSAL = 29;
const VALOR_PLANO_ANUAL = 290;

export const Route = createFileRoute("/precos")({
  head: () => ({
    meta: [
      { title: "Preços · Pólia" },
      {
        name: "description",
        content:
          "Um plano só, do tamanho de uma pessoa só. Sem feature de equipe sem uso, sem pegadinha. Cancela quando quiser.",
      },
      { property: "og:title", content: "Preços · Pólia" },
      { property: "og:description", content: "Preço de uma pessoa só." },
    ],
  }),
  component: PrecosPage,
});

const beneficios = [
  "Continua de onde parou, sem recomeçar do zero",
  "Cada dia fecha com uma coisa da marca realmente feita",
  "A Aimer lê o seu momento e aponta a próxima etapa certa",
  "Feita pra uma pessoa só: um plano, sem assento extra nem time",
  "Seus números claros, o que entrou e o que saiu, sem planilha",
  "Progresso medido por avanço, etapa por etapa, não por dias seguidos",
];

const faqs = [
  {
    pergunta: "Tem período grátis?",
    resposta: (
      <>
        Vai ter. O formato exato a gente ajusta com quem está usando.{" "}
        <span className="rounded-[3px] bg-[var(--highlight)] px-1.5 font-semibold text-[var(--highlight-ink)]">
          [Definir: trial de X dias ou plano grátis limitado]
        </span>
      </>
    ),
  },
  {
    pergunta: "Posso cancelar quando quiser?",
    resposta:
      "Sim, num clique, dentro do app. Sem ligar pra ninguém, sem “tem certeza?” três vezes. O acesso continua até o fim do ciclo já pago.",
  },
  {
    pergunta: "O preço pode mudar depois?",
    resposta:
      "Se um dia o preço geral subir, quem já assina mantém o valor que contratou enquanto ficar na Pólia. Sem surpresa no cartão.",
  },
  {
    pergunta: "Quais formas de pagamento?",
    resposta: (
      <>
        <span className="rounded-[3px] bg-[var(--highlight)] px-1.5 font-semibold text-[var(--highlight-ink)]">
          [Preencher: cartão, Pix, boleto]
        </span>
        . A gente ajusta conforme o que faz sentido pra quem toca a marca sozinha no Brasil.
      </>
    ),
  },
];

function PrecosPage() {
  const [ciclo, setCiclo] = useState<"mensal" | "anual">("mensal");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const [comprando, setComprando] = useState(false);

  async function handleComprar(e: FormEvent) {
    e.preventDefault();
    const emailLimpo = email.trim();
    if (!emailLimpo || !z.string().email().safeParse(emailLimpo).success) {
      setErro("E-mail inválido. Confere o @.");
      return;
    }
    setErro(undefined);
    setComprando(true);
    try {
      const resultado = await iniciarCompraPublica({ data: { email: emailLimpo, plano: ciclo } });
      if (resultado.error || !resultado.url) {
        track("checkout_falhou", { motivo: resultado.error ?? "sem_url", plano: ciclo });
        setErro(resultado.error ?? "Não consegui abrir o checkout agora. Tenta de novo.");
        setComprando(false);
        return;
      }
      track("checkout_iniciado", { plano: ciclo, stripe_session_id: resultado.sessionId });
      window.location.href = resultado.url;
    } catch {
      track("checkout_falhou", { motivo: "excecao_client", plano: ciclo });
      setErro("Não consegui abrir o checkout agora. Tenta de novo.");
      setComprando(false);
    }
  }

  return (
    <div className="polia-v3 min-h-screen bg-white text-[var(--ink)]">
      <SiteHeader />

      <main>
        {/* HERO */}
        <section className="pb-12 pt-16 md:pb-16 md:pt-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
              Preços
            </p>
            <h1 className="font-fraunces mt-4 text-[40px] leading-[1.05] tracking-[-0.02em] text-[var(--ink)] md:text-[56px]">
              Preço de uma pessoa só.
            </h1>
            <p className="mt-6 max-w-[60ch] text-[20px] leading-[1.5] text-[var(--ink-soft)] md:text-[22px]">
              Um plano, sem escada de “básico, pro, empresa”. O time é uma pessoa só, cobrar como
              se fosse mais não faz sentido. Sem feature de equipe parada, sem pegadinha no
              rodapé.
            </p>
          </div>
        </section>

        {/* PLANO */}
        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-2 md:gap-16">
              {/* card */}
              <div className="max-w-[460px] rounded-xl border-2 border-[var(--secondary)] bg-white p-8">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-fraunces text-[24px] text-[var(--ink)]">Pólia completa</h2>
                  <div
                    role="group"
                    aria-label="Ciclo de cobrança"
                    className="inline-flex gap-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] p-1"
                  >
                    <button
                      type="button"
                      aria-pressed={ciclo === "mensal"}
                      onClick={() => setCiclo("mensal")}
                      className={`rounded-[4px] px-4 py-2 text-[14px] font-semibold transition-colors ${
                        ciclo === "mensal"
                          ? "bg-[var(--secondary-light)] text-[var(--secondary-ink)]"
                          : "text-[var(--ink-soft)]"
                      }`}
                    >
                      Mensal
                    </button>
                    <button
                      type="button"
                      aria-pressed={ciclo === "anual"}
                      onClick={() => setCiclo("anual")}
                      className={`rounded-[4px] px-4 py-2 text-[14px] font-semibold transition-colors ${
                        ciclo === "anual"
                          ? "bg-[var(--secondary-light)] text-[var(--secondary-ink)]"
                          : "text-[var(--ink-soft)]"
                      }`}
                    >
                      Anual
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex items-baseline gap-2">
                  <span className="font-fraunces text-[56px] leading-none tracking-[-0.02em] text-[var(--ink)]">
                    {ciclo === "mensal" ? `R$ ${VALOR_PLANO_MENSAL}` : `R$ ${VALOR_PLANO_ANUAL}`}
                  </span>
                  <span className="text-[var(--ink-soft)]">{ciclo === "mensal" ? "/mês" : "/ano"}</span>
                </div>

                <form onSubmit={handleComprar} className="mt-6" noValidate>
                  <label htmlFor="precos-email" className="mb-2 block text-[13px] font-semibold text-[var(--ink)]">
                    Seu e-mail
                  </label>
                  <input
                    id="precos-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (erro) setErro(undefined);
                    }}
                    maxLength={255}
                    placeholder="voce@seunegocio.com.br"
                    disabled={comprando}
                    aria-invalid={!!erro || undefined}
                    aria-describedby={erro ? "precos-email-error" : undefined}
                    className={`w-full rounded-lg border bg-white px-4 py-3 text-[15px] text-[var(--ink)] outline-none transition-colors disabled:opacity-60 ${
                      erro
                        ? "border-[var(--danger)] focus:border-[var(--danger)]"
                        : "border-[var(--line)] focus:border-[var(--secondary)]"
                    }`}
                  />
                  <FieldError id="precos-email-error">{erro}</FieldError>
                  <button
                    type="submit"
                    disabled={comprando}
                    className="mt-2 block w-full rounded-lg bg-[var(--secondary)] px-8 py-4 text-center text-[18px] font-semibold text-[var(--secondary-ink)] transition-[filter] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {comprando ? "Abrindo checkout..." : "Comprar"}
                  </button>
                </form>
                <p className="mt-3 text-center text-[14px] text-[var(--muted)]">
                  Sem fidelidade. Cancela quando quiser.
                </p>

                <hr className="my-8 border-t border-[var(--line)]" />

                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                  Tudo que a sua marca precisa
                </p>
                <ul className="mt-4 list-none">
                  {beneficios.map((item) => (
                    <li key={item} className="relative mt-3 pl-6 text-[var(--ink-soft)]">
                      <span className="absolute left-0 top-[10px] h-[10px] w-[10px] rounded-[2px] bg-[var(--accent)]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* coluna direita */}
              <div className="flex flex-col gap-8 pt-3">
                <div>
                  <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                    Por que um plano só
                  </p>
                  <h3 className="font-fraunces mt-3 text-[20px] text-[var(--ink)]">
                    Porque o time é uma pessoa só.
                  </h3>
                  <p className="mt-3 text-[var(--ink-soft)]">
                    Planos em escada existem pra vender função de equipe: permissão, assento
                    extra, painel de gestor. Pra quem toca tudo sozinha, isso só atrapalha. Um
                    plano, e ele te entrega tudo.
                  </p>
                </div>

                <div className="rounded-xl bg-[var(--surface-pink)] p-6">
                  <h3 className="font-fraunces text-[20px] text-[var(--ink)]">
                    Parou um tempo? A trilha continua no ritmo.
                  </h3>
                  <p className="mt-3 text-[var(--ink-soft)]">
                    A Pólia não apaga as etapas por inatividade. A etapa fica lá,
                    do jeito que foi deixada. Cancelar é num clique, sem ligação e sem sermão.
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--line)] bg-white p-6">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                    Tem equipe?
                  </p>
                  <h3 className="font-fraunces mt-2 text-[20px] text-[var(--ink)]">
                    Hoje a Pólia é pra uma pessoa só.
                  </h3>
                  <p className="mt-3 text-[var(--ink-soft)]">
                    Quem cresceu e quer gerir um time por aqui pode registrar o interesse. A
                    gente te dá um retorno quando isso existir.
                  </p>
                  <a
                    href="/contato?assunto=equipe"
                    className="mt-4 inline-flex rounded-lg border border-[var(--ink)] px-6 py-3 text-[16px] font-semibold text-[var(--ink)] no-underline transition-colors hover:bg-[var(--ink)] hover:text-white"
                  >
                    Registrar interesse
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[720px] px-6">
            <h2 className="font-fraunces mb-6 text-[24px] text-[var(--ink)] md:text-[30px]">
              Dúvidas sobre o plano
            </h2>
            {faqs.map((f) => (
              <div key={f.pergunta} className="border-t border-[var(--line)] py-6">
                <h3 className="font-fraunces text-[18px] text-[var(--ink)]">{f.pergunta}</h3>
                <p className="mt-2 text-[var(--ink-soft)]">{f.resposta}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[1120px] px-6 text-center">
            <h2 className="font-fraunces mx-auto max-w-[18ch] text-[32px] text-[var(--ink)] md:text-[40px]">
              Comece pela primeira etapa.
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  document.getElementById("precos-email")?.scrollIntoView({ behavior: "smooth", block: "center" });
                  document.getElementById("precos-email")?.focus();
                }}
                className="rounded-lg bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] transition-[filter] hover:brightness-95"
              >
                Começar
              </button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
