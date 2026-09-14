import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { Check } from "lucide-react";
import { linkCanonico } from "@/lib/seo";
import { track } from "@/lib/analytics";
import { gtagEvent } from "@/components/GoogleAnalytics";
import { useTurnstile, TurnstileWidget } from "@/components/TurnstileWidget";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";
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
import { gravarLeadManual } from "@/lib/manual.functions";
import {
  CONSENT_TEXTO_MANUAL,
  INSTAGRAM_URL,
  NOME_ARQUIVO_PDF,
  NOME_MANUAL,
} from "@/lib/manual/conteudo";

// Landing do "Manual da Pequena Marca que Quer Ser Grande": isca gratuita do
// pré-lançamento, destino de link da bio. Um campo só (e-mail), consentimento,
// e o PDF sai na hora depois do envio, mais uma cópia por e-mail.
//
// O arquivo NÃO está linkado em nenhum lugar desta página antes do envio: o
// link de download nasce com o token que a server function devolve, e o PDF
// mora num bucket privado do Storage, não em public/ (ver
// src/lib/manual/download.server.ts).

const TIMEOUT_MS = 8000;

const ERRO_REDE = "Não conseguimos salvar agora. O e-mail continua aqui, é só tentar de novo.";
const ERRO_EMAIL = "Esse e-mail não parece completo. Confere pra gente?";
const ERRO_TURNSTILE = "Falta confirmar ali em cima que não é um robô.";

const AVISOS: Record<"link" | "erro", string> = {
  link: "Esse link de download não funcionou. Pede o manual de novo aqui que a gente manda outro.",
  erro: "O download não saiu agora. Pede o manual de novo, ou tenta pelo link do e-mail daqui a pouco.",
};

const CTA_LARGO = "w-full min-h-[52px] sm:w-auto";
const ID_PEDIDO = "pedir";
const ID_EMAIL = "manual-email";

export const Route = createFileRoute("/manual")({
  validateSearch: (search: Record<string, unknown>) => ({
    origem:
      typeof search.origem === "string" && /^[a-z0-9_-]{1,40}$/i.test(search.origem)
        ? search.origem
        : undefined,
    // Motivo do redirect de /manual/baixar quando o link não serviu (ver
    // src/lib/manual/download.server.ts). Qualquer outro valor é ignorado.
    aviso: (["link", "erro"] as const).find((v) => v === search.aviso),
  }),
  head: () => ({
    meta: [
      { title: `${NOME_MANUAL} · Pólia` },
      {
        name: "description",
        content:
          "Guia gratuito em 17 seções, com exercícios e um plano de 7 dias, pra quem toca a própria marca e quer que ela pareça do tamanho do negócio. O PDF chega na hora, depois do e-mail.",
      },
      {
        property: "og:title",
        content: "Sua empresa pode ser pequena. Sua marca não precisa parecer.",
      },
      {
        property: "og:description",
        content: `${NOME_MANUAL}: 17 seções, exercícios e plano de 7 dias. Gratuito.`,
      },
    ],
    links: [linkCanonico("/manual")],
  }),
  component: ManualPage,
});

function emailValido(valor: string): boolean {
  return z.string().email().safeParse(valor.trim()).success;
}

/** Sem resposta em 8s, trata como falha de rede. A promessa original segue e é descartada. */
function comTimeout<T>(promessa: Promise<T>): Promise<T> {
  return Promise.race([
    promessa,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
  ]);
}

/** Dispara o download sem sair da página. O `download` no <a> é redundante
 *  com o Content-Disposition do Worker, e fica de propósito: é o que faz o
 *  navegador baixar em vez de abrir mesmo se o cabeçalho for reescrito no meio. */
function iniciarDownload(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = NOME_ARQUIVO_PDF;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function irPraOPedido() {
  document.getElementById(ID_PEDIDO)?.scrollIntoView({ behavior: "smooth", block: "start" });
  // Depois da rolagem, o foco vai pro campo: quem tocou em "Quero meu manual"
  // quer digitar, não procurar onde digita.
  window.setTimeout(() => document.getElementById(ID_EMAIL)?.focus({ preventScroll: true }), 450);
}

// ── Conteúdo ────────────────────────────────────────────────────────────────

const CREDENCIAIS = [
  "17 seções com exercícios",
  "Plano de 7 dias",
  "Manifesto pra sua marca",
  "Grátis, de verdade",
];

const CENA = [
  "Fazendo o produto.",
  "Vendendo.",
  "Criando conteúdo.",
  "Respondendo cliente.",
  "Cuidando das redes.",
  "Fazendo absolutamente tudo.",
];

const DECISOES: { n: string; titulo: string; texto: string }[] = [
  {
    n: "01",
    titulo: "O DNA da marca",
    texto: "Quem ela é, o que representa e como quer ser lembrada.",
  },
  {
    n: "02",
    titulo: "O posicionamento",
    texto: "Parar de falar com todo mundo e atrair as pessoas certas.",
  },
  {
    n: "03",
    titulo: "O que diferencia",
    texto: "O que torna o negócio especial vira percepção de valor.",
  },
  {
    n: "04",
    titulo: "A voz própria",
    texto: "Comunicar a marca com personalidade e consistência.",
  },
  {
    n: "05",
    titulo: "O Instagram",
    texto: "Um perfil que diz quem é a marca e por que escolher ela.",
  },
  {
    n: "06",
    titulo: "Conteúdo com intenção",
    texto: "Parar de só postar e começar a construir percepção.",
  },
  {
    n: "07",
    titulo: "A consistência",
    texto: "Uma marca reconhecida sem depender de um post perfeito.",
  },
  { n: "08", titulo: "A prática", texto: "Um plano de 7 dias pra tirar tudo do papel." },
];

const ENTREGAS = [
  "Exercícios pra definir a marca",
  "Perguntas pra encontrar o posicionamento",
  "Guia pra construir o tom de voz",
  "Estrutura pra melhorar a bio",
  "Cinco pilares de conteúdo",
  "Plano de ação de 7 dias",
  "Manifesto pra sua marca",
];

// ── Casca ───────────────────────────────────────────────────────────────────
// Sem SiteHeader nem SiteFooter, e sem link no wordmark: a landing é destino
// de link da bio, não tem rota de fuga pro resto do site. O rodapé é o mínimo
// que a LGPD e o bom senso pedem: privacidade, termos e o perfil.
function Casca({ children }: { children: React.ReactNode }) {
  return (
    <div className="polia-v3 flex min-h-screen flex-col bg-[var(--bg)] text-[var(--ink)]">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="border-b border-[var(--line)] bg-[var(--bg)]">
        <div className={`${CONTAINER} flex items-center py-5`}>
          <PoliaWordmark className="h-6 w-auto" />
        </div>
      </header>
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-[var(--line)] py-10 text-[14px] text-[var(--ink-soft)]">
        <div className={`${CONTAINER} flex flex-wrap items-start justify-between gap-6`}>
          <div>
            <PoliaWordmark className="h-5 w-auto" />
            <p className="mt-3 max-w-[38ch] leading-[1.5]">
              Pequenas marcas. Grandes sonhos. Um material gratuito da Pólia.
            </p>
          </div>
          <nav className="flex flex-wrap gap-6" aria-label="Links do rodapé">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--ink)] no-underline hover:underline"
            >
              @usepolia
            </a>
            <Link to="/privacidade" className="text-[var(--ink)] no-underline hover:underline">
              Privacidade
            </Link>
            <Link to="/termos" className="text-[var(--ink)] no-underline hover:underline">
              Termos
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// ── Cartão do pedido: formulário e, depois, o "pronto" ──────────────────────
function CartaoPedido({
  origem,
  aviso,
}: {
  origem: string | undefined;
  aviso: "link" | "erro" | undefined;
}) {
  const ts = useTurnstile();
  const [email, setEmail] = useState("");
  const [aceite, setAceite] = useState(false);
  const [erroEmail, setErroEmail] = useState<string | undefined>();
  const [erroEnvio, setErroEnvio] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);
  const [hp, setHp] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const prontoRef = useRef<HTMLHeadingElement>(null);

  const podeEnviar = emailValido(email) && aceite && !enviando;

  // A tela troca no lugar do formulário; o foco vai junto pra quem usa leitor
  // de tela ouvir o "pronto" em vez de silêncio.
  useEffect(() => {
    if (downloadUrl) prontoRef.current?.focus();
  }, [downloadUrl]);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (hp) return;
    if (!emailValido(email)) {
      setErroEmail(ERRO_EMAIL);
      emailRef.current?.focus();
      return;
    }
    if (!aceite) return;
    if (!ts.token) {
      setErroEnvio(ERRO_TURNSTILE);
      return;
    }

    setErroEnvio(undefined);
    setEnviando(true);
    try {
      const r = await comTimeout(
        gravarLeadManual({
          data: { email: email.trim(), consentimento: true, origem, turnstileToken: ts.token },
        }),
      );
      if (!r.ok) {
        ts.reset();
        setErroEnvio(r.motivo === "turnstile" ? ERRO_TURNSTILE : ERRO_REDE);
        setEnviando(false);
        return;
      }
      track("manual_lead_gravado", { origem: origem ?? "instagram_bio" });
      gtagEvent("manual_lead_gravado", { origem: origem ?? "instagram_bio" });
      setDownloadUrl(r.downloadUrl);
      iniciarDownload(r.downloadUrl);
    } catch (erro) {
      console.error("[Manual] Falha ao gravar o lead:", erro);
      ts.reset();
      setErroEnvio(ERRO_REDE);
      setEnviando(false);
    }
  }

  if (downloadUrl) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-white p-6 md:p-8">
        <Eyebrow>Pronto</Eyebrow>
        <h2
          ref={prontoRef}
          tabIndex={-1}
          className="mt-3 text-[clamp(1.5rem,4vw,1.9rem)] font-bold leading-[1.15] tracking-[-0.02em] text-balance outline-none"
        >
          Seu manual está a caminho.
        </h2>
        <p className="mt-4 text-[16px] leading-[1.6] text-[var(--ink-soft)]">
          O download começou automaticamente. Se o navegador segurou, o botão abaixo baixa de novo.
        </p>
        <a
          href={downloadUrl}
          download={NOME_ARQUIVO_PDF}
          className={`${BTN_PRIMARIO} mt-6 ${CTA_LARGO}`}
          onClick={() => {
            track("manual_download_clicado");
            gtagEvent("manual_download_clicado");
          }}
        >
          Baixar o manual
        </a>
        <p className="mt-6 text-[15px] leading-[1.6] text-[var(--ink-soft)]">
          Uma cópia também foi pro seu e-mail, pra ficar guardada.
        </p>
        <div className="mt-6 border-t border-[var(--line)] pt-6">
          <p className="text-[15px] leading-[1.6] text-[var(--ink-soft)]">
            Enquanto isso, a Pólia está sendo construída em público: primeiro mostra se o negócio dá
            lucro, depois ajuda a construir a marca que sustenta o preço.
          </p>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${BTN_CONTORNO} mt-4 ${CTA_LARGO}`}
          >
            Seguir @usepolia
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={enviar}
      noValidate
      className="rounded-2xl border border-[var(--line)] bg-white p-6 md:p-8"
      aria-labelledby="manual-form-titulo"
    >
      <h2
        id="manual-form-titulo"
        className="text-[clamp(1.35rem,3.4vw,1.6rem)] font-bold leading-[1.15] tracking-[-0.02em]"
      >
        Quero receber o manual
      </h2>
      <p className="mt-2 text-[15px] leading-[1.55] text-[var(--ink-soft)]">
        O download começa na hora e uma cópia vai pro seu e-mail.
      </p>

      {aviso && (
        <p
          role="status"
          className="mt-5 rounded-xl bg-[var(--surface-pink)] px-4 py-3 text-[14px] leading-[1.5] text-[var(--ink)]"
        >
          {AVISOS[aviso]}
        </p>
      )}

      <div className="mt-6 grid gap-5">
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
            htmlFor={ID_EMAIL}
            className="mb-2 block text-[14px] font-semibold text-[var(--ink-soft)]"
          >
            Seu melhor e-mail
          </label>
          <input
            id={ID_EMAIL}
            ref={emailRef}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="voce@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (erroEmail) setErroEmail(undefined);
            }}
            onBlur={() => {
              if (email.trim() && !emailValido(email)) setErroEmail(ERRO_EMAIL);
            }}
            aria-invalid={!!erroEmail || undefined}
            aria-describedby={erroEmail ? "manual-email-erro" : undefined}
            className={`min-h-[52px] w-full rounded-xl border bg-white px-4 py-3 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:ring-4 ${
              erroEmail
                ? "border-[var(--danger)] focus:border-[var(--danger)]"
                : "border-[var(--line)] focus:border-[var(--secondary)] focus:ring-[var(--secondary-light)]"
            }`}
          />
          <FieldError id="manual-email-erro">{erroEmail}</FieldError>
        </div>

        {/* O link fica FORA do <label> de propósito: dentro, clicar nele conta
            como clique no label e marca/desmarca o consentimento junto. */}
        <div className="flex items-start gap-3 text-[14px] leading-[1.5] text-[var(--ink-soft)]">
          <input
            id="manual-consent"
            type="checkbox"
            checked={aceite}
            onChange={(e) => setAceite(e.target.checked)}
            className="mt-[2px] h-[18px] w-[18px] flex-none accent-[var(--secondary)]"
          />
          <span>
            <label htmlFor="manual-consent" className="cursor-pointer">
              {CONSENT_TEXTO_MANUAL}
            </label>{" "}
            <Link
              to="/privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]"
            >
              Política de privacidade
            </Link>
          </span>
        </div>

        <TurnstileWidget containerRef={ts.containerRef} />

        <button
          type="submit"
          disabled={!podeEnviar}
          className={`${BTN_PRIMARIO} min-h-[52px] w-full disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0`}
        >
          {enviando ? "Enviando…" : "Quero receber o manual"}
          {!enviando && <span aria-hidden="true">→</span>}
        </button>

        {erroEnvio && (
          <p role="alert" className="text-[14px] leading-[1.5] text-[var(--danger)]">
            {erroEnvio}
          </p>
        )}
      </div>
    </form>
  );
}

// ── Capa do manual, só com tipografia e token. Sem imagem, sem 3D. ──────────
function CapaManual() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto w-full max-w-[320px] rounded-2xl border border-[var(--line)] bg-[var(--surface-pink)] p-7 md:p-8"
      style={{ aspectRatio: "3 / 4" }}
    >
      <div className="flex h-full flex-col justify-between">
        <p className="font-accent text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
          Manual
        </p>
        <div>
          <p className="font-cabinet text-[clamp(1.5rem,4vw,1.9rem)] font-bold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
            O manual da pequena marca que quer ser grande
          </p>
          <p className="mt-4 text-[13px] leading-[1.5] text-[var(--ink-soft)]">
            Um guia prático pra um negócio pequeno virar uma marca que as pessoas lembram, desejam e
            escolhem.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <PoliaWordmark className="h-4 w-auto" />
          <p className="font-accent text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
            17 seções
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────
function ManualPage() {
  const { origem, aviso } = Route.useSearch();

  return (
    <Casca>
      {/* 01 · Hero com o pedido na dobra */}
      <section className={`${CONTAINER} ${SECAO} !pt-[clamp(48px,7vw,96px)]`}>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-16">
          <div>
            <Reveal>
              <Eyebrow>Material gratuito da Pólia</Eyebrow>
              <h1 className="mt-4 text-[clamp(2.1rem,5.6vw,3.6rem)] font-bold leading-[1.04] tracking-[-0.02em] text-balance">
                Sua empresa pode ser pequena. Sua marca{" "}
                <HighlightWord delay={0.3}>não precisa parecer</HighlightWord>.
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-6 max-w-[48ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                Um guia prático pra quem toca a própria marca e quer que ela fique mais forte, mais
                profissional e pronta pra crescer. O PDF chega na hora, depois do e-mail.
              </p>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-[14px] font-medium text-[var(--ink-soft)]">
                {CREDENCIAIS.map((c) => (
                  <li key={c} className="flex items-center gap-2">
                    <Check
                      aria-hidden="true"
                      className="h-4 w-4 flex-none text-[var(--secondary-text)]"
                    />
                    {c}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <div id={ID_PEDIDO} className="scroll-mt-6">
            <Reveal delay={0.15}>
              <CartaoPedido origem={origem} aviso={aviso} />
            </Reveal>
          </div>
        </div>
      </section>

      {/* 02 · O gancho */}
      <section className="bg-white">
        <div className={`${CONTAINER} ${SECAO}`}>
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <Reveal>
              <Eyebrow>Pra quem é</Eyebrow>
              <h2 className="mt-4 text-[clamp(1.8rem,4.2vw,2.6rem)] font-bold leading-[1.1] tracking-[-0.02em] text-balance">
                Marca grande não espera a empresa crescer.
              </h2>
            </Reveal>
            <div>
              <Reveal delay={0.05}>
                <p className="text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                  Talvez você tenha começado sozinha.
                </p>
              </Reveal>
              <RevealGroup className="mt-5 grid gap-1">
                {CENA.map((linha, i) => (
                  <RevealItem key={linha}>
                    <p
                      className={`font-cabinet text-[clamp(1.4rem,3.2vw,2rem)] font-bold leading-[1.15] tracking-[-0.02em] ${
                        i === CENA.length - 1 ? "text-[var(--ink)]" : "text-[var(--ink-soft)]"
                      }`}
                    >
                      {linha}
                    </p>
                  </RevealItem>
                ))}
              </RevealGroup>
              <Reveal delay={0.1}>
                <p className="mt-8 max-w-[52ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
                  E aí fica aquela sensação de que o negócio é bem maior do que a marca consegue
                  mostrar hoje.
                </p>
                <p className="mt-4 max-w-[52ch] text-[clamp(1.06rem,1.35vw,1.2rem)] font-semibold leading-[1.6] text-[var(--ink)]">
                  O manual existe pra fechar essa distância.
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* 03 · O que tem dentro */}
      <section className={`${CONTAINER} ${SECAO}`}>
        <Reveal>
          <Eyebrow>Dentro do manual</Eyebrow>
          <h2 className="mt-4 max-w-[22ch] text-[clamp(1.8rem,4.2vw,2.6rem)] font-bold leading-[1.1] tracking-[-0.02em] text-balance">
            Oito decisões que o manual ajuda a tomar
          </h2>
        </Reveal>
        <RevealGroup className="mt-12 grid gap-x-12 md:grid-cols-2">
          {DECISOES.map((d) => (
            <RevealItem key={d.n} className="border-t border-[var(--line)] py-6">
              <div className="flex gap-5">
                <span className="font-cabinet w-9 flex-none pt-[2px] text-[14px] font-bold tracking-[-0.02em] text-[var(--secondary-text)]">
                  {d.n}
                </span>
                <div>
                  <h3 className="text-[clamp(1.15rem,2vw,1.35rem)] font-bold leading-[1.2] tracking-[-0.02em]">
                    {d.titulo}
                  </h3>
                  <p className="mt-2 text-[16px] leading-[1.6] text-[var(--ink-soft)]">{d.texto}</p>
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* 04 · A frase, como uma página do próprio manual */}
      <section className={`${CONTAINER} pb-[clamp(72px,9vw,128px)]`}>
        <Reveal>
          <Pullquote tom="pessego">
            Grandes marcas não começam grandes.{" "}
            <span className="font-fraunces italic font-normal">Começam com intenção.</span>
          </Pullquote>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-8 grid gap-2 md:grid-cols-[1fr_auto] md:items-end md:gap-12">
            <ul className="grid gap-1 text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
              <li>Sem milhares de seguidores.</li>
              <li>Sem equipe grande.</li>
              <li>Sem esperar o momento certo.</li>
            </ul>
            <p className="text-[clamp(1.2rem,2vw,1.5rem)] font-bold leading-[1.3] tracking-[-0.02em] text-[var(--ink)]">
              Dá pra começar agora.
            </p>
          </div>
        </Reveal>
      </section>

      {/* 05 · O que chega */}
      <section className="bg-white">
        <div className={`${CONTAINER} ${SECAO}`}>
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-16">
            <Reveal>
              <CapaManual />
            </Reveal>
            <div>
              <Reveal>
                <Eyebrow>O que chega no e-mail</Eyebrow>
                <h2 className="mt-4 text-[clamp(1.8rem,4.2vw,2.6rem)] font-bold leading-[1.1] tracking-[-0.02em] text-balance">
                  {NOME_MANUAL}
                </h2>
                <p className="mt-4 text-[16px] leading-[1.6] text-[var(--ink-soft)]">
                  17 seções práticas, em PDF, pra ler no celular e preencher com caneta.
                </p>
              </Reveal>
              <RevealGroup className="mt-8 grid gap-3 sm:grid-cols-2">
                {ENTREGAS.map((e) => (
                  <RevealItem key={e} className="flex items-start gap-3 text-[16px] leading-[1.5]">
                    <span
                      aria-hidden="true"
                      className="mt-[3px] grid h-5 w-5 flex-none place-items-center rounded-md bg-[var(--secondary-light)]"
                    >
                      <Check className="h-3.5 w-3.5 text-[var(--ink)]" />
                    </span>
                    {e}
                  </RevealItem>
                ))}
              </RevealGroup>
              <Reveal delay={0.1}>
                <p className="mt-8 text-[16px] font-semibold leading-[1.6] text-[var(--ink)]">
                  Tudo num único PDF, gratuito. Sem versão paga escondida.
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* 06 · Segundo pedido, que leva de volta ao cartão */}
      <section className={`${CONTAINER} ${SECAO}`}>
        <Reveal>
          <Eyebrow>Pra começar</Eyebrow>
          <h2 className="mt-4 max-w-[20ch] text-[clamp(1.8rem,4.2vw,2.6rem)] font-bold leading-[1.1] tracking-[-0.02em] text-balance">
            Quer uma marca do tamanho do negócio que já existe?
          </h2>
          <p className="mt-5 max-w-[50ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
            É um campo só: o e-mail. O manual chega na hora, e cancelar o recebimento é um clique,
            direto do rodapé do e-mail.
          </p>
          <button
            type="button"
            onClick={irPraOPedido}
            className={`${BTN_PRIMARIO} mt-8 ${CTA_LARGO}`}
          >
            Quero meu manual
            <span aria-hidden="true">↑</span>
          </button>
        </Reveal>
      </section>
    </Casca>
  );
}
