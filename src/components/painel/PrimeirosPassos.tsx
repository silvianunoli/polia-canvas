import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check } from "lucide-react";

import { LinkInterno } from "@/components/ui/LinkInterno";
import { BTN_ACAO, BTN_MIUDO_ACAO } from "@/lib/botoes";
import {
  CTA_PRECO,
  ESCOLHAS_ESTAGIO,
  ESCOLHAS_TIPO,
  NOME_MARCA_MAX,
  ORDEM_PASSOS,
  PASSO_MODULO_1,
  PASSO_NOME,
  hrefCalculadora,
  perguntaEstagio,
  textoPassoPreco,
  tipoPrecoDaEscolha,
  type EscolhaTipo,
  type EstagioNegocio,
  type IdPasso,
  type NichoDoPasso,
  type ProgressoPrimeirosPassos,
} from "@/lib/primeirosPassos";
import { ESCOLHAS_NICHO, type NichoNegocio } from "@/lib/nichoNegocio";

const ROTULO = "font-accent text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]";

/**
 * Bloco "Primeiros passos" do topo do Painel (14/10/2026, desenho em cinza
 * aprovado pela Sil). Três passos numerados; o primeiro não feito fica em
 * destaque (fundo, sem faixa lateral) e é o único com ação, pra a tela ter um
 * recado só. Feito ganha o check e o destaque desce. Com os três feitos o
 * Painel deixa de renderizar o bloco.
 *
 * Nicho obrigatório (23/10/2026, pedido da Sil): sem nicho salvo, a pergunta
 * abre o bloco e os passos ficam sem ação até ela responder. Não é passo, não
 * conta no "N de 3".
 */
export function PrimeirosPassos({
  progresso,
  nicho,
  escolhaSalva,
  onEscolherTipo,
  estagioSalvo,
  onEscolherEstagio,
  nichoSalvo,
  onEscolherNicho,
  onSalvarNome,
}: {
  progresso: ProgressoPrimeirosPassos;
  nicho: NichoDoPasso | null;
  escolhaSalva: EscolhaTipo | null;
  onEscolherTipo: (e: EscolhaTipo) => Promise<boolean>;
  estagioSalvo: EstagioNegocio | null;
  onEscolherEstagio: (e: EstagioNegocio) => Promise<boolean>;
  nichoSalvo: NichoNegocio | null;
  onEscolherNicho: (n: NichoNegocio) => Promise<boolean>;
  onSalvarNome: (nome: string) => Promise<boolean>;
}) {
  const tituloId = useId();
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const preco = textoPassoPreco(nicho);

  const textos: Record<IdPasso, { titulo: string; subtitulo: string }> = {
    preco: { titulo: preco.titulo, subtitulo: preco.subtitulo },
    "modulo-1": { titulo: PASSO_MODULO_1.titulo, subtitulo: PASSO_MODULO_1.subtitulo },
    nome: { titulo: PASSO_NOME.titulo, subtitulo: PASSO_NOME.subtitulo },
  };

  const acao = (id: IdPasso): ReactNode => {
    if (id === "preco") {
      return preco.perguntaTipo ? (
        <EscolhaDoTipo escolhaSalva={escolhaSalva} onEscolher={onEscolherTipo} />
      ) : (
        <LinkInterno href={hrefCalculadora(nicho!.tipo)} className={`${BTN_ACAO} mt-4`}>
          {CTA_PRECO}
          <span aria-hidden="true">→</span>
        </LinkInterno>
      );
    }
    if (id === "modulo-1") {
      return (
        <LinkInterno href={PASSO_MODULO_1.href} className={`${BTN_ACAO} mt-4`}>
          {PASSO_MODULO_1.acao}
          <span aria-hidden="true">→</span>
        </LinkInterno>
      );
    }
    return (
      <CampoNome
        onSalvar={async (nome) => {
          const ok = await onSalvarNome(nome);
          // O campo some quando salva. Sem isto o foco caía no <body>; vai pro
          // rótulo do bloco. Se era o último passo o bloco sai, e o Painel
          // leva o foco pra manchete.
          const eraOUltimo = progresso.totalFeitos === ORDEM_PASSOS.length - 1;
          if (ok && !eraOUltimo) requestAnimationFrame(() => tituloRef.current?.focus());
          return ok;
        }}
      />
    );
  };

  return (
    <section
      aria-labelledby={tituloId}
      className="mt-6 max-w-[640px] rounded-xl border border-[var(--line)] bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 id={tituloId} ref={tituloRef} tabIndex={-1} className={`${ROTULO} outline-none`}>
          Primeiros passos
        </h2>
        <span className="text-[13px] tabular-nums text-[var(--muted)]">
          {progresso.totalFeitos} de {ORDEM_PASSOS.length}
        </span>
      </div>

      {!nichoSalvo && (
        <PerguntaNicho
          onEscolher={async (n) => {
            const ok = await onEscolherNicho(n);
            // Com os três passos feitos o bloco sai e o Painel cuida do foco;
            // senão a pergunta some e o foco vai pro rótulo do bloco.
            if (ok && !progresso.completo) requestAnimationFrame(() => tituloRef.current?.focus());
            return ok;
          }}
        />
      )}

      <ol className="mt-3 space-y-1">
        {ORDEM_PASSOS.map((id, i) => {
          const feito = progresso.feitos[id];
          const emDestaque = progresso.destaque === id;
          return (
            <li
              key={id}
              aria-current={emDestaque ? "step" : undefined}
              className={`flex gap-3 rounded-lg p-3 sm:p-4 ${emDestaque ? "bg-[var(--surface)]" : ""}`}
            >
              <span
                aria-hidden="true"
                className={`mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums ${
                  feito
                    ? "bg-[var(--ink)] text-white"
                    : emDestaque
                      ? "bg-[var(--secondary)] text-[var(--secondary-ink)]"
                      : "border border-[var(--line)] text-[var(--muted)]"
                }`}
              >
                {feito ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3
                  className={`font-cabinet text-[17px] leading-tight ${
                    feito ? "text-[var(--muted)]" : "text-[var(--ink)]"
                  }`}
                >
                  <span className="sr-only">{feito ? "Feito: " : "Falta: "}</span>
                  {textos[id].titulo}
                </h3>
                {!feito && (
                  <p
                    id={`primeiros-passos-sub-${id}`}
                    className={`mt-1 text-[14px] leading-snug ${
                      emDestaque ? "text-[var(--ink-soft)]" : "text-[var(--muted)]"
                    }`}
                  >
                    {textos[id].subtitulo}
                  </p>
                )}
                {emDestaque && nichoSalvo && acao(id)}
              </div>
            </li>
          );
        })}
      </ol>

      {perguntaEstagio(progresso.feitos.preco, estagioSalvo) && (
        <PerguntaEstagio onEscolher={onEscolherEstagio} />
      )}
    </section>
  );
}

/**
 * "Qual é o nicho da marca?" em um clique, antes dos passos. Obrigatória: não
 * tem "pular", e os passos só ganham ação depois dela. Grava na hora e some.
 */
function PerguntaNicho({ onEscolher }: { onEscolher: (n: NichoNegocio) => Promise<boolean> }) {
  const [salvando, setSalvando] = useState<NichoNegocio | null>(null);
  const rotuloId = useId();

  async function escolher(n: NichoNegocio) {
    if (salvando) return;
    setSalvando(n);
    const ok = await onEscolher(n);
    if (!ok) setSalvando(null);
  }

  return (
    <div className="mt-3 rounded-lg bg-[var(--surface)] p-3 sm:p-4">
      <h3 id={rotuloId} className="font-cabinet text-[17px] leading-tight text-[var(--ink)]">
        Antes dos passos: qual é o nicho da marca?
      </h3>
      <p className="mt-1 text-[14px] leading-snug text-[var(--ink-soft)]">
        A Pólia One usa o nicho pra separar as ideias de post do seu ramo.
      </p>
      <div role="group" aria-labelledby={rotuloId} className="mt-3 grid gap-2 sm:grid-cols-2">
        {ESCOLHAS_NICHO.map((o) => (
          <button
            key={o.valor}
            type="button"
            aria-busy={salvando === o.valor || undefined}
            disabled={!!salvando}
            onClick={() => void escolher(o.valor)}
            className="flex min-h-11 flex-col items-start rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-left transition-colors hover:border-[var(--ink-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="text-[14px] font-medium text-[var(--ink)]">
              {salvando === o.valor ? "Salvando..." : o.rotulo}
            </span>
            <span className="text-[12px] text-[var(--muted)]">{o.exemplos}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Uma pergunta de um clique, fora da lista numerada (não é passo, não conta no
 * "N de 3"). Some quando a resposta grava. Serve pra a Pólia One saber se fala
 * com quem já vende ou com quem ainda está na ideia.
 */
function PerguntaEstagio({ onEscolher }: { onEscolher: (e: EstagioNegocio) => Promise<boolean> }) {
  const [salvando, setSalvando] = useState<EstagioNegocio | null>(null);
  const rotuloId = useId();

  async function escolher(e: EstagioNegocio) {
    if (salvando) return;
    setSalvando(e);
    const ok = await onEscolher(e);
    if (!ok) setSalvando(null);
  }

  return (
    <div className="mt-3 border-t border-[var(--line)] px-1 pt-4">
      <p id={rotuloId} className="text-[14px] text-[var(--ink-soft)]">
        E a marca, já vende?
      </p>
      <div role="group" aria-labelledby={rotuloId} className="mt-2 flex flex-wrap gap-2">
        {ESCOLHAS_ESTAGIO.map((o) => (
          <button
            key={o.valor}
            type="button"
            aria-busy={salvando === o.valor || undefined}
            disabled={!!salvando}
            onClick={() => void escolher(o.valor)}
            className={`${BTN_MIUDO_ACAO} bg-white`}
          >
            {salvando === o.valor ? "Salvando..." : o.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Sem anúncio de nicho: "A sua marca vende o quê?" em três botões. Escolher
 * grava profiles.business_type na hora e só então libera a Calculadora, na aba
 * certa. Forma de BTN_MIUDO (e não pílula redonda): `rounded-full` é reservado
 * a selo que não é clicável (lib/botoes.ts).
 */
function EscolhaDoTipo({
  escolhaSalva,
  onEscolher,
}: {
  escolhaSalva: EscolhaTipo | null;
  onEscolher: (e: EscolhaTipo) => Promise<boolean>;
}) {
  const [escolha, setEscolha] = useState<EscolhaTipo | null>(escolhaSalva);
  const [salvando, setSalvando] = useState<EscolhaTipo | null>(null);
  const avisoId = useId();

  // Outra aba (ou a releitura) trouxe um valor salvo diferente: vale ele, se
  // não há gravação no meio. Só reage à mudança do valor salvo; reagir também
  // ao fim da gravação desfazia a escolha recém-gravada antes de o cache chegar.
  const salvandoRef = useRef(false);
  salvandoRef.current = !!salvando;
  useEffect(() => {
    if (!salvandoRef.current) setEscolha(escolhaSalva);
  }, [escolhaSalva]);

  async function escolher(e: EscolhaTipo) {
    if (salvando || e === escolha) return;
    const anterior = escolha;
    setEscolha(e);
    setSalvando(e);
    const ok = await onEscolher(e);
    setSalvando(null);
    if (!ok) setEscolha(anterior);
  }

  const liberado = !!escolha && !salvando;

  return (
    <div className="mt-3">
      <div
        role="group"
        aria-labelledby="primeiros-passos-sub-preco"
        className="flex flex-wrap gap-2"
      >
        {ESCOLHAS_TIPO.map((o) => {
          const marcado = escolha === o.valor;
          return (
            <button
              key={o.valor}
              type="button"
              aria-pressed={marcado}
              aria-busy={salvando === o.valor || undefined}
              disabled={!!salvando && salvando !== o.valor}
              onClick={() => void escolher(o.valor)}
              className={`${BTN_MIUDO_ACAO} min-w-[96px] ${
                marcado ? "!bg-[var(--secondary)]" : "bg-white"
              }`}
            >
              {marcado && <Check size={14} aria-hidden="true" />}
              {o.rotulo}
            </button>
          );
        })}
      </div>

      {liberado ? (
        <LinkInterno
          href={hrefCalculadora(tipoPrecoDaEscolha(escolha!))}
          className={`${BTN_ACAO} mt-4`}
        >
          {CTA_PRECO}
          <span aria-hidden="true">→</span>
        </LinkInterno>
      ) : (
        <>
          <button type="button" disabled aria-describedby={avisoId} className={`${BTN_ACAO} mt-4`}>
            {salvando ? "Salvando..." : CTA_PRECO}
            <span aria-hidden="true">→</span>
          </button>
          {!salvando && (
            <p id={avisoId} className="mt-2 text-[13px] text-[var(--muted)]">
              Escolha uma das três pra abrir a Calculadora na aba certa.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Nome da marca direto no bloco: mesmo campo do onboarding antigo e de Configurações. */
function CampoNome({ onSalvar }: { onSalvar: (nome: string) => Promise<boolean> }) {
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (salvando || !nome.trim()) return;
    setSalvando(true);
    const ok = await onSalvar(nome);
    // Deu certo: o passo vira feito e o campo desmonta. Falhou: o texto fica.
    if (!ok) {
      setSalvando(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  return (
    <form onSubmit={(e) => void enviar(e)} className="mt-3 flex flex-col gap-2 sm:flex-row">
      <label htmlFor={inputId} className="sr-only">
        Nome da marca
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value.slice(0, NOME_MARCA_MAX))}
        maxLength={NOME_MARCA_MAX}
        readOnly={salvando}
        aria-busy={salvando || undefined}
        aria-describedby="primeiros-passos-sub-nome"
        autoComplete="organization"
        placeholder="Mesmo que provisório"
        className="h-11 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-white px-3 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--secondary-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] sm:text-[14px]"
      />
      <button
        type="submit"
        disabled={salvando || !nome.trim()}
        className={`${BTN_ACAO} min-h-11 shrink-0`}
      >
        {salvando ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}

/** Esqueleto do bloco enquanto a leitura não chegou (só pra conta nova). */
export function PrimeirosPassosCarregando() {
  return (
    <div
      aria-hidden="true"
      className="mt-6 max-w-[640px] rounded-xl border border-[var(--line)] bg-white p-4 sm:p-5"
    >
      <span className="block h-3 w-32 animate-pulse rounded bg-[var(--line)] motion-reduce:animate-none" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="mt-4 flex gap-3 px-3">
          <span className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-[var(--line)] motion-reduce:animate-none" />
          <span className="mt-1 block h-4 flex-1 animate-pulse rounded bg-[var(--line)] motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
