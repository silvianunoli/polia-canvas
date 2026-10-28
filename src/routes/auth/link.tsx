import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, SerifHeadline } from "@/components/cosmic/AuthShell";
import {
  TIPOS_DE_LINK,
  caminhoSeguro,
  destinoPadraoDoLink,
  tipoDoLinkExpirado,
} from "@/lib/linkDoApp";

// Porta de entrada dos links de e-mail (AND-09, plano docs/plano-login-no-app.md).
// O link aponta pro nosso domínio, não pro servidor de login do Supabase: assim
// o Android abre ele direto no app (App Links) e, no computador, o endereço do
// e-mail é o da Pólia. A página confirma o token_hash pelo verifyOtp e segue
// pro destino; link vencido ou já usado vai pra /auth/link-expirado.

const searchSchema = z.object({
  token_hash: z.string().min(1).max(500).optional(),
  type: z.enum(TIPOS_DE_LINK).optional(),
  next: z.string().max(300).optional(),
});

export const Route = createFileRoute("/auth/link")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      // Não é conteúdo de busca: fica fora do índice.
      { name: "robots", content: "noindex, nofollow" },
      { title: "Entrando · Pólia" },
    ],
  }),
  component: LinkPage,
});

function LinkPage() {
  const { token_hash, type, next } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  // O token é de uso único: o efeito duplo do modo estrito gastaria ele.
  const tentou = useRef(false);

  useEffect(() => {
    if (tentou.current) return;
    tentou.current = true;
    const destino = (type && caminhoSeguro(next)) || (type ? destinoPadraoDoLink(type) : "/painel");
    if (!token_hash || !type) {
      navigate({ to: "/auth/link-expirado", search: { tipo: "confirmacao" }, replace: true });
      return;
    }
    void supabase.auth.verifyOtp({ token_hash, type }).then(({ error }) => {
      if (error) {
        navigate({
          to: "/auth/link-expirado",
          search: { tipo: tipoDoLinkExpirado(type, destino) },
          replace: true,
        });
        return;
      }
      // Destino é caminho interno validado (caminhoSeguro ou o padrão do tipo)
      // e pode trazer query: vai pelo history, não pelo navigate tipado.
      router.history.replace(destino);
    });
  }, [token_hash, type, next, navigate, router]);

  return (
    <AuthShell>
      <SerifHeadline size={28}>Entrando na Pólia One.</SerifHeadline>
      <p aria-live="polite" className="mt-3 text-center text-[15px] text-[var(--ink-soft)]">
        Conferindo o link do e-mail. Leva um segundo.
      </p>
    </AuthShell>
  );
}
