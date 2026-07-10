import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Mail, Clock, HelpCircle } from "lucide-react";
import { z } from "zod";
import { toastErro } from "@/lib/toast";
import { enviarContato } from "@/lib/contato.functions";
import { track } from "@/lib/analytics";
import { useTurnstile, TurnstileWidget } from "@/components/TurnstileWidget";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FieldError } from "@/components/ui/FieldError";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato · Pólia" },
      {
        name: "description",
        content:
          "Fala com a gente. A Pólia é do tamanho de uma pessoa só, então quem responde é gente de verdade, sem robô.",
      },
      { property: "og:title", content: "Contato · Pólia" },
      { property: "og:description", content: "Fala com a gente." },
    ],
  }),
  component: Contato,
});

const ASSUNTOS = [
  "Dúvida sobre a Pólia",
  "Acesso e conta",
  "Preço e pagamento",
  "Tenho equipe e quero gerir por aqui",
  "Imprensa ou parceria",
  "Outra coisa",
];

const schema = z.object({
  nome: z.string().trim().min(2, "Falta o seu nome.").max(120),
  assunto: z.string().min(1, "Escolhe um assunto."),
  mensagem: z.string().trim().min(10, "Conta um pouco mais.").max(2000),
});

function validarEmail(v: string): string | undefined {
  const trimmed = v.trim();
  if (!trimmed) return "Falta o seu e-mail.";
  if (trimmed.length > 255) return "E-mail inválido. Confere o @.";
  return z.string().email().safeParse(trimmed).success
    ? undefined
    : "E-mail inválido. Confere o @.";
}

type Campo = "nome" | "email" | "assunto" | "mensagem";

function Contato() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Campo, string>>>({});
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  // Honeypot: campo invisível fora do fluxo de teclado. Humano nunca preenche; bot que
  // preenche tudo, sim. Se vier preenchido, finge sucesso e não insere nada.
  const [hp, setHp] = useState("");
  const turnstile = useTurnstile();
  const refs = {
    nome: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    assunto: useRef<HTMLSelectElement>(null),
    mensagem: useRef<HTMLTextAreaElement>(null),
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("assunto") === "equipe") {
      setAssunto("Tenho equipe e quero gerir por aqui");
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Bot preencheu o honeypot: mostra "enviado" e descarta em silêncio, sem gravar.
    if (hp) {
      setEnviado(true);
      return;
    }
    const parsed = schema.safeParse({ nome, assunto, mensagem });
    const emailErro = validarEmail(email);
    if (!parsed.success || emailErro) {
      const fieldErrors: Partial<Record<Campo, string>> = {};
      const ordemCampos: Campo[] = ["nome", "email", "assunto", "mensagem"];
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          fieldErrors[issue.path[0] as Campo] = issue.message;
        }
      }
      if (emailErro) fieldErrors.email = emailErro;
      setErrors(fieldErrors);
      const primeiroCampo = ordemCampos.find((c) => fieldErrors[c]);
      track("formulario_invalido", { pagina: "contato", campo: primeiroCampo });
      if (primeiroCampo) refs[primeiroCampo].current?.focus();
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      // O Turnstile é validado no servidor (dentro de enviarContato). O token é
      // uso único, então aqui só checamos que existe — quem valida é o servidor.
      if (!turnstile.token) {
        toastErro("Confirma que não é um robô antes de enviar.");
        setLoading(false);
        return;
      }
      const resultado = await enviarContato({
        data: {
          nome: parsed.data.nome,
          email: email.trim(),
          assunto: parsed.data.assunto,
          mensagem: parsed.data.mensagem,
          turnstileToken: turnstile.token,
          hp,
        },
      });
      if (resultado.ok) {
        track("contato_enviado", { assunto: parsed.data.assunto });
        setEnviado(true);
      } else {
        track("contato_falhou", { motivo: "resultado_nao_ok" });
        turnstile.reset();
        toastErro("Não deu pra enviar agora. Tenta direto em oi@usepolia.com.br");
      }
    } catch {
      track("contato_falhou", { motivo: "excecao_client" });
      turnstile.reset();
      toastErro("Não deu pra enviar agora. Tenta direto em oi@usepolia.com.br");
    }
    setLoading(false);
  }

  return (
    <div className="polia-v3 min-h-screen bg-white text-[var(--ink)]">
      <SiteHeader />

      <main>
        <section className="pb-16 pt-16 md:pb-24 md:pt-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-2 md:gap-16">
              {/* coluna esquerda */}
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                  Contato
                </p>
                <h1 className="font-fraunces mt-4 text-[40px] leading-[1.05] tracking-[-0.02em] text-[var(--ink)] md:text-[56px]">
                  Fala com a gente.
                </h1>
                <p className="mt-6 max-w-[54ch] text-[18px] leading-[1.5] text-[var(--ink-soft)]">
                  A Pólia é do tamanho de uma pessoa só, dos dois lados. Quem responde aqui é gente
                  de verdade, não robô. Escreve que a gente lê.
                </p>

                <hr className="my-8 border-t border-[var(--line)]" />

                <div className="grid gap-6">
                  <div className="flex items-start gap-3">
                    <Mail
                      size={20}
                      className="mt-0.5 flex-none text-[var(--secondary-ink)]"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                        E-mail direto
                      </p>
                      <p className="mt-2">
                        <a
                          href="mailto:oi@usepolia.com.br"
                          className="text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]"
                        >
                          oi@usepolia.com.br
                        </a>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock
                      size={20}
                      className="mt-0.5 flex-none text-[var(--secondary-ink)]"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                        Tempo de resposta
                      </p>
                      <p className="mt-2 text-[var(--ink-soft)]">
                        A gente responde em até 24 horas, em dias úteis.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <HelpCircle
                      size={20}
                      className="mt-0.5 flex-none text-[var(--secondary-ink)]"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                        Dúvida rápida?
                      </p>
                      <p className="mt-2 text-[var(--ink-soft)]">
                        Talvez já esteja respondida na{" "}
                        <Link
                          to="/ajuda"
                          className="text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]"
                        >
                          Ajuda
                        </Link>
                        .
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* coluna direita */}
              <div className="rounded-xl border border-[var(--line)] bg-white p-8">
                {!enviado ? (
                  <form onSubmit={handleSubmit} className="grid gap-5" noValidate>
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
                      <label className="mb-2 block text-[13px] font-semibold text-[var(--ink)]">
                        Seu nome
                      </label>
                      <input
                        ref={refs.nome}
                        type="text"
                        value={nome}
                        onChange={(e) => {
                          setNome(e.target.value);
                          if (errors.nome) setErrors((er) => ({ ...er, nome: undefined }));
                        }}
                        maxLength={120}
                        placeholder="Como a gente te chama"
                        aria-invalid={!!errors.nome || undefined}
                        aria-describedby={errors.nome ? "nome-error" : undefined}
                        className={`w-full rounded-lg border bg-white px-4 py-3 text-[15px] text-[var(--ink)] outline-none transition-colors ${
                          errors.nome
                            ? "border-[var(--danger)] focus:border-[var(--danger)]"
                            : "border-[var(--line)] focus:border-[var(--secondary)]"
                        }`}
                      />
                      <FieldError id="nome-error">{errors.nome}</FieldError>
                    </div>
                    <div>
                      <label className="mb-2 block text-[13px] font-semibold text-[var(--ink)]">
                        Seu e-mail
                      </label>
                      <input
                        ref={refs.email}
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) setErrors((er) => ({ ...er, email: undefined }));
                        }}
                        maxLength={255}
                        placeholder="voce@email.com"
                        aria-invalid={!!errors.email || undefined}
                        aria-describedby={errors.email ? "email-error" : undefined}
                        className={`w-full rounded-lg border bg-white px-4 py-3 text-[15px] text-[var(--ink)] outline-none transition-colors ${
                          errors.email
                            ? "border-[var(--danger)] focus:border-[var(--danger)]"
                            : "border-[var(--line)] focus:border-[var(--secondary)]"
                        }`}
                      />
                      <FieldError id="email-error">{errors.email}</FieldError>
                    </div>
                    <div>
                      <label className="mb-2 block text-[13px] font-semibold text-[var(--ink)]">
                        Assunto
                      </label>
                      <select
                        ref={refs.assunto}
                        value={assunto}
                        onChange={(e) => {
                          setAssunto(e.target.value);
                          if (errors.assunto) setErrors((er) => ({ ...er, assunto: undefined }));
                        }}
                        aria-invalid={!!errors.assunto || undefined}
                        aria-describedby={errors.assunto ? "assunto-error" : undefined}
                        className={`w-full appearance-none rounded-lg border bg-white px-4 py-3 text-[15px] text-[var(--ink)] outline-none transition-colors ${
                          errors.assunto
                            ? "border-[var(--danger)] focus:border-[var(--danger)]"
                            : "border-[var(--line)] focus:border-[var(--secondary)]"
                        }`}
                      >
                        <option value="" disabled>
                          Escolher assunto
                        </option>
                        {ASSUNTOS.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                      <FieldError id="assunto-error">{errors.assunto}</FieldError>
                    </div>
                    <div>
                      <label className="mb-2 block text-[13px] font-semibold text-[var(--ink)]">
                        Mensagem
                      </label>
                      <textarea
                        ref={refs.mensagem}
                        value={mensagem}
                        onChange={(e) => {
                          setMensagem(e.target.value);
                          if (errors.mensagem) setErrors((er) => ({ ...er, mensagem: undefined }));
                        }}
                        rows={5}
                        maxLength={2000}
                        placeholder="Conta pra gente. Uma coisa de cada vez."
                        aria-invalid={!!errors.mensagem || undefined}
                        aria-describedby={errors.mensagem ? "mensagem-error" : undefined}
                        className={`w-full resize-none rounded-lg border bg-white px-4 py-3 text-[15px] text-[var(--ink)] outline-none transition-colors ${
                          errors.mensagem
                            ? "border-[var(--danger)] focus:border-[var(--danger)]"
                            : "border-[var(--line)] focus:border-[var(--secondary)]"
                        }`}
                      />
                      <FieldError id="mensagem-error">{errors.mensagem}</FieldError>
                    </div>
                    <TurnstileWidget containerRef={turnstile.containerRef} />
                    <button
                      type="submit"
                      disabled={loading}
                      className="mt-1 w-full rounded-lg bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] transition-[filter] hover:brightness-95 disabled:opacity-50"
                    >
                      {loading ? "Enviando…" : "Enviar"}
                    </button>
                  </form>
                ) : (
                  <div
                    role="status"
                    aria-live="polite"
                    className="rounded-xl bg-[var(--surface-pink)] p-8"
                  >
                    <h2 className="font-fraunces max-w-[20ch] text-[24px] text-[var(--ink)]">
                      Recebido. A gente te responde.
                    </h2>
                    <p className="mt-3 text-[var(--ink-soft)]">
                      Chegou aqui. A gente responde em até 24 horas, em dias úteis, no seu e-mail.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
