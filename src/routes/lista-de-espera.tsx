import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { toastErro } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { useTurnstile, TurnstileWidget } from "@/components/TurnstileWidget";
import { entrarListaEspera } from "@/lib/lista-espera.functions";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FieldError } from "@/components/ui/FieldError";

export const Route = createFileRoute("/lista-de-espera")({
  head: () => ({
    meta: [
      { title: "Entrar na lista · Pólia" },
      {
        name: "description",
        content:
          "A Pólia está abrindo aos poucos. Entre na lista e seja das primeiras a construir a sua marca com a gente, uma etapa de cada vez, no seu tempo.",
      },
      { property: "og:title", content: "Entrar na lista · Pólia" },
      {
        property: "og:description",
        content: "Fique sabendo primeiro quando a Pólia abrir.",
      },
    ],
  }),
  component: ListaEsperaPage,
});

const PASSOS = [
  "Entra na lista",
  "A gente te avisa quando abrir",
  "Fecha a primeira etapa",
];

const RAZOES = [
  {
    forte: "Fica sabendo primeiro.",
    resto: " Assim que a Pólia abrir, quem está na lista é avisada entre as primeiras.",
  },
  {
    forte: "Entre as primeiras.",
    resto: " Acesso à Pólia antes da abertura pra todo mundo.",
  },
  {
    forte: "Ajuda a construir.",
    resto: " A gente pergunta o que fazer primeiro, e o que trava vira prioridade.",
  },
  {
    forte: "Sem compromisso.",
    resto: " Entrar não custa nada, e dá pra sair da lista quando quiser.",
  },
];

function validarNome(v: string): string | undefined {
  return v.trim().length < 2 ? "Falta o seu nome." : undefined;
}

function validarEmail(v: string): string | undefined {
  if (!v.trim()) return "Falta o seu e-mail.";
  return z.string().email().safeParse(v.trim()).success
    ? undefined
    : "E-mail inválido. Confere o @.";
}

function ListaEsperaPage() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [trava, setTrava] = useState("");
  const [aceite, setAceite] = useState(false);
  const [novidades, setNovidades] = useState(false);
  const [aceiteErro, setAceiteErro] = useState(false);
  const [errors, setErrors] = useState<{ nome?: string; email?: string }>({});
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  // Honeypot: campo invisível fora do fluxo de teclado. Humano nunca preenche; bot que
  // preenche tudo, sim. Se vier preenchido, finge sucesso e não insere nada.
  const [hp, setHp] = useState("");
  const turnstile = useTurnstile();
  const nomeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Bot preencheu o honeypot: mostra "enviado" e descarta em silêncio, sem gravar.
    if (hp) {
      setEnviado(true);
      return;
    }
    const nomeErro = validarNome(nome);
    const emailErro = validarEmail(email);
    if (nomeErro || emailErro) {
      setErrors({ nome: nomeErro, email: emailErro });
      (nomeErro ? nomeRef : emailRef).current?.focus();
      return;
    }
    setErrors({});
    if (!aceite) {
      setAceiteErro(true);
      return;
    }
    setAceiteErro(false);
    setLoading(true);

    // O Turnstile é validado no servidor (dentro de entrarListaEspera). O token
    // é uso único, então aqui só checamos que existe.
    if (!turnstile.token) {
      toastErro("Confirma que não é um robô antes de entrar na lista.");
      setLoading(false);
      return;
    }

    try {
      const resultado = await entrarListaEspera({
        data: {
          nome: nome.trim(),
          email: email.trim(),
          tipo_negocio: trava || null,
          turnstileToken: turnstile.token,
        },
      });
      if (resultado.ok) {
        if (resultado.jaEstava) toastErro("Esse email já está na lista. Já está dentro.");
        track("lista_espera_enviada", { ja_estava: resultado.jaEstava });
        setEnviado(true);
      } else {
        track("lista_espera_falhou", { motivo: "resultado_nao_ok" });
        turnstile.reset();
        toastErro("Não deu pra entrar agora. Tenta de novo em alguns minutos.");
      }
    } catch {
      track("lista_espera_falhou", { motivo: "excecao_client" });
      turnstile.reset();
      toastErro("Não deu pra entrar agora. Tenta de novo em alguns minutos.");
    }
    setLoading(false);
  }

  return (
    <div className="polia-v3 min-h-screen bg-white text-[var(--ink)]">
      <SiteHeader />

      <main>
        <section className="pb-16 pt-16 md:pb-24 md:pt-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[1.1fr_0.9fr] md:gap-16">
              <div>
                <span className="inline-flex rounded-sm bg-[var(--highlight)] px-3 py-1 text-[13px] font-semibold text-[var(--highlight-ink)]">
                  Vagas limitadas
                </span>
                <h1 className="font-cabinet mt-4 text-[40px] leading-[1.05] tracking-[-0.02em] text-[var(--ink)] md:text-[56px]">
                  A Pólia está abrindo aos poucos. Fique sabendo primeiro.
                </h1>
                <p className="mt-6 max-w-[60ch] text-[20px] leading-[1.5] text-[var(--ink-soft)] md:text-[22px]">
                  Estamos abrindo pra poucas pessoas por vez, pra cuidar de cada uma direito. Entre
                  na lista e seja uma das primeiras a saber quando a Pólia abrir.
                </p>

                <div className="mt-6 flex flex-wrap gap-4">
                  {PASSOS.map((passo, i) => (
                    <span
                      key={passo}
                      className="flex items-center gap-2 text-[14px] text-[var(--ink-soft)]"
                    >
                      <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-[var(--secondary-light)] text-[12px] font-bold text-[var(--secondary-ink)]">
                        {i + 1}
                      </span>
                      {passo}
                    </span>
                  ))}
                </div>

                {!enviado ? (
                  <form onSubmit={handleSubmit} className="mt-8 grid gap-4" noValidate>
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
                        htmlFor="nome"
                        className="mb-2 block text-[14px] font-semibold text-[var(--ink-soft)]"
                      >
                        Seu nome
                      </label>
                      <input
                        ref={nomeRef}
                        id="nome"
                        name="nome"
                        type="text"
                        autoComplete="name"
                        placeholder="Como podemos te chamar?"
                        value={nome}
                        onChange={(e) => {
                          setNome(e.target.value);
                          if (errors.nome) setErrors((er) => ({ ...er, nome: undefined }));
                        }}
                        aria-invalid={!!errors.nome || undefined}
                        aria-describedby={errors.nome ? "nome-error" : undefined}
                        className={`w-full rounded-lg border bg-white px-4 py-3 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:ring-4 ${
                          errors.nome
                            ? "border-[var(--danger)] focus:border-[var(--danger)]"
                            : "border-[var(--line)] focus:border-[var(--secondary)] focus:ring-[var(--secondary-light)]"
                        }`}
                      />
                      <FieldError id="nome-error">{errors.nome}</FieldError>
                    </div>
                    <div>
                      <label
                        htmlFor="email"
                        className="mb-2 block text-[14px] font-semibold text-[var(--ink-soft)]"
                      >
                        Seu e-mail
                      </label>
                      <input
                        ref={emailRef}
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="voce@email.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) setErrors((er) => ({ ...er, email: undefined }));
                        }}
                        aria-invalid={!!errors.email || undefined}
                        aria-describedby={errors.email ? "email-error" : undefined}
                        className={`w-full rounded-lg border bg-white px-4 py-3 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:ring-4 ${
                          errors.email
                            ? "border-[var(--danger)] focus:border-[var(--danger)]"
                            : "border-[var(--line)] focus:border-[var(--secondary)] focus:ring-[var(--secondary-light)]"
                        }`}
                      />
                      <FieldError id="email-error">{errors.email}</FieldError>
                    </div>
                    <div>
                      <label
                        htmlFor="trava"
                        className="mb-2 block text-[14px] font-semibold text-[var(--ink-soft)]"
                      >
                        O que mais trava a sua marca hoje?{" "}
                        <span className="text-[var(--muted)]">(opcional)</span>
                      </label>
                      <select
                        id="trava"
                        name="trava"
                        value={trava}
                        onChange={(e) => setTrava(e.target.value)}
                        className="w-full rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-[16px] text-[var(--ink)] outline-none focus:border-[var(--secondary)] focus:ring-4 focus:ring-[var(--secondary-light)]"
                      >
                        <option value="">Escolha uma</option>
                        <option>Começo e paro no meio</option>
                        <option>Não sei o que fazer primeiro</option>
                        <option>Preço e números me travam</option>
                        <option>Falta tempo no dia</option>
                        <option>Outra coisa</option>
                      </select>
                    </div>

                    <div className="mt-1 grid gap-3">
                      <label className="flex cursor-pointer items-start gap-3 text-[14px] text-[var(--ink-soft)]">
                        <input
                          type="checkbox"
                          checked={aceite}
                          onChange={(e) => {
                            setAceite(e.target.checked);
                            if (e.target.checked) setAceiteErro(false);
                          }}
                          className="mt-[2px] h-[18px] w-[18px] flex-none accent-[var(--secondary)]"
                        />
                        Li e aceito os{" "}
                        <Link
                          to="/termos"
                          className="text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]"
                        >
                          Termos de uso
                        </Link>{" "}
                        e a{" "}
                        <Link
                          to="/privacidade"
                          className="text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]"
                        >
                          Política de Privacidade
                        </Link>
                        .
                      </label>
                      <label className="flex cursor-pointer items-start gap-3 text-[14px] text-[var(--ink-soft)]">
                        <input
                          type="checkbox"
                          checked={novidades}
                          onChange={(e) => setNovidades(e.target.checked)}
                          className="mt-[2px] h-[18px] w-[18px] flex-none accent-[var(--secondary)]"
                        />
                        Quero receber novidades da Pólia por e-mail.
                      </label>
                    </div>

                    {aceiteErro && (
                      <p className="text-[13px] text-[var(--danger)]">
                        Pra entrar na lista, falta aceitar os termos.
                      </p>
                    )}

                    <TurnstileWidget containerRef={turnstile.containerRef} />
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-lg bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] transition-[filter] hover:brightness-95 disabled:opacity-60"
                    >
                      {loading ? "Entrando…" : "Entrar na lista"}
                    </button>
                    <p className="text-[13px] text-[var(--muted)]">
                      Sem spam. A gente escreve só pra avisar quando abrir. Dá pra sair quando quiser.
                    </p>
                  </form>
                ) : (
                  <div
                    className="mt-8 rounded-xl bg-[var(--surface-pink)] p-8"
                    role="status"
                    aria-live="polite"
                  >
                    <h2 className="max-w-[20ch] text-[24px] text-[var(--ink)]">
                      Pronto. Nome na lista.
                    </h2>
                    <p className="mt-3 max-w-[48ch] text-[var(--ink-soft)]">
                      A gente te avisa assim que a Pólia abrir. Sem enfeite. Enquanto isso, dá pra
                      conhecer melhor a Pólia.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        to="/sobre"
                        hash="manifesto"
                        className="rounded-lg border border-[var(--ink)] px-6 py-3 text-[15px] font-semibold text-[var(--ink)] no-underline transition-colors hover:bg-[var(--ink)] hover:text-white"
                      >
                        Ler o manifesto
                      </Link>
                      <Link
                        to="/"
                        hash="como-funciona"
                        className="rounded-lg border border-[var(--ink)] px-6 py-3 text-[15px] font-semibold text-[var(--ink)] no-underline transition-colors hover:bg-[var(--ink)] hover:text-white"
                      >
                        Ver como funciona
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <aside className="rounded-xl border border-[var(--line)] bg-white p-8">
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                  Por que entrar na lista
                </p>
                <ul className="mt-4 list-none">
                  {RAZOES.map((r) => (
                    <li key={r.forte} className="relative mt-3 pl-6 text-[var(--ink-soft)]">
                      <span className="absolute left-0 top-[7px] h-[10px] w-[10px] rounded-[2px] bg-[var(--accent)]" />
                      <strong className="text-[var(--ink)]">{r.forte}</strong>
                      {r.resto}
                    </li>
                  ))}
                </ul>
                <hr className="my-6 h-px border-0 bg-[var(--line)]" />
                <p className="text-[14px] text-[var(--ink-soft)]">
                  A Pólia te ajuda a tocar a sua marca sozinha: uma etapa de cada vez, no seu tempo,
                  com alguém do lado apontando o próximo passo.{" "}
                  <Link
                    to="/sobre"
                    className="text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]"
                  >
                    Conhecer a Pólia
                  </Link>
                  .
                </p>
              </aside>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
