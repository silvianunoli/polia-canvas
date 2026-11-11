import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { linkCanonico } from "@/lib/seo";
import { track } from "@/lib/analytics";
import { gtagEvent } from "@/lib/gtag";
import { pixelLead } from "@/lib/metaPixel";
import { tiktokLead } from "@/lib/tiktokPixel";
import { useTurnstile } from "@/hooks/useTurnstile";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";
import { mascararTelefone, whatsappDaConta } from "@/lib/telefone";
import { FieldError } from "@/components/ui/FieldError";
import { Reveal, RevealGroup, RevealItem } from "@/components/site/Reveal";
import { HighlightWord } from "@/components/site/HighlightWord";
import { CONTAINER, SECAO, BTN_PRIMARIO, BTN_CONTORNO, Eyebrow } from "@/components/site/Editorial";
import { gravarLeadIsca } from "@/lib/iscas.functions";
import { buscarIsca, type Isca } from "@/lib/iscas/catalogo";
import { INSTAGRAM_URL } from "@/lib/manual/conteudo";

// Páginas de isca em PDF: /materiais/<slug>. O conteúdo de cada uma vem de
// src/lib/iscas/catalogo.ts; esta tela é a mesma pra todas.
//
// Quem chega aqui veio do Direct do Instagram (comentou a palavra no
// carrossel e recebeu o link), quase sempre no navegador interno do app, no
// celular. Por isso o formulário vem logo depois do título, antes da lista do
// que tem dentro: no celular, a ação aparece sem rolar muito.
//
// E-mail e WhatsApp são obrigatórios aqui (diferente do /manual, onde o
// WhatsApp é opcional). Mesmo cuidado do manual com o PDF: nenhum link pro
// arquivo antes do envio; o download nasce com o token que a server function
// devolve, e o arquivo mora no bucket privado `iscas`.

const TIMEOUT_MS = 8000;

const ERRO_REDE =
  "A Pólia não conseguiu salvar agora. O que foi digitado continua aqui, é só tentar de novo.";
const ERRO_EMAIL = "Esse e-mail não parece completo. Confere o endereço?";
const ERRO_TELEFONE = "Esse WhatsApp parece incompleto. Confere o DDD e o número?";
const ERRO_TURNSTILE = "Falta confirmar ali em cima que não é um robô.";
const ERRO_TURNSTILE_CARREGAMENTO =
  "A verificação de segurança não carregou. Pode ser bloqueador de anúncios ou de privacidade ativo. Recarrega a página e tenta de novo.";

const CTA_LARGO = "w-full min-h-[52px] sm:w-auto";
const CAMPO =
  "min-h-[52px] w-full rounded-xl border bg-white px-4 py-3 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:ring-4";
const CAMPO_OK =
  "border-[var(--line)] focus:border-[var(--secondary)] focus:ring-[var(--secondary-light)]";
const CAMPO_ERRO = "border-[var(--danger)] focus:border-[var(--danger)]";

export const Route = createFileRoute("/materiais/$slug")({
  loader: ({ params }) => {
    const isca = buscarIsca(params.slug);
    if (!isca) throw notFound();
    return { isca };
  },
  validateSearch: (search: Record<string, unknown>) => ({
    origem:
      typeof search.origem === "string" && /^[a-z0-9_-]{1,40}$/i.test(search.origem)
        ? search.origem
        : undefined,
    // Motivo do redirect de /materiais/<slug>/baixar quando o link não serviu
    // (ver src/lib/iscas/download.server.ts). Qualquer outro valor é ignorado.
    aviso: (["link", "erro"] as const).find((v) => v === search.aviso),
  }),
  head: ({ loaderData, params }) => {
    const isca = loaderData?.isca;
    if (!isca) {
      return {
        meta: [
          { title: "Material não encontrado · Pólia" },
          { name: "robots", content: "noindex, nofollow" },
        ],
      };
    }
    return {
      meta: [
        { title: `${isca.titulo} · Pólia` },
        { name: "description", content: isca.descricao },
        { property: "og:title", content: isca.titulo },
        { property: "og:description", content: isca.subtitulo },
      ],
      links: [linkCanonico(`/materiais/${params.slug}`)],
    };
  },
  component: MaterialPage,
  notFoundComponent: MaterialNaoEncontrado,
});

function emailValido(valor: string): boolean {
  return z.string().email().safeParse(valor.trim()).success;
}

/** Mesma régua do servidor (iscas.functions.ts): DDD válido, celular com o 9. */
function telefoneValido(valor: string): boolean {
  return whatsappDaConta(valor) !== null;
}

/** Sem resposta em 8s, trata como falha de rede. A promessa original segue e é descartada. */
function comTimeout<T>(promessa: Promise<T>): Promise<T> {
  return Promise.race([
    promessa,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
  ]);
}

/** Dispara o download sem sair da página (mesmo truque do /manual). */
function iniciarDownload(url: string, nomeArquivo: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ── Casca ───────────────────────────────────────────────────────────────────
// Igual à do /manual: sem SiteHeader, sem link no wordmark. A página é destino
// de link do Direct, não tem rota de fuga pro resto do site. O rodapé é o
// mínimo que a LGPD pede: privacidade, termos e o perfil.
function Casca({ children }: { children: ReactNode }) {
  return (
    <div className="polia-v3 flex min-h-screen flex-col bg-[var(--bg)] text-[var(--ink)]">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="border-b border-[var(--line)] bg-[var(--bg)]">
        <div className={`${CONTAINER} flex items-center py-4 md:py-5`}>
          <PoliaWordmark className="h-6 w-auto" />
        </div>
      </header>
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-[var(--line)] py-8 text-[14px] text-[var(--ink-soft)] md:py-12">
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
              @polialab
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

// ── Título com o grifo amarelo no trecho de destaque ───────────────────────
function TituloComDestaque({ isca }: { isca: Isca }) {
  const { titulo, destaque } = isca;
  const i = destaque ? titulo.indexOf(destaque) : -1;
  if (!destaque || i < 0) return <>{titulo}</>;
  return (
    <>
      {titulo.slice(0, i)}
      <HighlightWord delay={0.3}>{destaque}</HighlightWord>
      {titulo.slice(i + destaque.length)}
    </>
  );
}

// ── Cartão do pedido: formulário e, depois, o "pronto" ──────────────────────
function CartaoPedido({
  isca,
  origem,
  aviso,
}: {
  isca: Isca;
  origem: string | undefined;
  aviso: "link" | "erro" | undefined;
}) {
  const ts = useTurnstile();
  const reduceMotion = useReducedMotion();
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [aceite, setAceite] = useState(false);
  const [erroEmail, setErroEmail] = useState<string | undefined>();
  const [erroTelefone, setErroTelefone] = useState<string | undefined>();
  const [erroEnvio, setErroEnvio] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);
  const [hp, setHp] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const telefoneRef = useRef<HTMLInputElement>(null);
  const prontoRef = useRef<HTMLHeadingElement>(null);

  const ids = {
    titulo: `isca-${isca.slug}-titulo`,
    email: `isca-${isca.slug}-email`,
    telefone: `isca-${isca.slug}-whatsapp`,
    consent: `isca-${isca.slug}-consent`,
  };
  const evento = { isca: isca.slug, origem: origem ?? isca.origemPadrao };

  const podeEnviar = emailValido(email) && telefoneValido(telefone) && aceite && !enviando;

  // A tela troca no lugar do formulário; o foco vai junto pra quem usa leitor
  // de tela ouvir o "pronto" em vez de silêncio.
  useEffect(() => {
    if (downloadUrl) prontoRef.current?.focus();
  }, [downloadUrl]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (hp) return;
    if (!emailValido(email)) {
      setErroEmail(ERRO_EMAIL);
      emailRef.current?.focus();
      return;
    }
    if (!telefoneValido(telefone)) {
      setErroTelefone(ERRO_TELEFONE);
      telefoneRef.current?.focus();
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
        gravarLeadIsca({
          data: {
            slug: isca.slug,
            email: email.trim(),
            telefone,
            consentimento: true,
            origem,
            turnstileToken: ts.token,
          },
        }),
      );
      if (!r.ok) {
        ts.reset();
        if (r.motivo === "telefone") {
          setErroTelefone(ERRO_TELEFONE);
          telefoneRef.current?.focus();
        } else {
          setErroEnvio(r.motivo === "turnstile" ? ERRO_TURNSTILE : ERRO_REDE);
        }
        setEnviando(false);
        return;
      }
      track("isca_lead_gravado", evento);
      gtagEvent("isca_lead_gravado", evento);
      // Lead só pra inscrição nova nesta isca: pedir de novo já converteu
      // antes e não conta outra vez pro anúncio.
      if (r.eventId) {
        pixelLead(r.eventId);
        tiktokLead(r.eventId, { email: email.trim(), telefone }, `isca_${isca.slug}`);
      }
      setDownloadUrl(r.downloadUrl);
      iniciarDownload(r.downloadUrl, isca.nomeArquivo);
    } catch (erro) {
      console.error("[Iscas] Falha ao gravar o lead:", erro);
      ts.reset();
      setErroEnvio(ERRO_REDE);
      setEnviando(false);
    }
  }

  return (
    <AnimatePresence mode="wait">
      {downloadUrl ? (
        <motion.div
          key="pronto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="rounded-2xl border border-[var(--line)] bg-white p-6 md:p-8"
        >
          <Eyebrow>Pronto</Eyebrow>
          <h2
            ref={prontoRef}
            tabIndex={-1}
            className="mt-3 text-[clamp(1.5rem,4vw,1.9rem)] font-bold leading-[1.15] tracking-[-0.02em] text-balance outline-none"
          >
            O PDF está a caminho.
          </h2>
          <p className="mt-4 text-[16px] leading-[1.6] text-[var(--ink-soft)]">
            O download começou automaticamente. Se o navegador segurou, o botão abaixo baixa de
            novo.
          </p>
          <a
            href={downloadUrl}
            download={isca.nomeArquivo}
            className={`${BTN_PRIMARIO} mt-6 ${CTA_LARGO}`}
            onClick={() => {
              track("isca_download_clicado", evento);
              gtagEvent("isca_download_clicado", evento);
            }}
          >
            Baixar o PDF
          </a>
          <p className="mt-6 text-[15px] leading-[1.6] text-[var(--ink-soft)]">
            Uma cópia também foi pro seu e-mail, pra ficar guardada. Abriu pelo Instagram e o
            arquivo não apareceu? O link do e-mail baixa em qualquer navegador.
          </p>
          <div className="mt-6 border-t border-[var(--line)] pt-6">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${BTN_CONTORNO} ${CTA_LARGO}`}
            >
              Voltar pro @polialab
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          onSubmit={enviar}
          noValidate
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.15, ease: [0.23, 1, 0.32, 1] }}
          className="rounded-2xl border border-[var(--line)] bg-white p-6 md:p-8"
          aria-labelledby={ids.titulo}
        >
          <h2
            id={ids.titulo}
            className="text-[clamp(1.35rem,3.4vw,1.6rem)] font-bold leading-[1.15] tracking-[-0.02em]"
          >
            Onde a Pólia entrega {isca.nomeCurto}?
          </h2>
          <p className="mt-2 text-[15px] leading-[1.55] text-[var(--ink-soft)]">
            O download começa na hora e uma cópia vai pro seu e-mail.
          </p>

          {aviso && (
            <p
              role="status"
              className="mt-4 rounded-xl bg-[var(--surface-pink)] px-4 py-3 text-[14px] leading-[1.5] text-[var(--ink)]"
            >
              {aviso === "link"
                ? `Esse link de download não funcionou. Pede ${isca.nomeCurto} de novo aqui que a Pólia manda outro.`
                : `O download não saiu agora. Pede ${isca.nomeCurto} de novo, ou tenta pelo link do e-mail daqui a pouco.`}
            </p>
          )}

          <div className="mt-6 grid gap-4">
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
                htmlFor={ids.email}
                className="mb-2 block text-[14px] font-semibold text-[var(--ink-soft)]"
              >
                Seu melhor e-mail
              </label>
              <input
                id={ids.email}
                ref={emailRef}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                required
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
                aria-describedby={erroEmail ? `${ids.email}-erro` : undefined}
                className={`${CAMPO} ${erroEmail ? CAMPO_ERRO : CAMPO_OK}`}
              />
              <FieldError id={`${ids.email}-erro`}>{erroEmail}</FieldError>
            </div>

            <div>
              <label
                htmlFor={ids.telefone}
                className="mb-2 block text-[14px] font-semibold text-[var(--ink-soft)]"
              >
                Seu WhatsApp com DDD
              </label>
              <input
                id={ids.telefone}
                ref={telefoneRef}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                required
                placeholder="(11) 99999-9999"
                value={telefone}
                onChange={(e) => {
                  setTelefone(mascararTelefone(e.target.value));
                  if (erroTelefone) setErroTelefone(undefined);
                }}
                onBlur={() => {
                  if (telefone.trim() && !telefoneValido(telefone)) setErroTelefone(ERRO_TELEFONE);
                }}
                aria-invalid={!!erroTelefone || undefined}
                aria-describedby={erroTelefone ? `${ids.telefone}-erro` : undefined}
                className={`${CAMPO} ${erroTelefone ? CAMPO_ERRO : CAMPO_OK}`}
              />
              <FieldError id={`${ids.telefone}-erro`}>{erroTelefone}</FieldError>
            </div>

            {/* O link fica FORA do <label> de propósito: dentro, clicar nele conta
            como clique no label e marca/desmarca o consentimento junto. */}
            <div className="flex items-start gap-3 text-[14px] leading-[1.5] text-[var(--ink-soft)]">
              <input
                id={ids.consent}
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
                className="mt-[2px] h-[18px] w-[18px] flex-none accent-[var(--secondary)]"
              />
              <span>
                <label htmlFor={ids.consent} className="cursor-pointer">
                  {isca.consentTexto}
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
            {ts.erroCarregamento && (
              <p role="alert" className="text-[14px] leading-[1.5] text-[var(--danger)]">
                {ERRO_TURNSTILE_CARREGAMENTO}
              </p>
            )}

            <button
              type="submit"
              disabled={!podeEnviar}
              className={`${BTN_PRIMARIO} min-h-[52px] w-full disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0`}
            >
              {enviando ? "Enviando…" : isca.cta}
              {!enviando && <span aria-hidden="true">→</span>}
            </button>

            {erroEnvio && (
              <p role="alert" className="text-[14px] leading-[1.5] text-[var(--danger)]">
                {erroEnvio}
              </p>
            )}
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────
function MaterialPage() {
  const { isca } = Route.useLoaderData();
  const { origem, aviso } = Route.useSearch();

  return (
    <Casca>
      <section className={`${CONTAINER} py-[clamp(32px,7vw,96px)]`}>
        {/* No celular a ordem é título, formulário, o que tem dentro. No
        desktop o formulário vai pra coluna da direita, ao lado dos dois. */}
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-x-16 lg:gap-y-12">
          <div className="lg:col-start-1">
            <Eyebrow>{isca.rotulo}</Eyebrow>
            {/* h1 fora do <Reveal> de propósito (LCP), como na Home. */}
            <h1 className="mt-4 text-[clamp(2rem,6vw,3.6rem)] font-bold leading-[1.04] tracking-[-0.02em] text-balance">
              <TituloComDestaque isca={isca} />
            </h1>
            <p className="mt-4 max-w-[48ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
              {isca.subtitulo}
            </p>
          </div>

          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <Reveal delay={0.1}>
              <CartaoPedido isca={isca} origem={origem} aviso={aviso} />
            </Reveal>
          </div>

          <div className="lg:col-start-1">
            <Reveal>
              <h2 className="text-[clamp(1.35rem,3vw,1.75rem)] font-bold leading-[1.15] tracking-[-0.02em]">
                O que tem dentro
              </h2>
            </Reveal>
            <RevealGroup className="mt-4 grid gap-3">
              {isca.bullets.map((b) => (
                <RevealItem key={b} className="flex items-start gap-3 text-[16px] leading-[1.5]">
                  <span
                    aria-hidden="true"
                    className="mt-[3px] grid h-5 w-5 flex-none place-items-center rounded-md bg-[var(--secondary-light)]"
                  >
                    <Check className="h-3.5 w-3.5 text-[var(--ink)]" />
                  </span>
                  {b}
                </RevealItem>
              ))}
            </RevealGroup>
            <p className="mt-6 text-[16px] font-semibold leading-[1.6] text-[var(--ink)]">
              Um PDF gratuito, pra abrir no celular ou imprimir.
            </p>
          </div>
        </div>
      </section>
    </Casca>
  );
}

// ── 404 amigável: slug que não está no catálogo ─────────────────────────────
function MaterialNaoEncontrado() {
  return (
    <Casca>
      <section className={`${CONTAINER} ${SECAO}`}>
        <Eyebrow>Material gratuito</Eyebrow>
        <h1 className="mt-4 max-w-[20ch] text-[clamp(1.9rem,5vw,3rem)] font-bold leading-[1.08] tracking-[-0.02em] text-balance">
          Esse material não está aqui.
        </h1>
        <p className="mt-4 max-w-[46ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
          O link pode ter vindo cortado no Direct, ou o material saiu do ar. Os materiais novos
          aparecem primeiro no Instagram da Pólia.
        </p>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`${BTN_PRIMARIO} mt-8 ${CTA_LARGO}`}
        >
          Ir pro @polialab
          <span aria-hidden="true">→</span>
        </a>
      </section>
    </Casca>
  );
}
