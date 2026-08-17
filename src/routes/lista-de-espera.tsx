import { createFileRoute, Link } from "@tanstack/react-router";
import { linkCanonico } from "@/lib/seo";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { ArrowUp } from "lucide-react";
import { toastErro } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { useTurnstile, TurnstileWidget } from "@/components/TurnstileWidget";
import { entrarListaEspera } from "@/lib/lista-espera.functions";
import { SiteHeader } from "@/components/site/SiteHeader";
import { FieldError } from "@/components/ui/FieldError";
import { Reveal, RevealGroup, RevealItem } from "@/components/site/Reveal";
import { HighlightWord } from "@/components/site/HighlightWord";
import {
  CONTAINER,
  SECAO,
  BTN_PRIMARIO,
  BTN_CONTORNO,
  Eyebrow,
  Pullquote,
} from "@/components/site/Editorial";

export const Route = createFileRoute("/lista-de-espera")({
  head: () => ({
    meta: [
      { title: "Entrar na lista · Pólia" },
      {
        name: "description",
        content:
          "A Pólia mostra se o seu negócio dá lucro e quanto sobra em cada venda. Abre em outubro: entre na lista.",
      },
      { property: "og:title", content: "Entrar na lista · Pólia" },
      {
        property: "og:description",
        content:
          "A Pólia mostra se o seu negócio dá lucro e quanto sobra em cada venda. Abre em outubro: entre na lista.",
      },
    ],
    links: [linkCanonico("/lista-de-espera")],
  }),
  component: ListaEsperaPage,
});

const BENEFICIOS = [
  {
    titulo: "Saber se o negócio dá lucro",
    desc: "Dá pra saber se o negócio dá lucro, ver quanto sobra em cada venda e parar de cobrar no chute. Depois fica claro quem a sua marca atende e por que ela vale o preço que cobra.",
  },
  {
    titulo: "Um preço que fecha a conta",
    desc: "Aparece quanto custa cada produto, por quanto vender e o que sobra em cada venda. Chega de chutar.",
  },
  {
    titulo: "A semana organizada num lugar",
    desc: "Um quadro simples pra organizar o que precisa sair, ligado à meta já definida. Nada se perde no caminho.",
  },
  {
    titulo: "A venda que vira caixa sozinha",
    desc: "Marcou que entregou pro cliente, o dinheiro entra no caixa na hora. Sem lançar de novo, sem planilha perdida.",
  },
  {
    titulo: "Saber quanto sobra de verdade",
    desc: "No fim do mês, aparece o que entrou, o que saiu e o que sobrou. Sem susto no extrato.",
  },
  {
    titulo: "Saber se vai bater a meta",
    desc: "Durante o mês já aparece se a meta está no caminho. Sobra tempo de ajustar antes de fechar.",
  },
];

const PRA_QUEM = [
  "Tem um negócio, ou a vontade de começar um, e se perde na hora de organizar.",
  "Já vende, mas nunca tem certeza se sobra dinheiro no fim do mês.",
  "Cobra no chute e trava quando perguntam como chegou naquele preço.",
  "Quer tocar o próprio negócio com mais clareza e menos achismo.",
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
  const [aceite, setAceite] = useState(false);
  const [aceiteErro, setAceiteErro] = useState(false);
  const [errors, setErrors] = useState<{ nome?: string; email?: string }>({});
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  // Honeypot: campo invisível fora do fluxo de teclado. Humano nunca preenche; bot que
  // preenche tudo, sim. Se vier preenchido, finge sucesso e não insere nada.
  const [hp, setHp] = useState("");
  const [mostrarTopo, setMostrarTopo] = useState(false);
  const turnstile = useTurnstile();
  const nomeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Botão flutuante "voltar ao topo": aparece depois de rolar e leva de volta ao
  // formulário, que é a única ação da página.
  useEffect(() => {
    const onScroll = () => setMostrarTopo(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
          tipo_negocio: null,
          // O aceite agora cobre o aviso de abertura, que é a razão da lista.
          novidades: true,
          turnstileToken: turnstile.token,
        },
      });
      if (resultado.ok) {
        if (resultado.jaEstava) toastErro("Esse e-mail já está na lista. Já está dentro.");
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

  // Campo de texto: o contorno vira vermelho no erro e turquesa no foco. Mesma
  // base pros dois inputs, pra não divergirem.
  const campoBase =
    "w-full rounded-xl border bg-white px-4 py-3 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:ring-4";
  const campoOk =
    "border-[var(--line)] focus:border-[var(--secondary)] focus:ring-[var(--secondary-light)]";
  const campoErro = "border-[var(--danger)] focus:border-[var(--danger)]";

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <SiteHeader semLogin />

      <main>
        {/* 1. HERO + FORMULÁRIO */}
        <section className="pb-[clamp(48px,6vw,72px)] pt-[clamp(48px,7vw,96px)]">
          <div className={CONTAINER}>
            <div className="grid grid-cols-1 items-start gap-[clamp(32px,5vw,64px)] md:grid-cols-[0.95fr_1.05fr]">
              <div className="md:pt-2">
                <Reveal>
                  <Eyebrow>Abre em outubro</Eyebrow>
                </Reveal>
                {/* Data concreta em vez de "em breve": a página deixa de falar de
                    produto incompleto e passa a falar de porta com hora pra abrir. */}
                <h1 className="mt-4 text-[clamp(2.3rem,5vw,3.5rem)] font-bold leading-[1.06] tracking-[-0.02em] text-balance">
                  A Pólia mostra <HighlightWord delay={0.3}>quanto sobra</HighlightWord> em cada
                  venda. Abre em outubro.
                </h1>
                <Reveal delay={0.1}>
                  <p className="mt-6 max-w-[54ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                    A Pólia junta o que hoje está espalhado entre a calculadora do celular, o
                    caderninho e a memória: quanto custa cada produto, por quanto vender e o que
                    sobra no fim do mês. Depois ajuda a construir a marca que sustenta esse preço.
                    Deixe seu e-mail e eu te aviso assim que abrir, antes de todo mundo.
                  </p>
                </Reveal>
              </div>

              {/* FORMULÁRIO (única ação da página) */}
              <Reveal delay={0.15} y={28}>
                {!enviado ? (
                  <form
                    onSubmit={handleSubmit}
                    className="grid gap-4 rounded-2xl border border-[var(--line)] bg-white p-6 md:p-8"
                    noValidate
                  >
                    <p className="text-[15px] font-semibold text-[var(--ink)]">
                      Deixe seu e-mail. Quem está na lista entra primeiro.
                    </p>
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
                        placeholder="Como te chamar?"
                        value={nome}
                        onChange={(e) => {
                          setNome(e.target.value);
                          if (errors.nome) setErrors((er) => ({ ...er, nome: undefined }));
                        }}
                        aria-invalid={!!errors.nome || undefined}
                        aria-describedby={errors.nome ? "nome-error" : undefined}
                        className={`${campoBase} ${errors.nome ? campoErro : campoOk}`}
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
                        className={`${campoBase} ${errors.email ? campoErro : campoOk}`}
                      />
                      <FieldError id="email-error">{errors.email}</FieldError>
                    </div>
                    {/* O select "o que mais trava" saiu: eram cinco opções pra ler
                        antes do botão, três delas de produtividade genérica, e nada
                        voltava pra quem respondia. O consentimento de novidades saiu
                        junto e foi consolidado no aceite abaixo. */}
                    <div className="mt-1 grid gap-3">
                      <label className="flex cursor-pointer items-start gap-3 text-[14px] text-[var(--ink-soft)]">
                        <input
                          type="checkbox"
                          checked={aceite}
                          onChange={(e) => {
                            setAceite(e.target.checked);
                            if (e.target.checked) setAceiteErro(false);
                          }}
                          aria-invalid={aceiteErro || undefined}
                          aria-describedby={aceiteErro ? "aceite-error" : undefined}
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
                        , e quero ser avisada quando a Pólia abrir.
                      </label>
                    </div>

                    {aceiteErro && (
                      <p
                        id="aceite-error"
                        role="alert"
                        className="text-[13px] text-[var(--danger)]"
                      >
                        Pra continuar, falta aceitar os termos.
                      </p>
                    )}

                    <TurnstileWidget containerRef={turnstile.containerRef} />
                    <button
                      type="submit"
                      disabled={loading}
                      className={`${BTN_PRIMARIO} w-full disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {loading ? "Enviando…" : "Entrar na lista"}
                    </button>
                    <p className="text-[13px] text-[var(--muted)]">
                      Sem cobrança e sem spam, e dá pra sair da lista quando quiser.
                    </p>
                  </form>
                ) : (
                  <div
                    className="rounded-2xl bg-[var(--surface-pink)] p-8"
                    role="status"
                    aria-live="polite"
                  >
                    <h2 className="max-w-[20ch] text-[clamp(1.4rem,2.4vw,1.75rem)] font-bold leading-[1.15] tracking-[-0.02em] text-balance">
                      Pronto. Seu e-mail está na lista.
                    </h2>
                    <p className="mt-3 max-w-[48ch] leading-[1.65] text-[var(--ink-soft)]">
                      Em outubro, o convite chega antes de todo mundo. Pode fechar essa página
                      tranquila.
                    </p>
                  </div>
                )}
              </Reveal>
            </div>
          </div>
        </section>

        {/* 2. O PROBLEMA (empatia primeiro) */}
        <section className={`bg-[var(--surface)] ${SECAO}`}>
          <div className={CONTAINER}>
            <Reveal className="max-w-[62ch]">
              <Eyebrow>No fim do mês</Eyebrow>
              <h2 className="mt-4 text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                Vende, se esforça, faz acontecer.
              </h2>
            </Reveal>

            <Reveal delay={0.1} className="mt-[clamp(32px,4vw,48px)]">
              <Pullquote tom="pessego">
                No fim do mês bate a dúvida: será que sobrou mesmo alguma coisa?
              </Pullquote>
            </Reveal>

            <Reveal className="mt-[clamp(32px,4vw,48px)]">
              <p className="max-w-[62ch] text-[17px] leading-[1.7] text-[var(--ink-soft)]">
                O preço saiu meio no chute. O dinheiro do negócio se mistura com o seu. E organizar
                isso tudo parece dar mais trabalho do que ajuda. Não é falta de esforço. É que
                ninguém junta esses números por você.
              </p>
            </Reveal>
          </div>
        </section>

        {/* 3. QUEM ESTÁ CONSTRUINDO (a Sil, em 1ª pessoa) */}
        <section className={SECAO}>
          <div className={CONTAINER}>
            <Reveal>
              <div className="rounded-2xl border border-[var(--line)] bg-white p-8 md:p-12">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_1.6fr] md:gap-16">
                  <div>
                    <Eyebrow>Quem fez</Eyebrow>
                    <p className="mt-4 text-[clamp(1.3rem,2vw,1.6rem)] font-bold leading-[1.2] tracking-[-0.02em]">
                      Oi, eu sou a Sil.
                    </p>
                  </div>
                  <div>
                    <p className="max-w-[58ch] text-[17px] leading-[1.65] text-[var(--ink)]">
                      São 14 anos de e-commerce: oito à frente do meu próprio negócio, um tempo
                      dentro de grandes marcas, como C&amp;A, Allied e Arcelor Mittal, e muita
                      consultoria pra pequenas empreendedoras. E vi sempre a mesma coisa: dá pra
                      vender bem e mesmo assim não saber se o negócio dá lucro.
                    </p>
                    <p className="mt-4 max-w-[58ch] text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                      Eu vivi isso na pele. Por isso fiz a Pólia, a ferramenta que eu queria ter
                      tido. Sem planilha perdida, sem fórmula mágica, e sem tratar quem toca o
                      negócio como se não entendesse dele.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 4. O QUE A PÓLIA VAI FAZER */}
        <section className={`bg-[var(--surface)] ${SECAO}`}>
          <div className={CONTAINER}>
            <Reveal className="max-w-[56ch]">
              <Eyebrow>O que vem aí</Eyebrow>
              <h2 className="mt-4 text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                O que a Pólia vai fazer por você
              </h2>
              <p className="mt-4 text-[17px] leading-[1.65] text-[var(--ink-soft)]">
                Primeiro o número aparece: quanto custa, por quanto vender e o que sobra. Com isso
                na mão, a marca entra pra sustentar o preço que o negócio cobra.
              </p>
            </Reveal>

            <RevealGroup className="mt-[clamp(40px,5vw,56px)] grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
              {BENEFICIOS.map((b, i) => (
                <RevealItem
                  key={b.titulo}
                  className="flex gap-4 border-t border-[var(--line)] pt-5"
                >
                  <span className="font-cabinet text-[22px] leading-none text-[var(--secondary-text)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-[18px] font-bold tracking-[-0.01em]">{b.titulo}</h3>
                    <p className="mt-2 text-[15px] leading-[1.6] text-[var(--ink-soft)]">
                      {b.desc}
                    </p>
                  </div>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </section>

        {/* 5. PRA QUEM É */}
        <section className={SECAO}>
          <div className={CONTAINER}>
            <Reveal>
              <Eyebrow>Pra quem é</Eyebrow>
              <h2 className="mt-4 text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                A Pólia é pra quem
              </h2>
            </Reveal>

            <Reveal delay={0.1} className="mt-[clamp(32px,4vw,40px)]">
              <ul className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2">
                {PRA_QUEM.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 rounded-2xl border border-[var(--line)] bg-white p-6 text-[16px] leading-[1.6] text-[var(--ink-soft)]"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-2 block h-[8px] w-[8px] flex-none rounded-full bg-[var(--secondary)]"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="polia-v3 border-t border-[var(--line)] py-8">
        <div
          className={`${CONTAINER} flex flex-wrap items-center justify-between gap-3 text-[13px] text-[var(--muted)]`}
        >
          <span>© 2026 Pólia · CNPJ: 18.305.925/0001-06</span>
          <span>Desenvolvido por Prismia Soluções Digitais</span>
        </div>
      </footer>

      {mostrarTopo && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className={`${BTN_CONTORNO} fixed bottom-6 right-6 z-50 bg-white`}
        >
          <ArrowUp size={18} aria-hidden="true" />
          Voltar ao formulário
        </button>
      )}
    </div>
  );
}
