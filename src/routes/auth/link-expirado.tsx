import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SiteErrorPage } from "@/components/layout/SiteErrorPage";

const searchSchema = z.object({
  tipo: z.enum(["confirmacao", "redefinicao"]).default("redefinicao"),
});

export const Route = createFileRoute("/auth/link-expirado")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [{ title: "Link expirado · Pólia" }],
  }),
  component: LinkExpiradoPage,
});

const COPY = {
  confirmacao: {
    title: "Esse link de confirmação expirou.",
    subtitle:
      "Links de confirmação valem por 24 horas. Entra com o e-mail e a senha que já criou, que a gente manda um link novo na hora.",
    primaryLabel: "Entrar e pedir link",
    primaryHref: "/auth/login",
  },
  redefinicao: {
    title: "Esse link de redefinir senha expirou.",
    subtitle:
      "Links de redefinição valem por 1 hora. É só pedir um novo que a gente manda na hora.",
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
