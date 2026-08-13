import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { track } from "@/lib/analytics";
import { gtagEvent } from "@/components/GoogleAnalytics";
import { useTurnstile, TurnstileWidget } from "@/components/TurnstileWidget";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";
import { FieldError } from "@/components/ui/FieldError";
import { Reveal } from "@/components/site/Reveal";
import { HighlightWord } from "@/components/site/HighlightWord";
import { CONTAINER, SECAO, BTN_PRIMARIO, BTN_CONTORNO, Eyebrow } from "@/components/site/Editorial";
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

/** Ritmo vertical das telas de fluxo (pergunta, gate, resultado). A abertura usa
 *  SECAO, que é o respiro das páginas públicas; aqui dentro do quiz o espaço
 *  precisa ser menor pra pergunta e alternativas caberem na dobra do celular. */
const RESPIRO = "py-[clamp(32px,5vw,56px)]";
/** Coluna de leitura do quiz, dentro do CONTAINER do site. */
const COLUNA = "mx-auto w-full max-w-[600px]";
/** CTA de tela cheia no celular, botão normal a partir de sm. */
const CTA_LARGO = "w-full min-h-[52px] sm:w-auto";

export const Route = createFileRoute("/quiz/")({
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
// Sem SiteHeader nem SiteFooter, e sem link no wordmark: o quiz é o destino do
// link da bio, não tem rota de fuga pro resto do site. O cabeçalho é próprio,
// só a marca e a linha.
function Casca({ children }: { children: React.ReactNode }) {
  return (
    <div className="polia-v3 flex min-h-screen flex-col bg-[var(--bg)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--bg)]">
        <div className={`${CONTAINER} flex items-center py-5`}>
          <PoliaWordmark className="h-6 w-auto" />
        </div>
      </header>
      <main className="flex flex-1 items-start">
        <div className={`${CONTAINER} w-full`}>
          <div className={COLUNA}>{children}</div>
        </div>
      </main>
    </div>
  );
}

// ── Tela: abertura ──────────────────────────────────────────────────────────
function TelaAbertura({ onComecar }: { onComecar: () => void }) {
  return (
    <div className={SECAO}>
      <Reveal>
        <Eyebrow>Teste da Pólia</Eyebrow>
        <h1 className="mt-4 text-[clamp(2rem,6vw,3rem)] font-bold leading-[1.06] tracking-[-0.02em] text-balance">
          Você está pagando{" "}
          <span className="whitespace-nowrap">
            <HighlightWord delay={0.25}>pra trabalhar</HighlightWord>?
          </span>
        </h1>
      </Reveal>
      <Reveal delay={0.1}>
        <p className="mt-5 max-w-[46ch] text-[clamp(1.06rem,1.35vw,1.2rem)] leading-[1.6] text-[var(--ink-soft)]">
          8 perguntas, 2 minutos, sem julgamento. Descubra onde as decisões de dinheiro do seu
          negócio ainda saem no chute.
        </p>
        <button type="button" onClick={onComecar} className={`${BTN_PRIMARIO} mt-8 ${CTA_LARGO}`}>
          Quero descobrir
          <span aria-hidden="true">→</span>
        </button>
      </Reveal>
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
    <div className={RESPIRO}>
      <div className="mb-8">
        <Eyebrow>
          Pergunta {numero} de {TOTAL_PERGUNTAS}
        </Eyebrow>
        <div
          role="progressbar"
          aria-valuenow={numero}
          aria-valuemin={1}
          aria-valuemax={TOTAL_PERGUNTAS}
          aria-label={`Pergunta ${numero} de ${TOTAL_PERGUNTAS}`}
          className="mt-3 h-[6px] w-full overflow-hidden rounded-full bg-[var(--line)]"
        >
          <div
            className="h-full rounded-full bg-[var(--secondary)] transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <h2
        ref={tituloRef}
        tabIndex={-1}
        id={`quiz-${pergunta.id}`}
        className="text-[clamp(1.5rem,4.4vw,1.9rem)] font-bold leading-[1.15] tracking-[-0.02em] text-balance outline-none"
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
              className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border px-5 py-4 text-left text-[16px] leading-[1.4] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] ${
                selecionada
                  ? "border-[var(--secondary)] bg-[var(--secondary-light)] text-[var(--ink)]"
                  : "border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--secondary)]"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-4 w-4 flex-none rounded-md border-[1.5px] ${
                  selecionada
                    ? "border-[var(--ink)] bg-[var(--secondary)]"
                    : "border-[var(--line)] bg-white"
                }`}
              />
              {alternativa.rotulo}
            </button>
          );
        })}
      </div>

      {idx > 0 && (
        <div className="mt-8">
          <button type="button" onClick={onVoltar} className={BTN_CONTORNO}>
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
    <div className={RESPIRO}>
      <Eyebrow>Seu resultado</Eyebrow>
      <h2 className="mt-4 text-[clamp(1.75rem,5vw,2.3rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
        {faixaNome}
      </h2>
      <p className="mt-4 text-[17px] leading-[1.55] text-[var(--ink-soft)]">
        Seu diagnóstico completo mostra onde está o chute e a primeira conta pra sair dele.
      </p>

      <form onSubmit={enviar} className="mt-8 grid gap-5" noValidate>
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
            className={`min-h-[52px] w-full rounded-xl border bg-white px-4 py-3 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:ring-4 ${
              erroEmail
                ? "border-[var(--danger)] focus:border-[var(--danger)]"
                : "border-[var(--line)] focus:border-[var(--secondary)] focus:ring-[var(--secondary-light)]"
            }`}
          />
          <FieldError id="quiz-email-erro">{erroEmail}</FieldError>
        </div>

        {/* O link fica FORA do <label> de propósito. Dentro, clicar nele conta
            como clique no label e marca/desmarca o consentimento junto. E abre
            em aba nova: o quiz não guarda progresso entre visitas, então sair
            da página aqui, com as 8 já respondidas e o e-mail digitado, joga
            tudo fora. */}
        <div className="flex items-start gap-3 text-[14px] leading-[1.5] text-[var(--ink-soft)]">
          <input
            id="quiz-consent"
            type="checkbox"
            checked={aceite}
            onChange={(e) => setAceite(e.target.checked)}
            className="mt-[2px] h-[18px] w-[18px] flex-none accent-[var(--secondary)]"
          />
          <span>
            <label htmlFor="quiz-consent" className="cursor-pointer">
              {CONSENT_TEXTO}
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
    <div className={RESPIRO}>
      {/* Sem Reveal daqui pra baixo: a tela troca com a rolagem onde o gate
          parou, e o whileInView deixaria o diagnóstico invisível até rolar. */}
      <Eyebrow>Seu resultado</Eyebrow>
      <h2 className="mt-4 text-[clamp(1.75rem,5vw,2.3rem)] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
        {faixa.nome}
      </h2>
      <p className="mt-4 text-[17px] leading-[1.55] text-[var(--ink-soft)]">{faixa.resumo}</p>

      <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 md:p-8">
        <p className="text-[14px] font-semibold text-[var(--ink-soft)]">
          Onde você está mais no chute:
        </p>
        <h3 className="mt-2 text-[clamp(1.25rem,3.4vw,1.5rem)] font-bold leading-[1.2] tracking-[-0.02em] text-balance">
          {territorioFraco.nome}
        </h3>
        <p className="mt-3 text-[16px] leading-[1.6] text-[var(--ink-soft)]">
          {territorioFraco.explicacao}
        </p>
      </div>

      {/* Rótulo e conta na mesma frase: a conta começa em minúscula porque
          continua o "A conta pra fazer hoje:" (PRD-ajuste-copy-quiz.md §2.4).
          Quebrar em duas linhas deixaria uma frase começando em minúscula. */}
      <div className="mt-4 rounded-2xl bg-[var(--surface-pink)] p-6 md:p-8">
        <p className="text-[17px] leading-[1.6] text-[var(--ink)]">
          <span className="font-semibold">A conta pra fazer hoje:</span> {territorioFraco.conta}
        </p>
      </div>

      {/* Esta frase só pode existir enquanto o envio existir: quem grava o lead
          (src/lib/quiz.functions.ts) manda o diagnóstico na hora, por
          src/lib/quiz/email.ts. Mexeu no envio, mexe aqui junto. */}
      <p className="mt-8 text-[16px] leading-[1.55] text-[var(--ink-soft)]">
        Seus próximos passos chegam no seu e-mail.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`${BTN_PRIMARIO} ${CTA_LARGO}`}
        >
          Seguir @usepolia
          <span aria-hidden="true">→</span>
        </a>
        <button type="button" onClick={onRefazer} className={`${BTN_CONTORNO} ${CTA_LARGO}`}>
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
