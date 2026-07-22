import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toastErro } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { useTurnstile, TurnstileWidget } from "@/components/TurnstileWidget";
import { entrarListaEspera } from "@/lib/lista-espera.functions";
import { getPesquisaAberta, salvarPesquisa } from "@/lib/pesquisa.functions";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";
import {
  PESQUISA_DISCOVERY,
  PERGUNTAS_POR_ID,
  SLUG_PESQUISA,
  TOTAL_PERGUNTAS,
  type Pergunta,
} from "@/lib/pesquisa-discovery.config";
import { FieldError } from "@/components/ui/FieldError";

export const Route = createFileRoute("/pesquisa")({
  head: () => ({
    meta: [
      { title: "Uma pergunta rápida sobre o seu negócio · Pólia" },
      {
        name: "description",
        content:
          "Uma pesquisa anônima e rápida sobre como é tocar o seu negócio hoje. Sua marca fatura mais quando você sabe quem ela é.",
      },
    ],
  }),
  loader: async () => await getPesquisaAberta(),
  component: PesquisaPage,
});

type Valor = string | string[];
type Respostas = Record<string, Valor>;

const FEITA_KEY = `polia-pesquisa-feita-${SLUG_PESQUISA}`;
const SESSAO_KEY = `polia-pesquisa-sessao-${SLUG_PESQUISA}`;

function getOrCreateSessao(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(SESSAO_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSAO_KEY, id);
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
function Casca({ children }: { children: React.ReactNode }) {
  return (
    <div className="polia-v3 flex min-h-screen flex-col bg-white text-[var(--ink)]">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto flex max-w-[640px] items-center px-6 py-5">
          <Link to="/lista-de-espera" aria-label="Pólia" className="text-[var(--ink)] no-underline">
            <PoliaWordmark className="h-6 w-auto" />
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-6 py-10 md:py-16">
        <div className="w-full max-w-[560px]">{children}</div>
      </main>
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
      className={`w-full rounded-xl border px-4 py-3 text-left text-[16px] transition-colors ${
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
    <div>
      <h1 className="font-cabinet text-[30px] leading-[1.1] tracking-[-0.02em] text-[var(--ink)] md:text-[36px]">
        {titulo}
      </h1>
      <p className="mt-4 text-[17px] leading-[1.5] text-[var(--ink-soft)]">{subtitulo}</p>
      <p className="mt-2 text-[14px] text-[var(--muted)]">
        Não tem resposta certa nem errada. É pra te entender de verdade.
      </p>
      <div className="mt-6">
        <TurnstileWidget containerRef={ts.containerRef} />
      </div>
      <button
        type="button"
        onClick={comecar}
        disabled={iniciando}
        className="mt-6 w-full rounded-xl bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] transition-[filter] hover:brightness-95 disabled:opacity-60"
      >
        {iniciando ? "Abrindo…" : "Começar"}
      </button>
    </div>
  );
}

// ── Tela: pergunta ──────────────────────────────────────────────────────────
function TelaPergunta({
  pergunta,
  idx,
  valor,
  onResponder,
  onAvancar,
  onVoltar,
  concluindo,
}: {
  pergunta: Pergunta;
  idx: number;
  valor: Valor | undefined;
  onResponder: (v: Valor) => void;
  onAvancar: () => void;
  onVoltar: () => void;
  concluindo: boolean;
}) {
  const total = TOTAL_PERGUNTAS;
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
    <div>
      {/* Progresso */}
      <div className="mb-6">
        <div className="h-[6px] w-full overflow-hidden rounded-full bg-[var(--surface)]">
          <div
            className="h-full rounded-full bg-[var(--secondary)] transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-[12px] text-[var(--muted)]">
          Pergunta {idx + 1} de {total}
          {pergunta.opcional ? " · opcional" : ""}
        </p>
      </div>

      <h2
        id={`pergunta-${pergunta.id}`}
        className="font-cabinet text-[22px] leading-[1.2] tracking-[-0.01em] text-[var(--ink)] md:text-[26px]"
      >
        {pergunta.titulo}
      </h2>
      {pergunta.ajuda && <p className="mt-2 text-[14px] text-[var(--muted)]">{pergunta.ajuda}</p>}

      <div className="mt-6" role="group" aria-labelledby={`pergunta-${pergunta.id}`}>
        {pergunta.tipo === "aberta" ? (
          <textarea
            value={typeof valor === "string" ? valor : ""}
            onChange={(e) => onResponder(e.target.value)}
            placeholder={pergunta.placeholder}
            rows={5}
            maxLength={2000}
            className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--secondary)] focus:ring-4 focus:ring-[var(--secondary-light)]"
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
          <button
            type="button"
            onClick={onVoltar}
            className="rounded-lg px-3 py-2 text-[15px] text-[var(--muted)] hover:text-[var(--ink-soft)]"
          >
            Voltar
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onAvancar}
          disabled={!podeAvancar || concluindo}
          className="rounded-xl bg-[var(--secondary)] px-8 py-3 text-[16px] font-semibold text-[var(--secondary-ink)] transition-[filter] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
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
    <div>
      <h2 className="font-cabinet text-[26px] leading-[1.15] tracking-[-0.02em] text-[var(--ink)]">
        Quer saber quando a Pólia abrir?
      </h2>
      <p className="mt-3 text-[16px] leading-[1.5] text-[var(--ink-soft)]">
        É onde a sua marca fica clara e o seu negócio começa a valer, e faturar, mais. Deixa seu
        nome e e-mail que eu te aviso. Só o aviso do lançamento, nada de spam.
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
            placeholder="Como podemos te chamar?"
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              if (errors.nome) setErrors((er) => ({ ...er, nome: undefined }));
            }}
            aria-invalid={!!errors.nome || undefined}
            aria-describedby={errors.nome ? "p-nome-erro" : undefined}
            className={`w-full rounded-lg border bg-white px-4 py-3 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:ring-4 ${
              errors.nome
                ? "border-[var(--danger)] focus:border-[var(--danger)]"
                : "border-[var(--line)] focus:border-[var(--secondary)] focus:ring-[var(--secondary-light)]"
            }`}
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
            className={`w-full rounded-lg border bg-white px-4 py-3 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:ring-4 ${
              errors.email
                ? "border-[var(--danger)] focus:border-[var(--danger)]"
                : "border-[var(--line)] focus:border-[var(--secondary)] focus:ring-[var(--secondary-light)]"
            }`}
          />
          <FieldError id="p-email-erro">{errors.email}</FieldError>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-[14px] text-[var(--ink-soft)]">
          <input
            type="checkbox"
            checked={aceite}
            onChange={(e) => {
              setAceite(e.target.checked);
              if (e.target.checked) setErrors((er) => ({ ...er, aceite: false }));
            }}
            className="mt-[2px] h-[18px] w-[18px] flex-none accent-[var(--secondary)]"
          />
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
        </label>
        {errors.aceite && (
          <p className="text-[13px] text-[var(--danger)]">
            Falta marcar essa caixinha pra eu poder te avisar.
          </p>
        )}

        <TurnstileWidget containerRef={ts.containerRef} />

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-xl bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] transition-[filter] hover:brightness-95 disabled:opacity-60"
        >
          {enviando ? "Enviando…" : "Quero ser avisada"}
        </button>
        <button
          type="button"
          onClick={onPular}
          className="text-[14px] text-[var(--muted)] hover:text-[var(--ink-soft)]"
        >
          Prefiro não deixar meu e-mail
        </button>
      </form>
    </div>
  );
}

// ── Tela: fim ───────────────────────────────────────────────────────────────
function TelaFim() {
  return (
    <div className="rounded-2xl bg-[var(--surface-pink)] p-8" role="status" aria-live="polite">
      <h2 className="font-cabinet text-[26px] leading-[1.15] tracking-[-0.02em] text-[var(--ink)]">
        Pronto. Obrigada por dividir isso.
      </h2>
      <p className="mt-3 text-[16px] leading-[1.5] text-[var(--ink-soft)]">
        Cada resposta ajuda a Pólia a nascer do jeito certo pra ajudar quem toca ou tá começando o
        seu negócio. De verdade.
      </p>
      <div className="mt-5">
        <Link
          to="/lista-de-espera"
          className="inline-flex rounded-lg border border-[var(--ink)] px-6 py-3 text-[15px] font-semibold text-[var(--ink)] no-underline transition-colors hover:bg-[var(--ink)] hover:text-white"
        >
          Entrar na lista de espera
        </Link>
      </div>
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────
function PesquisaPage() {
  const dados = Route.useLoaderData();
  const [sessaoId, setSessaoId] = useState("");
  const [pronto, setPronto] = useState(false);
  const [jaRespondeu, setJaRespondeu] = useState(false);

  const [tela, setTela] = useState<"intro" | "pergunta" | "contato" | "fim">("intro");
  const [idx, setIdx] = useState(0);
  const [respostas, setRespostas] = useState<Respostas>({});
  const [concluindo, setConcluindo] = useState(false);

  useEffect(() => {
    setSessaoId(getOrCreateSessao());
    if (typeof window !== "undefined" && localStorage.getItem(FEITA_KEY) === "1") {
      setJaRespondeu(true);
    }
    setPronto(true);
    track("pesquisa_vista");
  }, []);

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
    const p = PESQUISA_DISCOVERY.perguntas[idx];
    setRespostas((r) => ({ ...r, [p.id]: v }));
  }

  async function avancar() {
    const p = PESQUISA_DISCOVERY.perguntas[idx];
    const progresso = p.ordem;
    if (idx === TOTAL_PERGUNTAS - 1) {
      setConcluindo(true);
      try {
        await salvarPesquisa({
          data: { sessaoId, progresso, concluida: true, respostas, hp: undefined },
        });
      } catch {
        // Se a gravação final falhar, ainda deixamos ela seguir pro contato; o
        // progresso anterior já está salvo. Não travamos a experiência.
      }
      if (typeof window !== "undefined") localStorage.setItem(FEITA_KEY, "1");
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
      PERGUNTAS_POR_ID["categoria"]?.opcoes?.find((o) => o.id === respostas["categoria"])?.rotulo ??
      null;
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

  if (!dados.aberta) {
    return (
      <Casca>
        <h1 className="font-cabinet text-[28px] tracking-[-0.02em] text-[var(--ink)]">
          A pesquisa está fechada por enquanto.
        </h1>
        <p className="mt-3 text-[16px] text-[var(--ink-soft)]">
          Obrigada pelo interesse. Enquanto isso, dá pra entrar na lista de espera.
        </p>
        <div className="mt-5">
          <Link
            to="/lista-de-espera"
            className="inline-flex rounded-lg border border-[var(--ink)] px-6 py-3 text-[15px] font-semibold text-[var(--ink)] no-underline transition-colors hover:bg-[var(--ink)] hover:text-white"
          >
            Entrar na lista de espera
          </Link>
        </div>
      </Casca>
    );
  }

  if (jaRespondeu && tela === "intro") {
    return (
      <Casca>
        <h1 className="font-cabinet text-[28px] tracking-[-0.02em] text-[var(--ink)]">
          Você já respondeu. Obrigada de novo.
        </h1>
        <p className="mt-3 text-[16px] text-[var(--ink-soft)]">
          Sua resposta já entrou. Não precisa responder outra vez.
        </p>
        <div className="mt-5">
          <Link
            to="/lista-de-espera"
            className="inline-flex rounded-lg border border-[var(--ink)] px-6 py-3 text-[15px] font-semibold text-[var(--ink)] no-underline transition-colors hover:bg-[var(--ink)] hover:text-white"
          >
            Entrar na lista de espera
          </Link>
        </div>
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
          pergunta={PESQUISA_DISCOVERY.perguntas[idx]}
          idx={idx}
          valor={respostas[PESQUISA_DISCOVERY.perguntas[idx].id]}
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
