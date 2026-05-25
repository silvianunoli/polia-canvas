import { createFileRoute } from "@tanstack/react-router";
import {
  AuthShell,
  CaveatEyebrow,
  SerifHeadline,
  SubText,
} from "@/components/cosmic/AuthShell";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [{ title: "Onboarding — Pólia" }],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  return (
    <AuthShell>
      <CaveatEyebrow>Ei. Finalmente você chegou.</CaveatEyebrow>
      <SerifHeadline>Vamos começar juntas.</SerifHeadline>
      <div className="mt-6">
        <SubText>
          Em breve, as primeiras perguntas para montar o seu começo aparecem aqui.
        </SubText>
      </div>
    </AuthShell>
  );
}
