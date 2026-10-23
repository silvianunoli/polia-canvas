import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useId, useRef, useState } from "react";
import { useTurnstile } from "@/hooks/useTurnstile";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { usoDaCor } from "@/lib/orcamentos";
import { normalizarWhatsapp } from "@/lib/leads";
import { enviarLead, lerLinkPublico, type LinkPublico } from "@/lib/captura.functions";

// Link de captura que a usuária põe na bio, no status ou num QR (VND-04). A
// pessoa deixa nome, WhatsApp e o que procura, e cai em Clientes como
// "Primeiro contato". A página fala em nome da marca da usuária; a Pólia
// aparece só no rodapé. Cor da marca em style inline, como no orçamento
// público (o.$token.tsx): é dado da usuária, não token.

type Leitura = { ok: true; link: LinkPublico } | { ok: false; motivo: "nao_existe" | "rede" };

const SLUG = /^[a-z0-9-]{3,40}$/i;

export const Route = createFileRoute("/l/$slug")({
  loader: async ({ params }): Promise<Leitura> => {
    if (!SLUG.test(params.slug)) return { ok: false, motivo: "nao_existe" };
    try {
      const r = await lerLinkPublico({ data: { slug: params.slug } });
      return r.ok ? r : { ok: false, motivo: "nao_existe" };
    } catch {
      return { ok: false, motivo: "rede" };
    }
  },
  head: ({ loaderData }) => {
    const link = loaderData?.ok ? loaderData.link : null;
    const titulo = link?.marca.nome ?? "Contato";
    const descricao = link?.titulo ?? "Deixe seu nome e WhatsApp.";
    // A prévia no WhatsApp e no Instagram tem que ser da marca dela.
    return {
      meta: [
        { title: titulo },
        { name: "robots", content: "noindex, nofollow" },
        { name: "referrer", content: "no-referrer" },
        { name: "description", content: descricao },
        { property: "og:title", content: titulo },
        { property: "og:description", content: descricao },
        { property: "og:image", content: link?.marca.logoUrl ?? "" },
        { property: "og:url", content: "" },
        { name: "twitter:title", content: titulo },
        { name: "twitter:description", content: descricao },
        { name: "twitter:image", content: link?.marca.logoUrl ?? "" },
      ],
    };
  },
  component: LinkCapturaPage,
});

function LinkCapturaPage() {
  const leitura = Route.useLoaderData();
  const { slug } = Route.useParams();
  const router = useRouter();
  const [tentando, setTentando] = useState(false);

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <main id="conteudo" className="mx-auto w-full max-w-[520px] py-0 sm:px-4 sm:py-6 md:py-12">
        {leitura.ok ? (
          <Formulario link={leitura.link} slug={slug} />
        ) : leitura.motivo === "rede" ? (
          <div role="alert" className="px-4 py-8 sm:px-0">
            <h1 className="font-cabinet text-[28px] leading-tight tracking-[-0.02em]">
              A página não carregou
            </h1>
            <p className="mt-3 text-[16px] leading-relaxed text-[var(--ink-soft)]">
              Pode ser a conexão. O link continua valendo.
            </p>
            <button
              type="button"
              disabled={tentando}
              onClick={() => {
                setTentando(true);
                void router.invalidate().finally(() => setTentando(false));
              }}
              className="mt-4 inline-flex min-h-11 items-center rounded-xl border-[1.5px] border-[var(--ink)] px-5 text-[15px] font-semibold disabled:opacity-60"
            >
              {tentando ? "Tentando…" : "Tentar de novo"}
            </button>
          </div>
        ) : (
          <div role="alert" className="px-4 py-8 sm:px-0">
            <h1 className="font-cabinet text-[28px] leading-tight tracking-[-0.02em]">
              Esse link não está recebendo contatos
            </h1>
            <p className="mt-3 text-[16px] leading-relaxed text-[var(--ink-soft)]">
              Pode ter vindo cortado ou ter sido desligado. Fale com a marca pelo perfil onde você
              achou o link.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-3 text-[16px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

function Formulario({ link, slug }: { link: LinkPublico; slug: string }) {
  const marca = link.marca.nome;
  const cor = usoDaCor(link.marca.cor);
  const corDoTexto = cor.texto === "claro" ? "white" : "var(--ink)";
  const deQuem = marca ? `de ${marca}` : "da marca";
  const praQuem = marca ? `pra ${marca}` : "pra marca";
  const ts = useTurnstile();
  const ids = { nome: useId(), whats: useId(), interesse: useId(), dica: useId() };
  const hpRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [interesse, setInteresse] = useState("");
  const [aceite, setAceite] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const nomeErro = tentou && !nome.trim() ? "Escreva seu nome." : undefined;
  const whatsErro =
    tentou && !normalizarWhatsapp(whatsapp) ? "Confira o número, com DDD." : undefined;
  const estiloBotao =
    cor.modo === "fundo" ? { backgroundColor: link.marca.cor!, color: corDoTexto } : undefined;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (!nome.trim()) {
      document.getElementById(ids.nome)?.focus();
      return;
    }
    if (!normalizarWhatsapp(whatsapp)) {
      document.getElementById(ids.whats)?.focus();
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const r = await enviarLead({
        data: {
          slug,
          nome: nome.trim(),
          whatsapp,
          interesse: interesse.trim() || undefined,
          consentimento: aceite,
          turnstileToken: ts.token ?? undefined,
          hp: hpRef.current?.value || undefined,
        },
      });
      if (r.ok) {
        setEnviado(true);
        return;
      }
      ts.reset();
      setErro(
        r.motivo === "turnstile"
          ? "A verificação anti-robô não passou. Marque de novo a caixa acima e tente."
          : r.motivo === "whatsapp"
            ? "Confira o número do WhatsApp, com DDD."
            : r.motivo === "indisponivel"
              ? "Esse link deixou de receber contatos agora há pouco."
              : r.motivo === "limite"
                ? "Esse link recebeu muitos contatos hoje. Tente de novo amanhã."
                : "Não deu pra enviar agora. Tente de novo em instantes.",
      );
    } catch {
      ts.reset();
      setErro("Não deu pra enviar agora. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  };

  const esperandoVerificacao = !ts.token && !ts.erroCarregamento;

  return (
    <article className="overflow-hidden border-[var(--line)] bg-white sm:rounded-2xl sm:border">
      {cor.modo === "faixa" && (
        <div aria-hidden="true" className="h-2" style={{ backgroundColor: link.marca.cor! }} />
      )}
      <header
        className={`flex flex-wrap items-center gap-4 px-5 py-5 md:px-8 ${cor.modo === "fundo" ? "" : "bg-[var(--surface)]"}`}
        style={
          cor.modo === "fundo" ? { backgroundColor: link.marca.cor!, color: corDoTexto } : undefined
        }
      >
        {link.marca.logoUrl && (
          <img
            src={link.marca.logoUrl}
            alt={marca ? `Logo de ${marca}` : "Logo"}
            className="h-14 w-14 rounded-lg bg-white object-contain p-1"
          />
        )}
        <div className="min-w-0">
          <h1 className="font-cabinet text-[22px] leading-tight tracking-[-0.02em]">
            {marca ?? link.titulo ?? "Deixe seu contato"}
          </h1>
          {marca && <p className="mt-0.5 text-[15px]">{link.titulo ?? "Deixe seu contato"}</p>}
        </div>
      </header>

      <div className="px-5 py-6 md:px-8">
        {enviado ? (
          <div role="status">
            <p className="font-cabinet text-[24px] tracking-[-0.02em]">Recebido.</p>
            <p className="mt-2 text-[16px] leading-relaxed text-[var(--ink-soft)]">
              {marca ? `${marca} vai` : "A marca vai"} falar com você pelo WhatsApp.
            </p>
          </div>
        ) : (
          <form onSubmit={(e) => void enviar(e)} noValidate>
            <div>
              <label htmlFor={ids.nome} className="mb-1 block text-[14px] text-[var(--ink-soft)]">
                Seu nome
              </label>
              <input
                id={ids.nome}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="name"
                maxLength={120}
                aria-invalid={!!nomeErro}
                aria-describedby={nomeErro ? `${ids.nome}-e` : undefined}
                className={INPUT}
              />
              {nomeErro && (
                <p id={`${ids.nome}-e`} className="mt-1 text-[13px] text-[var(--danger)]">
                  {nomeErro}
                </p>
              )}
            </div>
            <div className="mt-4">
              <label htmlFor={ids.whats} className="mb-1 block text-[14px] text-[var(--ink-soft)]">
                WhatsApp
              </label>
              <input
                id={ids.whats}
                type="tel"
                inputMode="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                autoComplete="tel"
                maxLength={30}
                placeholder="(11) 98888-0000"
                aria-invalid={!!whatsErro}
                aria-describedby={whatsErro ? `${ids.whats}-e` : undefined}
                className={INPUT}
              />
              {whatsErro && (
                <p id={`${ids.whats}-e`} className="mt-1 text-[13px] text-[var(--danger)]">
                  {whatsErro}
                </p>
              )}
            </div>
            <div className="mt-4">
              <label
                htmlFor={ids.interesse}
                className="mb-1 block text-[14px] text-[var(--ink-soft)]"
              >
                {link.pergunta ?? "O que você procura?"}{" "}
                <span className="text-[var(--muted)]">(opcional)</span>
              </label>
              <textarea
                id={ids.interesse}
                value={interesse}
                onChange={(e) => setInteresse(e.target.value)}
                maxLength={500}
                rows={3}
                className={`${INPUT} resize-y`}
              />
            </div>
            <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 text-[15px] text-[var(--ink)]">
              <input
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--secondary-text)]"
              />
              Aceito receber mensagens {deQuem} no WhatsApp
            </label>

            {/* Honeypot: invisível, fora da tabulação e com nome que nenhum
                preenchimento automático reconhece. */}
            <input
              ref={hpRef}
              type="text"
              name="hp_lead_x"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
            />
            <div className="mt-4">
              <TurnstileWidget containerRef={ts.containerRef} />
            </div>
            {ts.erroCarregamento && (
              <p className="mt-2 text-[13px] text-[var(--danger)]">
                A verificação anti-robô não carregou. Desligue o bloqueador de anúncios desta página
                ou abra em outro navegador.
              </p>
            )}
            <button
              type="submit"
              disabled={enviando || !ts.token}
              aria-describedby={esperandoVerificacao ? ids.dica : undefined}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl border-[1.5px] border-[var(--ink)] px-6 text-[16px] font-semibold transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              style={estiloBotao}
            >
              {enviando ? "Enviando…" : "Enviar"}
            </button>
            {esperandoVerificacao && (
              <p id={ids.dica} className="mt-2 text-[13px] text-[var(--muted)]">
                Confirme a caixa acima pra liberar o botão.
              </p>
            )}
            {erro && (
              <p role="alert" className="mt-2 text-[14px] text-[var(--danger)]">
                {erro}
              </p>
            )}
            <p className="mt-5 text-[12px] leading-relaxed text-[var(--muted)]">
              Seu nome e WhatsApp vão só {praQuem}, que guarda na Pólia One.{" "}
              <Link to="/privacidade" className="underline">
                Política de privacidade
              </Link>
            </p>
          </form>
        )}
      </div>

      <footer className="border-t border-[var(--line)] px-5 py-4 text-[12px] text-[var(--muted)] md:px-8">
        Página feita na{" "}
        <a
          href="https://one.usepolia.com.br/?utm_source=link&utm_medium=captura"
          target="_blank"
          rel="noopener"
          className="underline"
        >
          Pólia One
        </a>
        .
      </footer>
    </article>
  );
}
