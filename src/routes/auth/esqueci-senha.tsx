import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, Check } from "lucide-react";
import { AuthShell, AuthButton, SerifHeadline } from "@/components/cosmic/AuthShell";
import { CosmicInput } from "@/components/cosmic/CosmicInput";
import { useRecuperarSenha } from "@/hooks/useRecuperarSenha";

export const Route = createFileRoute("/auth/esqueci-senha")({
  head: () => ({
    meta: [
      // Não é conteúdo de busca: fica fora do índice.
      { name: "robots", content: "noindex, nofollow" },
      { title: "Esqueci minha senha · Pólia" },
      {
        name: "description",
        content:
          "Recuperação de acesso à conta Pólia. Um link pra criar uma nova senha, direto no e-mail.",
      },
    ],
  }),
  component: EsqueciSenhaPage,
});

function EsqueciSenhaPage() {
  const { email, setEmail, error, setError, loading, sent, cooldown, handleSubmit, handleResend } =
    useRecuperarSenha();

  return (
    <AuthShell maxWidth={420}>
      {!sent ? (
        <>
          <SerifHeadline size={26}>Vamos recuperar.</SerifHeadline>
          <p className="mt-2 text-center text-[14px] leading-relaxed text-[var(--ink-soft)]">
            É só informar o e-mail da conta que a gente manda o link.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3" noValidate>
            <CosmicInput
              label="Seu e-mail"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="voce@seunegocio.com.br"
              icon={<Mail size={18} />}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(undefined);
              }}
              error={error}
              reserveErrorSpace
              disabled={loading}
            />
            <div className="mt-1">
              <AuthButton type="submit" fullWidth loading={loading}>
                {loading ? (
                  "Enviando..."
                ) : (
                  <>
                    Enviar link <span aria-hidden="true">→</span>
                  </>
                )}
              </AuthButton>
            </div>
          </form>

          <p className="mt-5 text-center text-[14px] text-[var(--muted)]">
            <Link to="/auth/login" className="text-[var(--ink-soft)] underline underline-offset-2">
              Lembrei a senha
            </Link>
          </p>
        </>
      ) : (
        <div className="flex flex-col items-center text-center">
          <div className="mt-1 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--secondary-light)] text-[var(--secondary-ink)]">
            <Check size={22} aria-hidden="true" />
          </div>
          <h2 className="font-cabinet mt-3 text-[22px] leading-snug text-[var(--ink)]">
            Se esse e-mail tiver conta,
            <br />a gente manda o link.
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Confira a caixa de entrada (e o spam). O link vale por 1 hora.
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || loading}
            className="mt-5 text-[13.5px] text-[var(--ink-soft)] underline underline-offset-2 disabled:text-[var(--muted)] disabled:no-underline"
          >
            {cooldown > 0 ? `Pode pedir outro em ${cooldown}s` : "Não chegou? Pedir de novo"}
          </button>
          <Link to="/auth/login" className="mt-6 text-[14px] text-[var(--muted)]">
            Voltar pra entrada
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
