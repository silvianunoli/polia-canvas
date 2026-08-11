import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { track } from "@/lib/analytics";
import { gtagEvent } from "@/components/GoogleAnalytics";
import { useTurnstile, TurnstileWidget } from "@/components/TurnstileWidget";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";
import { FieldError } from "@/components/ui/FieldError";
import { gravarLeadQuiz } from "@/lib/quiz.functions";
import {
  CONSENT_TEXTO,
  PERGUNTAS,
  TOTAL_PERGUNTAS,
  type AlternativaId,
} from "@/lib/quiz/perguntas";
import { calcularResultado, type RespostasQuiz } from "@/lib/quiz/pontuacao";

// Quiz "Você está pagando pra trabalhar?" — isca do pré-lançamento (PRD-quiz.md).
// Rota pública sem gatePublico de propósito: é o destino do link da bio, quem
// chega aqui nunca tem sessão.
//
// Estado só em memória: abandonar no meio não grava nada e recarregar começa do
// zero (no-go do v1). A única escrita é o lead, no gate de e-mail.

const INSTAGRAM_URL = "https://www.instagram.com/usepolia/";
const TIMEOUT_MS = 8000;

const ERRO_REDE =
  "Não conseguimos salvar agora. Suas respostas estão guardadas aqui, é só tentar de novo.";
const ERRO_EMAIL = "Esse e-mail não parece completo. Confere pra gente?";
const ERRO_TURNSTILE = "Falta confirmar ali em cima que não é um robô.";

export const Route = createFileRoute("/quiz")({
  validateSearch: (search: Record<string, unknown>) => ({
    origem:
      typeof search.origem === "string" && /^[a-z0-9_-]{1,40}$/i.test(search.origem)
        ? search.origem
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Você está pagando pra trabalhar? · Pólia" },
      {
        name: "description",
        content:
          "8 perguntas, 2 minutos, sem julgamento. Descubra onde as decisões de dinheiro do seu negócio ainda saem no chute.",
      },
      { property: "og:title", content: "Você está pagando pra trabalhar?" },
      {
        property: "og:description",
        content: "8 perguntas, 2 minutos, sem julgamento.",
      },
    ],
  }),
  component: QuizPage,
});

function emailValido(valor: string): boolean {
  return z.string().email().safeParse(valor.trim()).success;
}

/** Corre a gravação contra o relógio: sem resposta em 8s, trata como falha de
 *  rede (PRD §4). A promessa original segue e é descartada. */
function comTimeout<T>(promessa: Promise<T>): Promise<T> {
  return Promise.race([
    promessa,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
  ]);
}

// ── Casca visual ────────────────────────────────────────────────────────────
// Sem link no wordmark: o quiz é o destino do link da bio, não tem rota de fuga
// pro resto do site.
function Casca({ children }: { children: React.ReactNode }) {
  return (
    <div className="polia-v3 flex min-h-screen flex-col bg-white text-[var(--ink)]">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto flex max-w-[640px] items-center px-6 py-5">
          <PoliaWordmark className="h-6 w-auto" />
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-6 py-10 md:py-16">
        <div className="w-full max-w-[560px]">{children}</div>
      </main>
    </div>
  );
}

// ── Tela: abertura ──────────────────────────────────────────────────────────
function TelaAbertura({ onComecar }: { onComecar: () => void }) {
  return (
    <div>
      <h1 className="font-cabinet text-[32px] leading-[1.1] tracking-[-0.02em] text-[var(--ink)] md:text-[40px]">
        Você está pagando pra trabalhar?
      </h1>
      <p className="mt-4 text-[18px] leading-[1.5] text-[var(--ink-soft)]">
        8 perguntas, 2 minutos, sem julgamento.
      </p>
      <button
        type="button"
        onClick={onComecar}
        className="mt-8 w-full rounded-xl bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] transition-[filter] hover:brightness-95"
      >
        Quero descobrir
      </button>
    </div>
  );
}

// ── Tela: pergunta ──────────────────────────────────────────────────────────
function TelaPergunta({
  idx,
  escolha,
  onResponder,
  onVoltar,
}: {
  idx: number;
  escolha: AlternativaId | undefined;
  onResponder: (id: AlternativaId) => void;
  onVoltar: () => void;
}) {
  const pergunta = PERGUNTAS[idx];
  const numero = idx + 1;
  const pct = Math.round((numero / TOTAL_PERGUNTAS) * 100);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  // Cada pergunta é uma tela nova; leva o foco pro enunciado pra quem navega
  // por teclado ou leitor de tela não recomeçar do topo do documento.
  useEffect(() => {
    tituloRef.current?.focus();
  }, [idx]);

  return (
    <div>
      <div className="mb-8">
        <div
          role="progressbar"
          aria-valuenow={numero}
          aria-valuemin={1}
          aria-valuemax={TOTAL_PERGUNTAS}
          aria-label={`Pergunta ${numero} de ${TOTAL_PERGUNTAS}`}
          className="h-[6px] w-full overflow-hidden rounded-full bg-[var(--surface)]"
        >
          <div
            className="h-full rounded-full bg-[var(--secondary)] transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-[13px] text-[var(--muted)]">
          {numero} de {TOTAL_PERGUNTAS}
        </p>
      </div>

      <h2
        ref={tituloRef}
        tabIndex={-1}
        id={`quiz-${pergunta.id}`}
        className="font-cabinet text-[24px] leading-[1.2] tracking-[-0.01em] text-[var(--ink)] outline-none md:text-[28px]"
      >
        {pergunta.enunciado}
      </h2>

      <div className="mt-8 grid gap-3" role="group" aria-labelledby={`quiz-${pergunta.id}`}>
        {pergunta.alternativas.map((alternativa) => {
          const selecionada = escolha === alternativa.id;
          return (
            <button
              key={alternativa.id}
              type="button"
              aria-pressed={selecionada}
              onClick={() => onResponder(alternativa.id)}
              className={`w-full rounded-xl border px-4 py-4 text-left text-[16px] transition-colors ${
                selecionada
                  ? "border-[var(--secondary)] bg-[var(--secondary-light)] text-[var(--ink)]"
                  : "border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--secondary)]"
              }`}
            >
              {alternativa.rotulo}
            </button>
          );
        })}
      </div>

      {idx > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={onVoltar}
            className="rounded-lg px-3 py-2 text-[15px] text-[var(--muted)] transition-colors hover:text-[var(--ink-soft)]"
          >
            Voltar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tela: gate de e-mail ────────────────────────────────────────────────────
function TelaGate({
  faixaNome,
  onEnviar,
}: {
  faixaNome: string;
  onEnviar: (dados: { email: string; token: string }) => Promise<string | null>;
}) {
  const ts = useTurnstile();
  const [email, setEmail] = useState("");
  const [aceite, setAceite] = useState(false);
  const [erroEmail, setErroEmail] = useState<string | undefined>();
  const [erroEnvio, setErroEnvio] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);
  const [hp, setHp] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  const podeEnviar = emailValido(email) && aceite && !enviando;

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
    const erro = await onEnviar({ email: email.trim(), token: ts.token });
    if (erro) {
      // As respostas continuam em memória: é só tentar de novo.
      ts.reset();
      setErroEnvio(erro);
      setEnviando(false);
    }
  }

  return (
    <div>
      <p className="text-[13px] font-semibold tracking-[0.08em] text-[var(--muted)] uppercase">
        Seu resultado
      </p>
      <h2 className="mt-2 font-cabinet text-[28px] leading-[1.15] tracking-[-0.02em] text-[var(--ink)] md:text-[34px]">
        {faixaNome}
      </h2>
      <p className="mt-4 text-[17px] leading-[1.5] text-[var(--ink-soft)]">
        Seu diagnóstico completo mostra onde está o chute e a primeira conta pra sair dele.
      </p>

      <form onSubmit={enviar} className="mt-8 grid gap-4" noValidate>
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
            htmlFor="quiz-email"
            className="mb-2 block text-[14px] font-semibold text-[var(--ink-soft)]"
          >
            Seu e-mail
          </label>
          <input
            id="quiz-email"
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
            aria-describedby={erroEmail ? "quiz-email-erro" : undefined}
            className={`w-full rounded-lg border bg-white px-4 py-3 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:ring-4 ${
              erroEmail
                ? "border-[var(--danger)] focus:border-[var(--danger)]"
                : "border-[var(--line)] focus:border-[var(--secondary)] focus:ring-[var(--secondary-light)]"
            }`}
          />
          <FieldError id="quiz-email-erro">{erroEmail}</FieldError>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-[1.5] text-[var(--ink-soft)]">
          <input
            type="checkbox"
            checked={aceite}
            onChange={(e) => setAceite(e.target.checked)}
            className="mt-[2px] h-[18px] w-[18px] flex-none accent-[var(--secondary)]"
          />
          <span>
            {CONSENT_TEXTO}{" "}
            <Link
              to="/privacidade"
              className="text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]"
            >
              Política de privacidade
            </Link>
          </span>
        </label>

        <TurnstileWidget containerRef={ts.containerRef} />

        <button
          type="submit"
          disabled={!podeEnviar}
          className="w-full rounded-xl bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] transition-[filter] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {enviando ? "Enviando…" : "Quero meu diagnóstico"}
        </button>

        {erroEnvio && (
          <p role="alert" className="text-[14px] leading-[1.5] text-[var(--danger)]">
            {erroEnvio}
          </p>
        )}
      </form>
    </div>
  );
}

// ── Tela: resultado ─────────────────────────────────────────────────────────
function TelaResultado({
  respostas,
  onRefazer,
}: {
  respostas: RespostasQuiz;
  onRefazer: () => void;
}) {
  const { faixa, territorioFraco } = calcularResultado(respostas);

  return (
    <div>
      <p className="text-[13px] font-semibold tracking-[0.08em] text-[var(--muted)] uppercase">
        Seu resultado
      </p>
      <h2 className="mt-2 font-cabinet text-[28px] leading-[1.15] tracking-[-0.02em] text-[var(--ink)] md:text-[34px]">
        {faixa.nome}
      </h2>
      <p className="mt-3 text-[17px] leading-[1.5] text-[var(--ink-soft)]">{faixa.resumo}</p>

      <div className="mt-8 border-t border-[var(--line)] pt-8">
        <p className="text-[13px] font-semibold tracking-[0.08em] text-[var(--muted)] uppercase">
          Onde está o chute
        </p>
        <h3 className="mt-2 font-cabinet text-[22px] leading-[1.2] text-[var(--ink)]">
          {territorioFraco.nome}
        </h3>
        <p className="mt-3 text-[16px] leading-[1.55] text-[var(--ink-soft)]">
          {territorioFraco.explicacao}
        </p>
      </div>

      <div className="mt-8 rounded-2xl bg-[var(--surface-pink)] p-6">
        <p className="text-[13px] font-semibold tracking-[0.08em] text-[var(--ink-soft)] uppercase">
          A conta pra fazer hoje
        </p>
        <p className="mt-3 text-[17px] leading-[1.55] text-[var(--ink)]">{territorioFraco.conta}</p>
      </div>

      <p className="mt-8 text-[16px] leading-[1.5] text-[var(--ink-soft)]">
        Seus próximos passos chegam no seu e-mail.
      </p>

      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] no-underline transition-[filter] hover:brightness-95"
      >
        Seguir @usepolia →
      </a>

      <div className="mt-6">
        <button
          type="button"
          onClick={onRefazer}
          className="rounded-lg px-3 py-2 text-[14px] text-[var(--muted)] transition-colors hover:text-[var(--ink-soft)]"
        >
          Refazer o teste
        </button>
      </div>
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────
type Tela = "abertura" | "pergunta" | "gate" | "resultado";

function QuizPage() {
  const { origem } = Route.useSearch();
  const [tela, setTela] = useState<Tela>("abertura");
  const [idx, setIdx] = useState(0);
  const [respostas, setRespostas] = useState<RespostasQuiz>({});

  function comecar() {
    track("quiz_iniciado");
    gtagEvent("quiz_iniciado");
    setTela("pergunta");
  }

  function responder(escolha: AlternativaId) {
    const pergunta = PERGUNTAS[idx];
    const atualizadas = { ...respostas, [pergunta.id]: escolha };
    setRespostas(atualizadas);

    if (idx === TOTAL_PERGUNTAS - 1) {
      const { pontos, faixa, territorioFraco } = calcularResultado(atualizadas);
      const props = { pontos, faixa: faixa.nome, territorio: territorioFraco.nome };
      track("quiz_concluido", props);
      gtagEvent("quiz_concluido", props);
      setTela("gate");
      return;
    }
    setIdx((i) => i + 1);
  }

  function voltar() {
    setIdx((i) => Math.max(0, i - 1));
  }

  /** Devolve a mensagem de erro pra mostrar, ou null se gravou. */
  async function enviarLead({
    email,
    token,
  }: {
    email: string;
    token: string;
  }): Promise<string | null> {
    try {
      const r = await comTimeout(
        gravarLeadQuiz({
          data: { email, consentimento: true, respostas, origem, turnstileToken: token },
        }),
      );
      if (!r.ok) {
        if (r.motivo === "turnstile") return ERRO_TURNSTILE;
        console.error("[Quiz] Gravação recusada:", r.motivo);
        return ERRO_REDE;
      }
      const { faixa, territorioFraco } = calcularResultado(respostas);
      const props = { faixa: faixa.nome, territorio: territorioFraco.nome };
      track("lead_gravado", props);
      gtagEvent("lead_gravado", props);
      setTela("resultado");
      return null;
    } catch (erro) {
      console.error("[Quiz] Falha ao gravar o lead:", erro);
      return ERRO_REDE;
    }
  }

  function refazer() {
    setRespostas({});
    setIdx(0);
    setTela("abertura");
  }

  return (
    <Casca>
      {tela === "abertura" && <TelaAbertura onComecar={comecar} />}
      {tela === "pergunta" && (
        <TelaPergunta
          idx={idx}
          escolha={respostas[PERGUNTAS[idx].id]}
          onResponder={responder}
          onVoltar={voltar}
        />
      )}
      {tela === "gate" && (
        <TelaGate faixaNome={calcularResultado(respostas).faixa.nome} onEnviar={enviarLead} />
      )}
      {tela === "resultado" && <TelaResultado respostas={respostas} onRefazer={refazer} />}
    </Casca>
  );
}
