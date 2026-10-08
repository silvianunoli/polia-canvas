import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SiteErrorPage } from "@/components/layout/SiteErrorPage";

const searchSchema = z.object({
  tipo: z.enum(["confirmacao", "redefinicao", "convite"]).default("redefinicao"),
});

export const Route = createFileRoute("/auth/link-expirado")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      // Não é conteúdo de busca: fica fora do índice.
      { name: "robots", content: "noindex, nofollow" },
      { title: "Link expirado · Pólia" },
    ],
  }),
  component: LinkExpiradoPage,
});

const COPY = {
  confirmacao: {
    title: "Esse link de confirmação expirou.",
    subtitle:
      "O link de confirmação vale por pouco tempo. Entra com o e-mail e a senha que já criou: a Pólia te dá a opção de reenviar o link na hora.",
    primaryLabel: "Entrar e pedir link",
    primaryHref: "/auth/login",
  },
  // Link de "Criar minha senha" do e-mail de compra (conta criada pelo
  // webhook): quem chega aqui nunca teve senha, então "entra com a senha que
  // já criou" não serve. O link de redefinir senha cria a primeira também.
  convite: {
    title: "Esse link de criar senha expirou.",
    subtitle:
      "A compra continua valendo. Pede um link novo com o e-mail da compra: ele serve pra criar a senha pela primeira vez.",
    primaryLabel: "Pedir um novo link",
    primaryHref: "/auth/esqueci-senha",
  },
  redefinicao: {
    title: "Esse link de redefinir senha expirou.",
    subtitle:
      "O link de redefinição vale por pouco tempo. É só pedir um novo que a Pólia manda na hora.",
    primaryLabel: "Pedir um novo link",
    primaryHref: "/auth/esqueci-senha",
  },
} as const;

function LinkExpiradoPage() {
  const { tipo } = Route.useSearch();
  const copy = COPY[tipo];
  return (
    <SiteErrorPage
      code="link-expirado"
      title={copy.title}
      subtitle={copy.subtitle}
      primaryAction={{ label: copy.primaryLabel, href: copy.primaryHref }}
    />
  );
}
