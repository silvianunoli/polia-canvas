import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Preloader } from "@/components/landing/Preloader";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { JourneySection } from "@/components/landing/JourneySection";
import { ProductRevealSection } from "@/components/landing/ProductRevealSection";
import { DeliverablesSection } from "@/components/landing/DeliverablesSection";
import { ManifestoSection } from "@/components/landing/ManifestoSection";
import { FinalCTASection } from "@/components/landing/FinalCTASection";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pólia — Para mulheres que constroem" },
      {
        name: "description",
        content:
          "Plataforma guiada com 11 etapas para mulheres empreendedoras brasileiras estruturarem seu negócio com base sólida.",
      },
      { property: "og:title", content: "Pólia — Para mulheres que constroem" },
      {
        property: "og:description",
        content: "11 etapas guiadas para estruturar seu negócio. Lançamento maio/2026.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [isFirstVisit] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("polia-visited");
  });

  return (
    <div style={{ background: "var(--azul-noite)", minHeight: "100vh" }}>
      <Preloader />
      <Navbar />
      <HeroSection preloader={isFirstVisit} />
      <ProblemSection />
      <JourneySection />
      <ProductRevealSection />
      <DeliverablesSection />
      <ManifestoSection />
      <FinalCTASection />
    </div>
  );
}
