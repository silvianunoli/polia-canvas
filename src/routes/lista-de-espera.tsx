import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { ArrowUp } from "lucide-react";
import { toastErro } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { useTurnstile, TurnstileWidget } from "@/components/TurnstileWidget";
import { entrarListaEspera } from "@/lib/lista-espera.functions";
import { SiteHeader } from "@/components/site/SiteHeader";
import { FieldError } from "@/components/ui/FieldError";

export const Route = createFileRoute("/lista-de-espera")({
  head: () => ({
    meta: [
      { title: "Entrar na lista · Pólia" },
      {
        name: "description",
        content:
          "A Pólia está chegando. Deixe seu e-mail e seja avisada antes de todo mundo quando ela ficar pronta.",
      },
      { property: "og:title", content: "Entrar na lista · Pólia" },
      {
        property: "og:description",
        content: "A Pólia está chegando. Seja avisada antes de todo mundo.",
      },
    ],
  }),
  component: ListaEsperaPage,
});

const BENEFICIOS = [
  {
    titulo: "Uma marca com valor de verdade",
    desc: "Você deixa claro quem a sua marca atende, o que entrega e por que vale o que cobra. Marca clara é marca que fatura mais.",
  },
  {
    titulo: "Um preço que fecha a conta",
    desc: "Com a marca clara, você vê quanto custa cada produto, por quanto vender e o que sobra. Chega de chutar.",
  },
  {
    titulo: "A semana organizada num lugar",
    desc: "Um quadro simples pra organizar o que precisa sair, ligado à meta que você definiu. Nada se perde no caminho.",
  },
  {
    titulo: "A venda que vira caixa sozinha",
    desc: "Marcou que entregou pro cliente, o dinheiro entra no caixa na hora. Sem lançar de novo, sem planilha perdida.",
  },
  {
    titulo: "Saber quanto sobra de verdade",
    desc: "No fim do mês, você vê o que entrou, o que saiu e o que sobrou. Sem susto no extrato.",
  },
  {
    titulo: "Saber se vai bater a meta",
    desc: "Durante o mês, você já vê se está no caminho. Dá tempo de ajustar antes de fechar.",
  },
];

const PRA_VOCE = [
  "Você tem um negócio, ou a vontade de começar um, e se perde na hora de organizar.",
  "Você já vende, mas nunca tem certeza se sobra dinheiro no fim do mês.",
  "Você cobra no chute e trava quando perguntam como chegou naquele preço.",
  "Você quer tocar o seu negócio com mais clareza e menos achismo.",
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
          tipo_negocio: trava || null,
          novidades,
          turnstileToken: turnstile.token,
        },
      });
      if (resultado.ok) {
        if (resultado.jaEstava) toastErro("Esse e-mail já está na lista. Você já está dentro.");
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
      <SiteHeader semLogin />

      <main>
        {/* 1. HERO + FORMULÁRIO */}
        <section className="pb-14 pt-14 md:pb-20 md:pt-20">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-[0.95fr_1.05fr] md:gap-16">
              <div className="md:pt-2">
                <span className="inline-flex rounded-sm bg-[var(--secondary-light)] px-3 py-1 text-[13px] font-semibold text-[var(--secondary-ink)]">
                  Chegando em breve
                </span>
                <h1 className="font-cabinet mt-4 text-[40px] leading-[1.05] tracking-[-0.02em] text-[var(--ink)] md:text-[54px]">
                  A Pólia está quase pronta. Quer ser avisada quando ela chegar?
                </h1>
                <p className="mt-6 max-w-[54ch] text-[19px] leading-[1.5] text-[var(--ink-soft)] md:text-[21px]">
                  Estou construindo a Pólia pra te ajudar a deixar a sua marca clara: quem ela
                  atende, o que entrega e quanto vale. É essa clareza que faz você cobrar o que
                  merece e enxergar, sem complicação, se o negócio dá lucro. Deixe seu e-mail e eu
                  te aviso assim que ela ficar pronta, antes de todo mundo.
                </p>
              </div>

              {/* FORMULÁRIO (única ação da página) */}
              <div>
                {!enviado ? (
                  <form
                    onSubmit={handleSubmit}
                    className="grid gap-4 rounded-xl border border-[var(--line)] bg-white p-6 shadow-[0_1px_2px_rgba(10,10,10,.04),0_10px_34px_rgba(10,10,10,.05)] md:p-8"
                    noValidate
                  >
                    <p className="text-[15px] font-semibold text-[var(--ink)]">
                      Deixe seu e-mail. Eu te aviso quando a Pólia chegar.
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
                        O que mais trava o seu negócio hoje?{" "}
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
                      <p id="aceite-error" role="alert" className="text-[13px] text-[var(--danger)]">
                        Pra continuar, falta aceitar os termos.
                      </p>
                    )}

                    <TurnstileWidget containerRef={turnstile.containerRef} />
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-lg bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] transition-[filter] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:opacity-60"
                    >
                      {loading ? "Enviando…" : "Quero ser avisada"}
                    </button>
                    <p className="text-[13px] text-[var(--muted)]">
                      É só o e-mail. Sem cobrança, sem spam, e você sai da lista quando quiser.
                    </p>
                  </form>
                ) : (
                  <div
                    className="rounded-xl bg-[var(--surface-pink)] p-8"
                    role="status"
                    aria-live="polite"
                  >
                    <h2 className="max-w-[20ch] text-[24px] text-[var(--ink)]">
                      Pronto. Seu e-mail está na lista.
                    </h2>
                    <p className="mt-3 max-w-[48ch] text-[var(--ink-soft)]">
                      Assim que a Pólia ficar pronta, o aviso chega até você, antes de todo mundo.
                      Pode fechar essa página tranquila. Eu te chamo.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 2. O PROBLEMA (empatia primeiro) */}
        <section className="pb-14 md:pb-20">
          <div className="mx-auto max-w-[1120px] px-6">
            <h2 className="max-w-[26ch] text-[22px] leading-[1.4] text-[var(--ink)] md:text-[26px]">
              Você vende, se esforça, faz acontecer. Mas no fim do mês bate a dúvida: será que
              sobrou mesmo alguma coisa?
            </h2>
            <p className="mt-5 max-w-[62ch] text-[16px] leading-[1.6] text-[var(--ink-soft)]">
              O preço saiu meio no chute. O dinheiro do negócio se mistura com o seu. E organizar
              isso tudo parece dar mais trabalho do que ajuda. Não é falta de esforço. É que
              ninguém junta esses números por você.
            </p>
          </div>
        </section>

        {/* 3. QUEM ESTÁ CONSTRUINDO (a Sil, em 1ª pessoa) */}
        <section className="pb-14 md:pb-20">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-8 md:p-12">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_1.6fr] md:gap-16">
                <div>
                  <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                    Quem está construindo
                  </p>
                  <p className="font-cabinet mt-3 text-[22px] leading-[1.2] text-[var(--ink)]">
                    Oi, eu sou a Sil.
                  </p>
                </div>
                <div>
                  <p className="max-w-[58ch] text-[17px] leading-[1.6] text-[var(--ink)]">
                    São 14 anos de e-commerce: oito à frente do meu próprio negócio, um tempo dentro
                    de grandes marcas, como C&amp;A, Allied e Arcelor Mittal, e muita consultoria pra
                    pequenas empreendedoras. E vi sempre a mesma coisa: dá pra vender bem e mesmo
                    assim não saber se o negócio dá lucro.
                  </p>
                  <p className="mt-4 max-w-[58ch] text-[16px] leading-[1.6] text-[var(--ink-soft)]">
                    Eu vivi isso na pele. Por isso estou construindo a Pólia, a ferramenta que eu
                    queria ter tido. Sem planilha perdida, sem fórmula mágica, sem te tratar como se
                    você não entendesse do seu próprio negócio.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. O QUE A PÓLIA VAI FAZER */}
        <section className="pb-14 md:pb-20">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="rounded-xl border border-[var(--line)] bg-white p-8 md:p-12">
              <h2 className="max-w-[28ch] text-[24px] text-[var(--ink)] md:text-[30px]">
                O que a Pólia vai fazer por você
              </h2>
              <p className="mt-3 max-w-[56ch] text-[16px] leading-[1.6] text-[var(--ink-soft)]">
                Primeiro a sua marca fica clara. É essa clareza que vira preço certo, lucro à vista
                e o negócio inteiro num lugar só, sem planilha perdida.
              </p>
              <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
                {BENEFICIOS.map((b, i) => (
                  <div key={b.titulo} className="flex gap-4">
                    <span className="font-cabinet text-[24px] leading-none text-[var(--secondary-text)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="text-[18px] text-[var(--ink)]">{b.titulo}</h3>
                      <p className="mt-2 text-[15px] leading-[1.6] text-[var(--ink-soft)]">
                        {b.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 5. PRA VOCÊ QUE */}
        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="rounded-xl border border-[var(--line)] bg-white p-8 md:p-12">
              <h2 className="text-[24px] text-[var(--ink)] md:text-[30px]">A Pólia é pra você que</h2>
              <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {PRA_VOCE.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-[16px] leading-[1.6] text-[var(--ink-soft)]"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-2 block h-[8px] w-[8px] flex-none rounded-full bg-[var(--secondary)]"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="polia-v3 mt-8 border-t border-[var(--line)] bg-white py-8">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-6 text-[13px] text-[var(--muted)]">
          <span>© 2026 Pólia · CNPJ: 18.305.925/0001-06</span>
          <span>Desenvolvido por Prismia Soluções Digitais</span>
        </div>
      </footer>

      {mostrarTopo && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Voltar ao topo"
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ink)] text-white shadow-[0_6px_20px_rgba(10,10,10,.25)] transition-[filter] hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
        >
          <ArrowUp size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
