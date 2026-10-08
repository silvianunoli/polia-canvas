import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { toastErro } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { linkCanonico } from "@/lib/seo";
import { FEATURES_GRATIS, TIERS_PAGOS, type TierPago } from "@/lib/planos";
import { iniciarCompraPublica } from "@/lib/compra-publica.functions";
import { campoDeBusca, lerOrigemCampanha, temOrigemCampanha } from "@/lib/origemCampanha";
import { useTurnstile } from "@/hooks/useTurnstile";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Reveal } from "@/components/site/Reveal";
import { FieldError } from "@/components/ui/FieldError";
import { CONTAINER, SECAO, BTN_PRIMARIO, BTN_CONTORNO, Eyebrow } from "@/components/site/Editorial";

type Ciclo = "mensal" | "anual";

// Na URL o plano usa o nome visível (premium/pro). controle/projete são só as
// chaves internas e não devem aparecer pra quem navega.
const PLANO_DA_URL: Record<"premium" | "pro", TierPago> = {
  premium: "controle",
  pro: "projete",
};

// origem e utm_* chegam do "Quero o Premium/Pro" das landings de campanha
// (/landing-a, /landing-b), pra compra carregar a landing de onde veio até o
// Stripe. Mesmo esquema tolerante do /auth/cadastro: nada aqui derruba a rota,
// e a allowlist de verdade é lerOrigemCampanha (repetida no servidor).
const searchSchema = z.object({
  plano: z.enum(["premium", "pro"]).optional().catch(undefined),
  // A landing tem toggle Mensal/Anual: o link chega com ?ciclo= e a tela já
  // abre no ciclo pedido. O cancel_url do Stripe também devolve com ele.
  ciclo: z.enum(["mensal", "anual"]).optional().catch(undefined),
  origem: campoDeBusca,
  utm_source: campoDeBusca,
  utm_medium: campoDeBusca,
  utm_campaign: campoDeBusca,
  utm_content: campoDeBusca,
  utm_term: campoDeBusca,
});

export const Route = createFileRoute("/planos")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Planos · Pólia" },
      {
        name: "description",
        content:
          "Grátis, Premium ou Pro. Escolha o plano, pague e receba por e-mail o link para entrar na Pólia. Cancele quando quiser.",
      },
      { property: "og:title", content: "Planos · Pólia" },
      {
        property: "og:description",
        content:
          "Grátis, Premium ou Pro. Escolha o plano, pague e receba por e-mail o link para entrar na Pólia.",
      },
    ],
    links: [linkCanonico("/planos")],
  }),
  component: PlanosPage,
});

function fmtPreco(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: v % 1 ? 2 : 0 })}`;
}

const campoBase =
  "w-full rounded-xl border bg-white px-4 py-3 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:ring-4";
const campoOk =
  "border-[var(--line)] focus:border-[var(--secondary)] focus:ring-[var(--secondary-light)]";
const campoErro = "border-[var(--danger)] focus:border-[var(--danger)]";

function PlanosPage() {
  const search = Route.useSearch();
  const origemCampanha = useMemo(() => lerOrigemCampanha(search), [search]);
  // Só pro analytics: o checkout recebe o objeto inteiro e revalida.
  const origemTrack = temOrigemCampanha(origemCampanha) ? origemCampanha : {};
  const [ciclo, setCiclo] = useState<Ciclo>(search.ciclo ?? "mensal");
  // O Premium já vem escolhido: o formulário de pagamento sempre tem um plano
  // de verdade na frente, e o Turnstile monta uma vez só.
  const [escolhido, setEscolhido] = useState<TierPago>(
    search.plano ? PLANO_DA_URL[search.plano] : "controle",
  );
  const [email, setEmail] = useState("");
  const [emailErro, setEmailErro] = useState<string | undefined>();
  const [jaAssina, setJaAssina] = useState(false);
  // Honeypot: campo invisível fora do fluxo de teclado. Humano nunca preenche.
  const [hp, setHp] = useState("");
  const [loading, setLoading] = useState(false);
  const turnstile = useTurnstile();
  const emailRef = useRef<HTMLInputElement>(null);

  const tier = TIERS_PAGOS[escolhido];
  // Só mostra a confirmação quando o e-mail tem cara de e-mail completo.
  const emailDigitado = email.trim().toLowerCase();
  const emailParaConfirmar = z.string().email().safeParse(emailDigitado).success
    ? emailDigitado
    : null;
  const valor = ciclo === "mensal" ? tier.precoMensal : tier.precoAnual;
  const periodo = ciclo === "mensal" ? "por mês" : "por ano";

  function escolher(id: TierPago) {
    setEscolhido(id);
    track("planos_plano_escolhido", { plano: `${id}_${ciclo}`, ...origemTrack });
    document.getElementById("pagamento")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => emailRef.current?.focus({ preventScroll: true }), 500);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const valorEmail = email.trim();
    if (!valorEmail) {
      setEmailErro("Falta o seu e-mail.");
      emailRef.current?.focus();
      return;
    }
    if (!z.string().email().safeParse(valorEmail).success) {
      setEmailErro("E-mail inválido. Confere o @.");
      emailRef.current?.focus();
      return;
    }
    setEmailErro(undefined);

    // O token é de uso único e quem decide é o servidor (iniciarCompraPublica).
    // Aqui só checamos que existe, pra não gastar a chamada à toa.
    if (!turnstile.token) {
      toastErro(
        turnstile.erroCarregamento
          ? "A verificação anti-robô não carregou. Desative o bloqueador de anúncios e recarregue a página."
          : "Confirma que não é um robô antes de ir para o pagamento.",
      );
      return;
    }

    const plano = `${escolhido}_${ciclo}` as const;
    setLoading(true);
    try {
      const r = await iniciarCompraPublica({
        data: {
          email: valorEmail,
          plano,
          turnstileToken: turnstile.token,
          hp,
          ...(temOrigemCampanha(origemCampanha) ? { origemCampanha } : {}),
        },
      });
      if (r.url) {
        track("checkout_iniciado", {
          plano,
          session_id: r.sessionId ?? undefined,
          ...origemTrack,
        });
        // Redireciona e deixa o loading ligado: a página vai embora.
        window.location.assign(r.url);
        return;
      }
      turnstile.reset();
      if ("jaAssina" in r && r.jaAssina) {
        track("checkout_falhou", { plano, motivo: "ja_assina" });
        setEmailErro(r.error ?? undefined);
        setJaAssina(true);
        emailRef.current?.focus();
        setLoading(false);
        return;
      }
      track("checkout_falhou", { plano, motivo: "sem_url" });
      toastErro(r.error ?? "A Pólia não conseguiu abrir o checkout agora. Tenta de novo.");
    } catch {
      track("checkout_falhou", { plano, motivo: "excecao_client" });
      turnstile.reset();
      toastErro("A Pólia não conseguiu abrir o checkout agora. Tenta de novo.");
    }
    setLoading(false);
  }

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader />

      <main id="conteudo">
        <section className="pb-[clamp(32px,4vw,56px)] pt-[clamp(48px,7vw,96px)]">
          <div className={CONTAINER}>
            <Reveal>
              <Eyebrow>Planos</Eyebrow>
              <h1 className="mt-4 max-w-[20ch] text-[clamp(2.3rem,5vw,3.5rem)] font-bold leading-[1.06] tracking-[-0.02em] text-balance">
                Escolha o plano da sua marca.
              </h1>
              <p className="mt-5 max-w-[56ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                Pagou, a conta abre. A Pólia manda por e-mail o link para criar a senha e entrar.
                Cancelar é um clique, e o Planejamento continua seu.
              </p>
            </Reveal>

            {/* Ciclo mensal/anual */}
            <div
              role="group"
              aria-label="Ciclo de cobrança"
              className="mt-8 flex w-fit gap-0.5 rounded-lg border border-[var(--line)] bg-white p-[3px]"
            >
              {(
                [
                  { id: "mensal", label: "Mensal" },
                  { id: "anual", label: "Anual · 2 meses grátis" },
                ] as { id: Ciclo; label: string }[]
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCiclo(c.id)}
                  aria-pressed={ciclo === c.id}
                  className={`rounded-md px-4 py-2 text-[14px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] ${
                    ciclo === c.id
                      ? "bg-[var(--secondary)] text-[var(--secondary-ink)]"
                      : "text-[var(--ink-soft)]"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* GRÁTIS: conta sem cobrança, vai direto pro cadastro */}
              <div className="flex flex-col rounded-2xl border border-[var(--line)] bg-white p-6">
                <span aria-hidden="true" className="mb-2 inline-block h-[22px]" />
                <p className="text-[13px] font-semibold uppercase tracking-[1px] text-[var(--ink-soft)]">
                  Grátis
                </p>
                <p className="mt-1 font-cabinet text-[32px] leading-none">R$ 0</p>
                <p className="mt-1 text-[13px] text-[var(--muted)]">sem cobrança</p>
                <ul className="mt-4 space-y-2">
                  {FEATURES_GRATIS.map((f) => (
                    <li key={f} className="text-[14px] leading-snug text-[var(--ink-soft)]">
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-6">
                  <Link
                    to="/auth/cadastro"
                    data-track="cadastro_cta_clicado"
                    data-track-props='{"contexto":"planos_gratis"}'
                    className={`${BTN_CONTORNO} w-full`}
                  >
                    Criar conta grátis
                  </Link>
                </div>
              </div>

              {(Object.entries(TIERS_PAGOS) as [TierPago, (typeof TIERS_PAGOS)[TierPago]][]).map(
                ([id, t]) => {
                  const ativo = escolhido === id;
                  return (
                    <div
                      key={id}
                      className={`flex flex-col rounded-2xl border bg-white p-6 ${
                        ativo
                          ? "border-[var(--secondary)] ring-2 ring-[var(--secondary-light)]"
                          : "border-[var(--line)]"
                      }`}
                    >
                      {/* O selo existe só em alguns cartões; `invisible` guarda a
                          altura pra título e preço ficarem alinhados na linha que a
                          pessoa compara. */}
                      <span
                        aria-hidden={!t.destaque && !ativo}
                        className={`mb-2 inline-block w-fit rounded bg-[var(--secondary)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[1px] text-[var(--secondary-ink)] ${
                          t.destaque || ativo ? "" : "invisible"
                        }`}
                      >
                        {ativo ? "Escolhido" : "Melhor valor"}
                      </span>
                      <p className="text-[13px] font-semibold uppercase tracking-[1px] text-[var(--ink-soft)]">
                        {t.titulo}
                      </p>
                      <p className="mt-1 font-cabinet text-[32px] leading-none">
                        {fmtPreco(ciclo === "mensal" ? t.precoMensal : t.precoAnual)}
                      </p>
                      <p className="mt-1 text-[13px] text-[var(--muted)]">
                        {ciclo === "mensal" ? "por mês" : "por ano"}
                      </p>
                      <ul className="mt-4 space-y-2">
                        {t.features.map((f) => (
                          <li key={f} className="text-[14px] leading-snug text-[var(--ink-soft)]">
                            {f}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto pt-6">
                        <button
                          type="button"
                          onClick={() => escolher(id)}
                          aria-pressed={ativo}
                          className={`${ativo ? BTN_PRIMARIO : BTN_CONTORNO} w-full`}
                        >
                          {ativo ? `Seguir com o ${t.titulo}` : `Assinar o ${t.titulo}`}
                        </button>
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </section>

        {/* PAGAMENTO: só e-mail. A conta nasce depois que o pagamento entra. */}
        <section id="pagamento" className={`scroll-mt-[88px] bg-[var(--surface)] ${SECAO}`}>
          <div className={CONTAINER}>
            <div className="mx-auto max-w-[560px]">
              <Eyebrow>Pagamento</Eyebrow>
              <h2 className="mt-4 text-[clamp(1.6rem,3vw,2.2rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                {tier.titulo}, {fmtPreco(valor)} {periodo}.
              </h2>
              <p className="mt-3 text-[16px] leading-[1.6] text-[var(--ink-soft)]">
                Informe o e-mail em que a Pólia deve mandar o link de acesso. O pagamento é feito na
                página segura do Stripe.
              </p>

              <form
                onSubmit={handleSubmit}
                noValidate
                className="mt-6 grid gap-4 rounded-2xl border border-[var(--line)] bg-white p-6 md:p-8"
              >
                {/* Honeypot anti-spam: escondido de humanos e de leitores de tela. */}
                <input
                  type="text"
                  name="empresa_site"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={hp}
                  onChange={(e) => setHp(e.target.value)}
                  className="absolute left-[-9999px] h-0 w-0 opacity-0"
                />
                <div>
                  <label
                    htmlFor="email-compra"
                    className="mb-2 block text-[14px] font-semibold text-[var(--ink-soft)]"
                  >
                    Seu e-mail
                  </label>
                  <input
                    ref={emailRef}
                    id="email-compra"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="voce@email.com"
                    value={email}
                    disabled={loading}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailErro) setEmailErro(undefined);
                      if (jaAssina) setJaAssina(false);
                    }}
                    aria-invalid={!!emailErro || undefined}
                    aria-describedby={emailErro ? "email-compra-error" : undefined}
                    className={`${campoBase} ${emailErro ? campoErro : campoOk}`}
                  />
                  <FieldError id="email-compra-error">{emailErro}</FieldError>
                  {jaAssina && (
                    <Link
                      to="/auth/login"
                      search={{ email: email.trim(), next: "/configuracoes" }}
                      className="mt-1 inline-block text-[14px] font-semibold text-[var(--secondary-text)] underline underline-offset-2"
                    >
                      Entrar na conta
                    </Link>
                  )}
                </div>

                {/* E-mail digitado errado vira compra paga sem acesso: o link de
                    entrada vai pro endereço errado. A frase mostra, perto do
                    botão, pra onde o acesso vai (08/10/2026). */}
                {emailParaConfirmar && (
                  <p
                    aria-live="polite"
                    className="rounded-xl bg-[var(--surface)] px-4 py-3 text-[15px] leading-[1.5] text-[var(--ink)]"
                  >
                    A Pólia vai mandar o acesso pra{" "}
                    <strong className="break-all font-semibold">{emailParaConfirmar}</strong>. Confere
                    se está certo.
                  </p>
                )}

                <TurnstileWidget containerRef={turnstile.containerRef} />

                <button
                  type="submit"
                  disabled={loading}
                  className={`${BTN_PRIMARIO} w-full disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {loading ? "Abrindo o pagamento…" : "Ir para o pagamento"}
                  {!loading && <span aria-hidden="true">→</span>}
                </button>
                <p className="text-[13px] leading-[1.5] text-[var(--muted)]">
                  Seguindo para o pagamento, você concorda com os{" "}
                  <Link to="/termos" className="text-[var(--ink-soft)] underline">
                    Termos de uso
                  </Link>{" "}
                  e a{" "}
                  <Link to="/privacidade" className="text-[var(--ink-soft)] underline">
                    Política de Privacidade
                  </Link>
                  .
                </p>
              </form>

              <p className="mt-6 text-[14px] leading-[1.6] text-[var(--ink-soft)]">
                Já tem conta?{" "}
                <Link to="/auth/login" className="text-[var(--ink)] underline">
                  Entrar
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
