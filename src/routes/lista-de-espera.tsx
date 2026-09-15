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
          "A Pólia mostra se o seu negócio dá lucro e quanto sobra em cada venda. Será lançada em outubro: entre na lista pra ser uma das primeiras a usar.",
      },
      { property: "og:title", content: "Entrar na lista · Pólia" },
      {
        property: "og:description",
        content:
          "A Pólia mostra se o seu negócio dá lucro e quanto sobra em cada venda. Será lançada em outubro: entre na lista pra ser uma das primeiras a usar.",
      },
    ],
    links: [linkCanonico("/lista-de-espera")],
  }),
  component: ListaEsperaPage,
});

// Copy reescrita em 14/09/2026 pra quem nunca ouviu falar da Pólia. A página
// responde nesta ordem: o que é, que problema resolve, por que importa, o que
// faz, por que entrar agora e o que acontece depois. "Outubro" só aparece
// depois de dizer o que é a Pólia, e sempre colado ao lançamento dela.

const BENEFICIOS = [
  {
    titulo: "Saber se o negócio dá lucro",
    desc: "Veja quanto sobra em cada venda e pare de depender do chute para descobrir se a conta fecha.",
  },
  {
    titulo: "Um preço que fecha a conta",
    desc: "Saiba quanto custa cada produto, por quanto vender e o que sobra em cada venda.",
  },
  {
    titulo: "A semana organizada num lugar",
    desc: "Um quadro simples para organizar o que precisa sair, ligado às metas que você já definiu.",
  },
  {
    titulo: "A venda que vira caixa",
    desc: "Registre a venda e acompanhe o dinheiro entrando no caixa, sem lançar a mesma informação de novo.",
  },
  {
    titulo: "Saber quanto sobra de verdade",
    desc: "No fim do mês, veja o que entrou, o que saiu e o que realmente sobrou.",
  },
  {
    titulo: "Saber se vai bater a meta",
    desc: "Acompanhe durante o mês se a meta está no caminho e ajuste antes de chegar ao fim.",
  },
];

// A grade é de duas colunas, então são quatro cartões: os dois últimos pontos
// da copy (clareza sem achismo, sem virar especialista em planilha) viraram um.
const PRA_QUEM = [
  "Tem um negócio, ou está começando um, e quer entender melhor como a conta funciona.",
  "Já vende, mas chega ao fim do mês sem certeza de quanto realmente sobrou.",
  "Define preço olhando para a concorrência ou tentando descobrir quanto o cliente aceita pagar.",
  "Quer tocar o próprio negócio com mais clareza e menos achismo, sem precisar virar especialista em planilhas.",
];

const CENAS = [
  "Você vende.",
  "Corre atrás de cliente.",
  "Compra material.",
  "Paga conta.",
  "Dá desconto quando precisa fechar.",
];

const QUANDO_SABE = [
  "Você não precisa adivinhar se o preço está bom.",
  "Não precisa esperar o fim do mês para descobrir se sobrou.",
  "Não precisa olhar para o caixa e tentar entender sozinha o que aconteceu.",
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

  // Os botões espalhados pela página apontam todos pro mesmo formulário do topo.
  // Existe um formulário só de propósito: o Turnstile renderiza num container
  // único e o estado de envio é um, então duplicar o form duplicaria os dois.
  function irParaFormulario() {
    document.getElementById("lista")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!enviado) window.setTimeout(() => nomeRef.current?.focus({ preventScroll: true }), 500);
  }

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
                  <Eyebrow>Uma nova ferramenta para quem empreende</Eyebrow>
                </Reveal>
                {/* Quem chega aqui pode nunca ter ouvido falar da Pólia: a
                    pergunta abre, a Pólia se apresenta, e só então entra a data. */}
                <h1 className="mt-4 text-[clamp(2.3rem,5vw,3.5rem)] font-bold leading-[1.06] tracking-[-0.02em] text-balance">
                  Você sabe quanto realmente <HighlightWord delay={0.3}>sobra</HighlightWord> em
                  cada venda?
                </h1>
                <Reveal delay={0.1}>
                  <p className="mt-5 text-[clamp(1.3rem,2.2vw,1.75rem)] font-bold leading-[1.2] tracking-[-0.02em]">
                    A Pólia foi criada para mostrar.
                  </p>
                  <p className="mt-5 max-w-[54ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                    Uma plataforma para pequenas empreendedoras entenderem seus números, organizarem
                    o negócio e tomarem decisões com mais clareza, sem planilha e sem achismo.
                  </p>
                  <p className="mt-4 max-w-[54ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink)]">
                    A Pólia será lançada em outubro. Entre na lista para ser uma das primeiras a
                    usar.
                  </p>
                  <div className="mt-7">
                    <button type="button" onClick={irParaFormulario} className={BTN_PRIMARIO}>
                      Quero ser uma das primeiras
                      <span aria-hidden="true">→</span>
                    </button>
                    <p className="mt-3 text-[14px] text-[var(--ink-soft)]">
                      É grátis. Sem cobrança.
                    </p>
                  </div>
                </Reveal>
              </div>

              {/* FORMULÁRIO (única ação da página) */}
              <Reveal delay={0.15} y={28}>
                {!enviado ? (
                  <form
                    id="lista"
                    onSubmit={handleSubmit}
                    className="grid scroll-mt-[88px] gap-4 rounded-2xl border border-[var(--line)] bg-white p-6 md:p-8"
                    noValidate
                  >
                    <p className="text-[15px] font-semibold text-[var(--ink)]">
                      Entre na lista para ser uma das primeiras a usar a Pólia.
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
                        <span>
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
                        </span>
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
                      {loading ? "Enviando…" : "Quero ser uma das primeiras"}
                    </button>
                    <p className="text-[13px] text-[var(--muted)]">
                      Sem cobrança e sem spam. Você pode sair da lista quando quiser.
                    </p>
                  </form>
                ) : (
                  <div
                    id="lista"
                    className="scroll-mt-[88px] rounded-2xl bg-[var(--surface-pink)] p-8"
                    role="status"
                    aria-live="polite"
                  >
                    <h2 className="max-w-[20ch] text-[clamp(1.4rem,2.4vw,1.75rem)] font-bold leading-[1.15] tracking-[-0.02em] text-balance">
                      Pronto. Seu e-mail está na lista.
                    </h2>
                    <p className="mt-3 max-w-[48ch] leading-[1.65] text-[var(--ink-soft)]">
                      Quando a Pólia abrir, em outubro, o convite chega antes de todo mundo. Pode
                      fechar essa página tranquila.
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
                Você fez tudo certo. Mas a conta fechou?
              </h2>
            </Reveal>

            <Reveal delay={0.1} className="mt-[clamp(32px,4vw,48px)]">
              <Pullquote tom="pessego">
                No fim do mês bate a dúvida: será que sobrou mesmo alguma coisa?
              </Pullquote>
            </Reveal>

            <Reveal className="mt-[clamp(32px,4vw,48px)] max-w-[62ch]">
              <ul className="flex list-none flex-col gap-1 text-[17px] font-semibold leading-[1.6] text-[var(--ink)]">
                {CENAS.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p className="mt-6 text-[17px] leading-[1.7] text-[var(--ink-soft)]">
                E no meio disso tudo, tenta descobrir se aquele preço que você colocou fazia
                sentido. O dinheiro entra, sai, mistura. E quando o mês termina, fica aquela
                sensação:
              </p>
              <blockquote className="mt-6 font-fraunces text-[clamp(1.4rem,2.4vw,2rem)] italic leading-[1.3] text-[var(--ink)]">
                “Eu trabalhei tanto. Mas quanto realmente sobrou?”
              </blockquote>
              <p className="mt-6 text-[17px] leading-[1.7] text-[var(--ink-soft)]">
                <b className="font-semibold text-[var(--ink)]">Não é falta de esforço.</b> É falta
                de conseguir enxergar a conta inteira.
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
                      dentro de grandes marcas, como C&amp;A, Allied e ArcelorMittal, e muita
                      consultoria para pequenas empreendedoras.
                    </p>
                    <p className="mt-4 max-w-[58ch] text-[17px] leading-[1.65] text-[var(--ink)]">
                      E eu vi a mesma coisa acontecer muitas vezes: dá para vender bem e, mesmo
                      assim, não saber se o negócio dá lucro.
                    </p>
                    <p className="mt-4 max-w-[58ch] text-[16px] leading-[1.65] text-[var(--ink-soft)]">
                      Eu vivi isso na pele. Por isso fiz a Pólia: a ferramenta que eu queria ter
                      tido no meu próprio negócio, sem planilha perdida, sem fórmula mágica e sem
                      tratar quem toca o negócio como se não entendesse dele.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 4. O QUE A PÓLIA FAZ */}
        <section className={`bg-[var(--surface)] ${SECAO}`}>
          <div className={CONTAINER}>
            <Reveal className="max-w-[56ch]">
              <Eyebrow>O que vem aí</Eyebrow>
              <h2 className="mt-4 text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                O que dá pra enxergar com a Pólia
              </h2>
              <p className="mt-4 text-[17px] leading-[1.65] text-[var(--ink-soft)]">
                Primeiro o número aparece: quanto custa, por quanto vender e o que sobra. Depois,
                essa clareza começa a organizar o resto do negócio.
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
              <h2 className="mt-4 max-w-[22ch] text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                A Pólia é pra quem quer parar de decidir no chute.
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

        {/* 6. QUANDO VOCÊ SABE: o "acho" vira "eu sei". Mesma seção escura da
            Home, pra ser o ponto de peso da página sem inventar componente novo. */}
        <section className="bg-[var(--ink)] py-[clamp(80px,10vw,140px)] text-[var(--bg)]">
          <div className={CONTAINER}>
            <div className="grid grid-cols-1 items-start gap-[clamp(32px,5vw,80px)] md:grid-cols-[1fr_1fr]">
              <Reveal>
                <Eyebrow claro>Quando você sabe</Eyebrow>
                <h2 className="mt-4 max-w-[14ch] text-[clamp(2.3rem,5vw,3.8rem)] font-bold leading-[1.06] tracking-[-0.02em] text-balance">
                  O “acho” começa a virar{" "}
                  <em className="font-fraunces font-normal italic text-[var(--secondary-light)]">
                    “eu sei”
                  </em>
                  .
                </h2>
              </Reveal>
              <div>
                <RevealGroup className="flex flex-col gap-3">
                  {QUANDO_SABE.map((linha) => (
                    <RevealItem key={linha}>
                      <p className="max-w-[44ch] text-[17px] leading-[1.6] text-[var(--bg)]/70">
                        {linha}
                      </p>
                    </RevealItem>
                  ))}
                </RevealGroup>
                <Reveal delay={0.1}>
                  <p className="mt-8 border-t border-white/[0.18] pt-8 text-[clamp(1.4rem,2.4vw,2rem)] font-bold leading-[1.2] tracking-[-0.02em]">
                    <span className="block">Você olha para os números.</span>
                    <span className="block">Entende o cenário.</span>
                    <span className="block">E decide.</span>
                  </p>
                  <p className="mt-8 text-[17px] font-semibold leading-[1.6] text-[var(--secondary-light)]">
                    É para isso que a Pólia existe.
                  </p>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* 7. SEGUNDO CTA: leva de volta ao formulário do topo */}
        <section className={`bg-[var(--surface)] ${SECAO}`}>
          <div className={CONTAINER}>
            <Reveal className="max-w-[62ch]">
              <h2 className="text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                Quer ser uma das primeiras?
              </h2>
              <p className="mt-5 text-[17px] leading-[1.7] text-[var(--ink)]">
                A Pólia será lançada em outubro.
              </p>
              <p className="mt-2 text-[17px] leading-[1.7] text-[var(--ink-soft)]">
                Quem estiver na lista será avisada primeiro e poderá acompanhar a chegada da
                plataforma desde o começo.
              </p>
              <div className="mt-7">
                <button type="button" onClick={irParaFormulario} className={BTN_PRIMARIO}>
                  Quero entrar na lista
                  <span aria-hidden="true">→</span>
                </button>
                <p className="mt-3 text-[14px] text-[var(--ink-soft)]">
                  Sem cobrança. Sem spam. Só avisamos quando houver novidade e quando a Pólia abrir.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 8. FECHAMENTO */}
        <section className={SECAO}>
          <div className={CONTAINER}>
            <Reveal className="max-w-[62ch]">
              <Eyebrow>Em outubro</Eyebrow>
              <h2 className="mt-4 text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
                Seu negócio já está acontecendo.
              </h2>
              <p className="mt-6 text-[17px] leading-[1.7] text-[var(--ink-soft)]">
                Você já vende. Já compra. Já decide.
              </p>
              <p className="mt-2 text-[17px] leading-[1.7] text-[var(--ink-soft)]">
                Agora falta conseguir enxergar tudo isso com mais clareza.
              </p>
              <p className="mt-6 text-[clamp(1.4rem,2.4vw,2rem)] font-bold leading-[1.2] tracking-[-0.02em]">
                <HighlightWord delay={0.2}>A Pólia está quase pronta</HighlightWord> e será lançada
                em outubro.
              </p>
              <div className="mt-7">
                <button type="button" onClick={irParaFormulario} className={BTN_PRIMARIO}>
                  Quero entrar na lista
                  <span aria-hidden="true">→</span>
                </button>
              </div>
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
