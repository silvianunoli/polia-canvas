import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { toastErro } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { useTurnstile, TurnstileWidget } from "@/components/TurnstileWidget";
import { entrarListaEspera } from "@/lib/lista-espera.functions";
import { getPesquisaAberta, salvarPesquisa } from "@/lib/pesquisa.functions";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";
import { Reveal } from "@/components/site/Reveal";
import { CONTAINER, SECAO, BTN_PRIMARIO, BTN_CONTORNO, Eyebrow } from "@/components/site/Editorial";
import { pesquisaPorSlug, perguntasPorId, totalPerguntas } from "@/lib/pesquisas/registro";
import type { Pergunta } from "@/lib/pesquisas/tipos";
import { FieldError } from "@/components/ui/FieldError";

export const Route = createFileRoute("/pesquisa")({
  head: () => ({
    meta: [
      { title: "Uma pergunta rápida sobre o seu negócio · Pólia" },
      {
        name: "description",
        content:
          "Me conta como está o seu negócio hoje: uma pesquisa rápida e anônima sobre preço, lucro e o que mais aperta.",
      },
    ],
  }),
  loader: async () => await getPesquisaAberta(),
  component: PesquisaPage,
});

type Valor = string | string[];
type Respostas = Record<string, Valor>;

/** Cartão editorial que segura cada tela do fluxo. */
const CARTAO =
  "rounded-2xl border border-[var(--line)] bg-white p-[clamp(24px,4vw,40px)] max-md:px-5";

/** Campo de formulário: raio, tipo e foco visível iguais em todo o fluxo. */
const CAMPO =
  "w-full rounded-xl border bg-white px-4 py-3 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--secondary)]";

const FOCO_SUAVE =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--secondary)]";

const BTN_DESABILITADO = "disabled:cursor-not-allowed disabled:opacity-50";

function getOrCreateSessao(sessaoKey: string): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(sessaoKey);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(sessaoKey, id);
  }
  return id;
}

function respondida(p: Pergunta, v: Valor | undefined): boolean {
  if (v === undefined) return false;
  if (p.tipo === "multipla") return Array.isArray(v) && v.length > 0;
  if (p.tipo === "aberta") return typeof v === "string" && v.trim().length > 0;
  return typeof v === "string" && v.length > 0;
}

function validarEmail(v: string): string | undefined {
  if (!v.trim()) return "Falta o seu e-mail.";
  return z.string().email().safeParse(v.trim()).success
    ? undefined
    : "E-mail inválido. Confere o @.";
}

// ── Casca visual ────────────────────────────────────────────────────────────
function Casca({ children }: { children: ReactNode }) {
  return (
    <div className="polia-v3 flex min-h-screen flex-col bg-[var(--bg)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)]">
        <div className={`${CONTAINER} flex items-center py-5`}>
          <Link
            to="/lista-de-espera"
            aria-label="Pólia"
            className={`rounded-lg text-[var(--ink)] no-underline ${FOCO_SUAVE}`}
          >
            <PoliaWordmark className="h-6 w-auto" />
          </Link>
        </div>
      </header>
      <main className={`flex-1 ${SECAO}`}>
        <div className={CONTAINER}>
          <div className="mx-auto w-full max-w-[640px]">{children}</div>
        </div>
      </main>
    </div>
  );
}

/** Link de saída pra lista de espera, repetido nas telas de fim de fluxo. */
function LinkListaEspera() {
  return (
    <div className="mt-6">
      <Link to="/lista-de-espera" className={BTN_CONTORNO}>
        Entrar na lista de espera
      </Link>
    </div>
  );
}

// ── Botão de opção ──────────────────────────────────────────────────────────
function Opcao({
  rotulo,
  selecionada,
  desabilitada,
  onClick,
}: {
  rotulo: string;
  selecionada: boolean;
  desabilitada?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selecionada}
      disabled={desabilitada}
      onClick={onClick}
      className={`w-full rounded-xl border px-4 py-3 text-left text-[16px] leading-[1.45] transition-colors ${FOCO_SUAVE} ${
        selecionada
          ? "border-[var(--secondary)] bg-[var(--secondary-light)] text-[var(--ink)]"
          : "border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--secondary)] disabled:opacity-40 disabled:hover:border-[var(--line)]"
      }`}
    >
      {rotulo}
    </button>
  );
}

// ── Tela: intro ─────────────────────────────────────────────────────────────
function TelaIntro({
  titulo,
  subtitulo,
  onComecar,
}: {
  titulo: string;
  subtitulo: string;
  onComecar: (token: string) => Promise<boolean>;
}) {
  const ts = useTurnstile();
  const [iniciando, setIniciando] = useState(false);

  async function comecar() {
    if (!ts.token) {
      toastErro("Confirma que não é um robô pra começar.");
      return;
    }
    setIniciando(true);
    const ok = await onComecar(ts.token);
    if (!ok) {
      ts.reset();
      setIniciando(false);
    }
  }

  return (
    <Reveal>
      <div className={CARTAO}>
        <Eyebrow>Pesquisa</Eyebrow>
        <h1 className="mt-4 text-[clamp(1.9rem,4.4vw,2.6rem)] font-bold leading-[1.1] tracking-[-0.02em] text-balance">
          {titulo}
        </h1>
        <p className="mt-4 text-[17px] leading-[1.55] text-[var(--ink-soft)]">{subtitulo}</p>
        <p className="mt-2 text-[14px] leading-[1.5] text-[var(--ink-soft)]">
          Não tem resposta certa nem errada. A ideia é entender como o negócio está hoje.
        </p>
        <div className="mt-6">
          <TurnstileWidget containerRef={ts.containerRef} />
        </div>
        <button
          type="button"
          onClick={comecar}
          disabled={iniciando}
          className={`${BTN_PRIMARIO} ${BTN_DESABILITADO} mt-6 w-full`}
        >
          {iniciando ? "Abrindo…" : "Começar"}
        </button>
      </div>
    </Reveal>
  );
}

// ── Tela: pergunta ──────────────────────────────────────────────────────────
function TelaPergunta({
  pergunta,
  idx,
  total,
  valor,
  onResponder,
  onAvancar,
  onVoltar,
  concluindo,
}: {
  pergunta: Pergunta;
  idx: number;
  total: number;
  valor: Valor | undefined;
  onResponder: (v: Valor) => void;
  onAvancar: () => void;
  onVoltar: () => void;
  concluindo: boolean;
}) {
  const pct = Math.round(((idx + 1) / total) * 100);
  const ehUltima = idx === total - 1;
  const jaRespondeu = respondida(pergunta, valor);
  const podeAvancar = pergunta.opcional || jaRespondeu;

  function toggleMultipla(opId: string) {
    const atual = Array.isArray(valor) ? valor : [];
    if (atual.includes(opId)) {
      onResponder(atual.filter((x) => x !== opId));
    } else {
      const max = pergunta.maxSelecoes ?? 99;
      if (atual.length >= max) return;
      onResponder([...atual, opId]);
    }
  }

  return (
    <div className={CARTAO}>
      {/* Progresso */}
      <div className="mb-6">
        <Eyebrow>
          Pergunta {idx + 1} de {total}
          {pergunta.opcional ? " · opcional" : ""}
        </Eyebrow>
        <div
          aria-hidden="true"
          className="mt-3 h-[6px] w-full overflow-hidden rounded-full bg-[var(--line)]"
        >
          <div
            className="h-full rounded-full bg-[var(--secondary)] transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <h2
        id={`pergunta-${pergunta.id}`}
        className="text-[clamp(1.35rem,2.6vw,1.7rem)] font-bold leading-[1.2] tracking-[-0.02em] text-balance"
      >
        {pergunta.titulo}
      </h2>
      {pergunta.ajuda && (
        <p className="mt-2 text-[14px] leading-[1.5] text-[var(--ink-soft)]">{pergunta.ajuda}</p>
      )}

      <div className="mt-6" role="group" aria-labelledby={`pergunta-${pergunta.id}`}>
        {pergunta.tipo === "aberta" ? (
          <textarea
            value={typeof valor === "string" ? valor : ""}
            onChange={(e) => onResponder(e.target.value)}
            placeholder={pergunta.placeholder}
            rows={5}
            maxLength={2000}
            className={`${CAMPO} border-[var(--line)] leading-[1.55]`}
          />
        ) : (
          <div className="grid gap-2">
            {(pergunta.opcoes ?? []).map((op) => {
              const selecionada =
                pergunta.tipo === "multipla"
                  ? Array.isArray(valor) && valor.includes(op.id)
                  : valor === op.id;
              const noMax =
                pergunta.tipo === "multipla" &&
                !selecionada &&
                Array.isArray(valor) &&
                valor.length >= (pergunta.maxSelecoes ?? 99);
              return (
                <Opcao
                  key={op.id}
                  rotulo={op.rotulo}
                  selecionada={selecionada}
                  desabilitada={noMax}
                  onClick={() =>
                    pergunta.tipo === "multipla" ? toggleMultipla(op.id) : onResponder(op.id)
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        {idx > 0 ? (
          <button type="button" onClick={onVoltar} className={BTN_CONTORNO}>
            Voltar
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onAvancar}
          disabled={!podeAvancar || concluindo}
          className={`${BTN_PRIMARIO} ${BTN_DESABILITADO}`}
        >
          {ehUltima ? (concluindo ? "Enviando…" : "Concluir") : "Avançar"}
        </button>
      </div>
    </div>
  );
}

// ── Tela: contato (lista de espera) ─────────────────────────────────────────
function TelaContato({
  onEnviar,
  onPular,
}: {
  onEnviar: (dados: { nome: string; email: string; token: string }) => Promise<boolean>;
  onPular: () => void;
}) {
  const ts = useTurnstile();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [aceite, setAceite] = useState(false);
  const [errors, setErrors] = useState<{ nome?: string; email?: string; aceite?: boolean }>({});
  const [enviando, setEnviando] = useState(false);
  const [hp, setHp] = useState("");

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (hp) {
      onPular();
      return;
    }
    const nomeErro = nome.trim().length < 2 ? "Falta o seu nome." : undefined;
    const emailErro = validarEmail(email);
    if (nomeErro || emailErro || !aceite) {
      setErrors({ nome: nomeErro, email: emailErro, aceite: !aceite });
      return;
    }
    setErrors({});
    if (!ts.token) {
      toastErro("Confirma que não é um robô pra receber o aviso.");
      return;
    }
    setEnviando(true);
    const ok = await onEnviar({ nome: nome.trim(), email: email.trim(), token: ts.token });
    if (!ok) {
      ts.reset();
      setEnviando(false);
    }
  }

  return (
    <Reveal>
      <div className={CARTAO}>
        <Eyebrow>Lista de espera</Eyebrow>
        <h2 className="mt-4 text-[clamp(1.5rem,3vw,2rem)] font-bold leading-[1.15] tracking-[-0.02em] text-balance">
          Quando a Pólia abrir, o aviso chega por e-mail.
        </h2>
        <p className="mt-3 text-[16px] leading-[1.55] text-[var(--ink-soft)]">
          Deixa nome e e-mail aqui embaixo. Só o aviso do lançamento, nada de spam.
        </p>

        <form onSubmit={enviar} className="mt-6 grid gap-4" noValidate>
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
              htmlFor="p-nome"
              className="mb-2 block text-[14px] font-semibold text-[var(--ink-soft)]"
            >
              Seu nome
            </label>
            <input
              id="p-nome"
              type="text"
              autoComplete="name"
              placeholder="Nome ou apelido"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                if (errors.nome) setErrors((er) => ({ ...er, nome: undefined }));
              }}
              aria-invalid={!!errors.nome || undefined}
              aria-describedby={errors.nome ? "p-nome-erro" : undefined}
              className={`${CAMPO} ${errors.nome ? "border-[var(--danger)]" : "border-[var(--line)]"}`}
            />
            <FieldError id="p-nome-erro">{errors.nome}</FieldError>
          </div>
          <div>
            <label
              htmlFor="p-email"
              className="mb-2 block text-[14px] font-semibold text-[var(--ink-soft)]"
            >
              Seu e-mail
            </label>
            <input
              id="p-email"
              type="email"
              autoComplete="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((er) => ({ ...er, email: undefined }));
              }}
              aria-invalid={!!errors.email || undefined}
              aria-describedby={errors.email ? "p-email-erro" : undefined}
              className={`${CAMPO} ${errors.email ? "border-[var(--danger)]" : "border-[var(--line)]"}`}
            />
            <FieldError id="p-email-erro">{errors.email}</FieldError>
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-[1.5] text-[var(--ink-soft)]">
            <input
              type="checkbox"
              checked={aceite}
              onChange={(e) => {
                setAceite(e.target.checked);
                if (e.target.checked) setErrors((er) => ({ ...er, aceite: false }));
              }}
              className={`mt-[2px] h-[18px] w-[18px] flex-none rounded accent-[var(--secondary)] ${FOCO_SUAVE}`}
            />
            <span>
              Pode me avisar por e-mail e aceito os{" "}
              <Link
                to="/termos"
                className="text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]"
              >
                Termos
              </Link>{" "}
              e a{" "}
              <Link
                to="/privacidade"
                className="text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]"
              >
                Privacidade
              </Link>
              .
            </span>
          </label>
          {errors.aceite && (
            <p className="text-[13px] text-[var(--danger)]">
              Falta marcar essa caixa pra eu poder avisar.
            </p>
          )}

          <TurnstileWidget containerRef={ts.containerRef} />

          <button
            type="submit"
            disabled={enviando}
            className={`${BTN_PRIMARIO} ${BTN_DESABILITADO} w-full`}
          >
            {enviando ? "Enviando…" : "Quero ser avisada"}
          </button>
          <button
            type="button"
            onClick={onPular}
            className={`mx-auto rounded-lg px-2 py-1 text-[14px] text-[var(--ink-soft)] underline underline-offset-[3px] ${FOCO_SUAVE}`}
          >
            Prefiro não deixar meu e-mail
          </button>
        </form>
      </div>
    </Reveal>
  );
}

// ── Tela: fim ───────────────────────────────────────────────────────────────
function TelaFim() {
  return (
    <Reveal>
      <div
        className="rounded-2xl bg-[var(--surface-pink)] p-[clamp(24px,4vw,40px)] max-md:px-5"
        role="status"
        aria-live="polite"
      >
        <Eyebrow>Resposta registrada</Eyebrow>
        <h2 className="mt-4 text-[clamp(1.5rem,3vw,2rem)] font-bold leading-[1.15] tracking-[-0.02em] text-balance">
          Pronto. Obrigada por dividir isso.
        </h2>
        <p className="mt-3 text-[16px] leading-[1.55] text-[var(--ink-soft)]">
          Cada resposta ajuda a Pólia a nascer do jeito certo pra quem toca a própria marca sozinha.
        </p>
        <LinkListaEspera />
      </div>
    </Reveal>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────
function PesquisaPage() {
  const dados = Route.useLoaderData();
  const config = dados.slug ? pesquisaPorSlug(dados.slug) : undefined;
  const feitaKey = `polia-pesquisa-feita-${dados.slug}`;
  const sessaoKey = `polia-pesquisa-sessao-${dados.slug}`;

  const [sessaoId, setSessaoId] = useState("");
  const [pronto, setPronto] = useState(false);
  const [jaRespondeu, setJaRespondeu] = useState(false);

  const [tela, setTela] = useState<"intro" | "pergunta" | "contato" | "fim">("intro");
  const [idx, setIdx] = useState(0);
  const [respostas, setRespostas] = useState<Respostas>({});
  const [concluindo, setConcluindo] = useState(false);

  useEffect(() => {
    if (!dados.slug) {
      setPronto(true);
      return;
    }
    setSessaoId(getOrCreateSessao(sessaoKey));
    if (typeof window !== "undefined" && localStorage.getItem(feitaKey) === "1") {
      setJaRespondeu(true);
    }
    setPronto(true);
    track("pesquisa_vista");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados.slug]);

  function salvarSilencioso(resp: Respostas, progresso: number, concluida: boolean) {
    void salvarPesquisa({
      data: { sessaoId, progresso, concluida, respostas: resp, hp: undefined },
    }).catch(() => {});
  }

  async function iniciar(token: string): Promise<boolean> {
    if (!sessaoId) return false;
    try {
      const r = await salvarPesquisa({
        data: { sessaoId, progresso: 0, concluida: false, respostas: {}, turnstileToken: token },
      });
      if (!r.ok) {
        toastErro(
          r.motivo === "fechada"
            ? "A pesquisa está fechada no momento."
            : "Não deu pra começar agora. Tenta de novo.",
        );
        return false;
      }
      track("pesquisa_iniciada");
      setTela("pergunta");
      setIdx(0);
      return true;
    } catch {
      toastErro("Não deu pra começar agora. Tenta de novo.");
      return false;
    }
  }

  function responder(v: Valor) {
    const p = config!.perguntas[idx];
    setRespostas((r) => ({ ...r, [p.id]: v }));
  }

  async function avancar() {
    const p = config!.perguntas[idx];
    const progresso = p.ordem;
    if (idx === totalPerguntas(config!) - 1) {
      setConcluindo(true);
      try {
        await salvarPesquisa({
          data: { sessaoId, progresso, concluida: true, respostas, hp: undefined },
        });
      } catch {
        // Se a gravação final falhar, ainda deixamos ela seguir pro contato; o
        // progresso anterior já está salvo. Não travamos a experiência.
      }
      if (typeof window !== "undefined") localStorage.setItem(feitaKey, "1");
      track("pesquisa_concluida");
      setConcluindo(false);
      setJaRespondeu(true);
      setTela("contato");
    } else {
      salvarSilencioso(respostas, progresso, false);
      setIdx((i) => i + 1);
    }
  }

  function voltar() {
    setIdx((i) => Math.max(0, i - 1));
  }

  async function enviarContato(d: {
    nome: string;
    email: string;
    token: string;
  }): Promise<boolean> {
    const categoriaRotulo =
      perguntasPorId(config!)["categoria"]?.opcoes?.find((o) => o.id === respostas["categoria"])
        ?.rotulo ?? null;
    try {
      const r = await entrarListaEspera({
        data: {
          nome: d.nome,
          email: d.email,
          tipo_negocio: categoriaRotulo,
          novidades: true,
          turnstileToken: d.token,
        },
      });
      if (r.ok) {
        track("pesquisa_lista_espera", { ja_estava: r.jaEstava });
        setTela("fim");
        return true;
      }
      toastErro("Não deu pra salvar seu e-mail agora. Tenta de novo.");
      return false;
    } catch {
      toastErro("Não deu pra salvar seu e-mail agora. Tenta de novo.");
      return false;
    }
  }

  if (!pronto) {
    return <Casca>{null}</Casca>;
  }

  if (!dados.aberta || !config) {
    return (
      <Casca>
        <Reveal>
          <div className={CARTAO}>
            <Eyebrow>Pesquisa</Eyebrow>
            <h1 className="mt-4 text-[clamp(1.5rem,3vw,2rem)] font-bold leading-[1.15] tracking-[-0.02em] text-balance">
              A pesquisa está fechada por enquanto.
            </h1>
            <p className="mt-3 text-[16px] leading-[1.55] text-[var(--ink-soft)]">
              Obrigada pelo interesse. Enquanto isso, dá pra entrar na lista de espera.
            </p>
            <LinkListaEspera />
          </div>
        </Reveal>
      </Casca>
    );
  }

  if (jaRespondeu && tela === "intro") {
    return (
      <Casca>
        <Reveal>
          <div className={CARTAO}>
            <Eyebrow>Resposta registrada</Eyebrow>
            <h1 className="mt-4 text-[clamp(1.5rem,3vw,2rem)] font-bold leading-[1.15] tracking-[-0.02em] text-balance">
              A resposta já entrou. Obrigada de novo.
            </h1>
            <p className="mt-3 text-[16px] leading-[1.55] text-[var(--ink-soft)]">
              Não precisa responder outra vez. Dá pra acompanhar o lançamento na lista de espera.
            </p>
            <LinkListaEspera />
          </div>
        </Reveal>
      </Casca>
    );
  }

  return (
    <Casca>
      {tela === "intro" && (
        <TelaIntro titulo={dados.titulo} subtitulo={dados.subtitulo} onComecar={iniciar} />
      )}
      {tela === "pergunta" && (
        <TelaPergunta
          pergunta={config.perguntas[idx]}
          idx={idx}
          total={totalPerguntas(config)}
          valor={respostas[config.perguntas[idx].id]}
          onResponder={responder}
          onAvancar={avancar}
          onVoltar={voltar}
          concluindo={concluindo}
        />
      )}
      {tela === "contato" && (
        <TelaContato onEnviar={enviarContato} onPular={() => setTela("fim")} />
      )}
      {tela === "fim" && <TelaFim />}
    </Casca>
  );
}
