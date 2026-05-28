import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { StarField } from "@/components/ui/StarField";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pólia — Seu negócio tem uma direção agora." },
      {
        name: "description",
        content:
          "A Pólia guia mulheres empreendedoras pelas 11 etapas que todo negócio precisa percorrer. Comece com clareza. Construa com direção.",
      },
      { property: "og:title", content: "Pólia — Seu negócio tem uma direção agora." },
      {
        property: "og:description",
        content: "11 etapas. 4 fases. Um negócio que é seu.",
      },
    ],
  }),
  component: LandingPage,
});

import { useEffect, useState } from "react";
import { Preloader } from "@/components/landing/Preloader";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { JourneySection } from "@/components/landing/JourneySection";
import { ProductRevealSection } from "@/components/landing/ProductRevealSection";
import { DeliverablesSection } from "@/components/landing/DeliverablesSection";
import { ManifestoSection } from "@/components/landing/ManifestoSection";
import { FinalCTASection } from "@/components/landing/FinalCTASection";
import { ScrollProgress } from "@/components/landing/ScrollProgress";
import { CursorDot } from "@/components/landing/CursorDot";

function LandingPage() {
  const [isFirstVisit] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("polia-visited");
  });

  // Used in NotFound and could be useful, but only triggered here for export-completeness.
  void motion;
  void Link;
  void StarField;

  return (
    <div style={{ background: "var(--azul-noite)", minHeight: "100vh" }}>
      <Preloader />
      <ScrollProgress />
      <CursorDot />
      <Navbar />
      <main>
        <HeroSection preloader={isFirstVisit} />
        <ProblemSection />
        <div id="como-funciona">
          <JourneySection />
        </div>
        <ProductRevealSection />
        <DeliverablesSection />
        <div id="manifesto">
          <ManifestoSection />
        </div>
        <FinalCTASection />
      </main>
    </div>
  );
}

// Suppress unused-effect warnings if any
void useEffect;
