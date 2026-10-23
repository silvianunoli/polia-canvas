import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useId, useRef, useState } from "react";
import { useTurnstile } from "@/hooks/useTurnstile";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { formatarReais } from "@/lib/formatarReais";
import { dataISOLocal } from "@/lib/data.functions";
import { usoDaCor } from "@/lib/orcamentos";
import {
  aprovarOrcamento,
  lerOrcamentoPublico,
  type OrcamentoPublico,
} from "@/lib/orcamentos.functions";

// Orçamento que a cliente da usuária abre pelo link (ONE-129). Sem login: a
// leitura (no loader, pra prévia do link já sair com a marca dela) e a
// aprovação são server functions que acham a linha pelo token
// (lib/orcamentos.functions.ts). A página fala com a cliente em nome da marca
// da usuária; a Pólia aparece só no rodapé.
//
// A cor da marca é dado da usuária (profiles.cor_marca), por isso entra em
// style inline e não como token. usoDaCor decide se ela pinta o fundo (texto
// com contraste AA em cima) ou vira só uma faixa (cor de meio de escala).

type Leitura =
  | { ok: true; orcamento: OrcamentoPublico }
  | { ok: false; motivo: "nao_existe" | "rede" };

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/o/$token")({
  loader: async ({ params }): Promise<Leitura> => {
    if (!TOKEN.test(params.token)) return { ok: false, motivo: "nao_existe" };
    try {
      const r = await lerOrcamentoPublico({ data: { token: params.token } });
      return r.ok ? r : { ok: false, motivo: "nao_existe" };
    } catch {
      return { ok: false, motivo: "rede" };
    }
  },
  head: ({ loaderData }) => {
    const marca = loaderData?.ok ? loaderData.orcamento.marca : null;
    const titulo = marca?.nome ? `Orçamento de ${marca.nome}` : "Orçamento";
    // Sobrescreve a prévia da Pólia que vem do __root: no WhatsApp, o card do
    // link tem que ser da marca dela, não do fornecedor.
    return {
      meta: [
        { title: titulo },
        // Link privado: não entra em buscador.
        { name: "robots", content: "noindex, nofollow" },
        { name: "referrer", content: "no-referrer" },
        { name: "description", content: "Itens, total e botão pra aprovar." },
        { property: "og:title", content: titulo },
        { property: "og:description", content: "Itens, total e botão pra aprovar." },
        { property: "og:image", content: marca?.logoUrl ?? "" },
        { property: "og:url", content: "" },
        { name: "twitter:title", content: titulo },
        { name: "twitter:description", content: "Itens, total e botão pra aprovar." },
        { name: "twitter:image", content: marca?.logoUrl ?? "" },
      ],
    };
  },
  component: OrcamentoPublicoPage,
});

const fmt = (v: number) => formatarReais(v, { sempreCentavos: true });
/** dd/mm/aaaa no dia local (created_at vem em UTC). */
const dataBR = (isoOuData: string) =>
  (isoOuData.length > 10 ? dataISOLocal(new Date(isoOuData)) : isoOuData)
    .split("-")
    .reverse()
    .join("/");

function OrcamentoPublicoPage() {
  const leitura = Route.useLoaderData();
  const { token } = Route.useParams();
  const router = useRouter();
  const [tentando, setTentando] = useState(false);

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <main id="conteudo" className="mx-auto w-full max-w-[680px] py-0 sm:px-4 sm:py-6 md:py-12">
        {leitura.ok ? (
          // A key remonta quando a leitura nova chega (orçamento mudou ou encerrou).
          <Orcamento
            key={`${leitura.orcamento.versao}-${leitura.orcamento.status}`}
            inicial={leitura.orcamento}
            token={token}
          />
        ) : leitura.motivo === "rede" ? (
          <div role="alert" className="px-4 py-8 sm:px-0">
            <h1 className="font-cabinet text-[28px] leading-tight tracking-[-0.02em]">
              O orçamento não carregou
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
              Esse link não abre um orçamento
            </h1>
            <p className="mt-3 text-[16px] leading-relaxed text-[var(--ink-soft)]">
              Pode ter vindo cortado na mensagem ou ter sido retirado. Peça o link de novo pra quem
              mandou.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function Orcamento({ inicial, token }: { inicial: OrcamentoPublico; token: string }) {
  const [o, setO] = useState(inicial);
  const marca = o.marca.nome;
  const cor = usoDaCor(o.marca.cor);
  const corDoTexto = cor.texto === "claro" ? "white" : "var(--ink)";
  const quem = marca ?? "quem mandou o orçamento";

  return (
    <article className="overflow-hidden border-[var(--line)] bg-white sm:rounded-2xl sm:border">
      {cor.modo === "faixa" && (
        <div aria-hidden="true" className="h-2" style={{ backgroundColor: o.marca.cor! }} />
      )}
      <header
        className={`flex flex-wrap items-center gap-4 px-5 py-5 md:px-8 ${cor.modo === "fundo" ? "" : "bg-[var(--surface)]"}`}
        style={
          cor.modo === "fundo" ? { backgroundColor: o.marca.cor!, color: corDoTexto } : undefined
        }
      >
        {o.marca.logoUrl && (
          <img
            src={o.marca.logoUrl}
            alt={marca ? `Logo de ${marca}` : "Logo"}
            className="h-14 w-14 rounded-lg bg-white object-contain p-1"
          />
        )}
        <div className="min-w-0">
          {marca && (
            <p className="font-cabinet text-[22px] leading-tight tracking-[-0.02em]">{marca}</p>
          )}
          <h1
            className={marca ? "mt-0.5 text-[15px]" : "font-cabinet text-[22px] tracking-[-0.02em]"}
          >
            Orçamento nº {o.numero}
          </h1>
        </div>
      </header>

      <div className="px-5 py-6 md:px-8">
        <p className="text-[14px] text-[var(--ink-soft)]">
          {o.clienteNome ? `Pra ${o.clienteNome} · ` : ""}feito em {dataBR(o.criadoEm)} · vale até{" "}
          {dataBR(o.validade)}
        </p>

        <table className="mt-5 w-full text-[15px]">
          <caption className="sr-only">Itens do orçamento</caption>
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-[12px] text-[var(--muted)]">
              <th scope="col" className="pb-2 font-normal">
                Item
              </th>
              <th scope="col" className="pb-2 text-right font-normal">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {o.itens.map((i, idx) => (
              <tr key={idx} className="border-b border-[var(--line)] align-top">
                <td className="py-3 pr-3">
                  <span className="text-[var(--ink)]">{i.nome}</span>
                  {i.variacao && <span className="text-[var(--muted)]"> · {i.variacao}</span>}
                  <span className="block text-[13px] text-[var(--muted)]">
                    {i.quantidade} x {fmt(i.precoUnitario)}
                  </span>
                </td>
                <td className="py-3 text-right tabular-nums">
                  {fmt(i.quantidade * i.precoUnitario)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-4 space-y-1 text-[14px]">
          {(o.desconto > 0 || o.frete > 0) && (
            <div className="flex justify-between text-[var(--ink-soft)]">
              <dt>Itens</dt>
              <dd className="tabular-nums">{fmt(o.subtotal)}</dd>
            </div>
          )}
          {o.desconto > 0 && (
            <div className="flex justify-between text-[var(--ink-soft)]">
              <dt>Desconto</dt>
              <dd className="tabular-nums">-{fmt(o.desconto)}</dd>
            </div>
          )}
          {o.frete > 0 && (
            <div className="flex justify-between text-[var(--ink-soft)]">
              <dt>Frete</dt>
              <dd className="tabular-nums">{fmt(o.frete)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-[var(--line)] pt-3">
            <dt className="text-[15px] text-[var(--ink)]">Total</dt>
            <dd className="font-cabinet text-[30px] tabular-nums text-[var(--ink)]">
              {fmt(o.total)}
            </dd>
          </div>
        </dl>

        {o.observacao && (
          <div className="mt-5 rounded-lg bg-[var(--bg)] px-4 py-3">
            <p className="text-[12px] text-[var(--muted)]">Observações</p>
            <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-[var(--ink-soft)]">
              {o.observacao}
            </p>
          </div>
        )}

        <div className="mt-6" role="status" aria-live="polite">
          {o.status === "aprovado" ? (
            <p className="rounded-lg bg-[var(--secondary-light)] px-4 py-3 text-[15px] text-[var(--ink)]">
              Orçamento aprovado. Agora é combinar o pagamento e a entrega com {quem}.
            </p>
          ) : o.status === "convertido" ? (
            <p className="rounded-lg bg-[var(--secondary-light)] px-4 py-3 text-[15px] text-[var(--ink)]">
              Esse orçamento já virou pedido com {quem}.
            </p>
          ) : o.status === "cancelado" ? (
            <p className="text-[15px] text-[var(--ink-soft)]">
              Esse orçamento foi cancelado. Pra um novo, fale com {quem}.
            </p>
          ) : o.vencido ? (
            <p className="text-[15px] text-[var(--ink-soft)]">
              Esse orçamento venceu em {dataBR(o.validade)}. Pra um novo, fale com {quem}.
            </p>
          ) : (
            <Aprovar
              token={token}
              versao={o.versao}
              quem={quem}
              estiloBotao={
                cor.modo === "fundo"
                  ? { backgroundColor: o.marca.cor!, color: corDoTexto }
                  : { backgroundColor: "var(--secondary)", color: "var(--secondary-ink)" }
              }
              onAprovado={() => setO({ ...o, status: "aprovado" })}
            />
          )}
        </div>
      </div>

      <footer className="border-t border-[var(--line)] px-5 py-4 text-[12px] text-[var(--muted)] md:px-8">
        Orçamento feito na{" "}
        <a
          href="https://one.usepolia.com.br/?utm_source=orcamento&utm_medium=link"
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

/**
 * Montado só quando dá pra aprovar: o useTurnstile desenha o widget no mount,
 * e o container precisa existir nessa hora.
 */
function Aprovar({
  token,
  versao,
  quem,
  estiloBotao,
  onAprovado,
}: {
  token: string;
  versao: string;
  quem: string;
  estiloBotao: React.CSSProperties;
  onAprovado: () => void;
}) {
  const ts = useTurnstile();
  const router = useRouter();
  const dicaId = useId();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mudou, setMudou] = useState(false);
  const hpRef = useRef<HTMLInputElement>(null);

  const aprovar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      const r = await aprovarOrcamento({
        data: {
          token,
          versao,
          turnstileToken: ts.token ?? undefined,
          hp: hpRef.current?.value || undefined,
        },
      });
      if (r.ok) {
        onAprovado();
        return;
      }
      if (r.motivo === "mudou") {
        setMudou(true);
        return;
      }
      if (r.motivo === "vencido" || r.motivo === "cancelado") {
        // Recarrega com o orçamento como está agora: a página mostra o porquê.
        await router.invalidate();
        return;
      }
      ts.reset();
      setErro(
        r.motivo === "turnstile"
          ? "A verificação anti-robô não passou. Marque de novo a caixa acima e tente."
          : "Não deu pra aprovar agora. Tente de novo em instantes.",
      );
    } catch {
      ts.reset();
      setErro("Não deu pra aprovar agora. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  };

  const esperandoVerificacao = !ts.token && !ts.erroCarregamento;

  return (
    <div>
      <p className="text-[14px] text-[var(--ink-soft)]">
        Ao aprovar, {quem} fica sabendo pra combinar o pagamento e a entrega.
      </p>
      {/* Honeypot: invisível, fora da tabulação e com nome que nenhum
          preenchimento automático reconhece. */}
      <input
        ref={hpRef}
        type="text"
        name="hp_orc_x"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <TurnstileWidget containerRef={ts.containerRef} />
      {ts.erroCarregamento && (
        <p className="mt-2 text-[13px] text-[var(--danger)]">
          A verificação anti-robô não carregou. Desligue o bloqueador de anúncios desta página ou
          abra em outro navegador.
        </p>
      )}
      <button
        type="button"
        onClick={() => void aprovar()}
        disabled={enviando || !ts.token}
        aria-describedby={esperandoVerificacao ? dicaId : undefined}
        className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl border-[1.5px] border-[var(--ink)] px-6 text-[16px] font-semibold transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        style={estiloBotao}
      >
        {enviando ? "Aprovando…" : "Aprovar orçamento"}
      </button>
      {esperandoVerificacao && (
        <p id={dicaId} className="mt-2 text-[13px] text-[var(--muted)]">
          Confirme a caixa acima pra liberar o botão.
        </p>
      )}
      {erro && (
        <p role="alert" className="mt-2 text-[14px] text-[var(--danger)]">
          {erro}
        </p>
      )}
      {mudou && (
        <div role="alert" className="mt-3 rounded-lg bg-[var(--bg)] px-4 py-3 text-[14px]">
          <p className="text-[var(--ink)]">
            O orçamento foi atualizado depois que você abriu. Veja a versão nova antes de aprovar.
          </p>
          <button
            type="button"
            onClick={() => void router.invalidate()}
            className="mt-1 inline-flex min-h-11 items-center font-medium text-[var(--secondary-text)] hover:underline"
          >
            Ver a versão atualizada
          </button>
        </div>
      )}
    </div>
  );
}
