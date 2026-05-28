import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { StarField } from "@/components/ui/StarField";
import { UploadablePlaceholder } from "./UploadablePlaceholder";

interface HeroSectionProps {
  preloader?: boolean;
}

export function HeroSection({ preloader = false }: HeroSectionProps) {
  const mockupRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const onMockupMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = mockupRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width - 0.5;
    const my = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transition = "transform 0.1s ease-out";
    el.style.transform = `rotateY(${-4 + mx * 10}deg) rotateX(${my * -6}deg)`;
  };
  const onMockupLeave = () => {
    const el = mockupRef.current;
    if (!el) return;
    el.style.transition = "transform 0.6s ease";
    el.style.transform = "rotateY(-4deg) rotateX(2deg)";
  };

  const leftDelay = preloader ? 2.4 : 0.3;
  const rightDelay = preloader ? 2.6 : 0.5;

  return (
    <section
      className="relative flex items-center overflow-hidden"
      style={{ minHeight: "100vh", background: "var(--azul-noite)" }}
    >
      <StarField density={70} />

      {/* Glow orbs */}
      <div
        className="pointer-events-none absolute"
        style={{
          zIndex: 1,
          top: "-20%",
          right: "-10%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(201,107,62,0.10) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          zIndex: 1,
          bottom: "-30%",
          left: "-15%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(200,169,110,0.07) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      {/* Hills */}
      <div className="pointer-events-none absolute inset-x-0" style={{ zIndex: 2, bottom: 0 }}>
        <div
          style={{
            position: "absolute",
            left: "-10%",
            right: "-10%",
            bottom: 0,
            height: 100,
            background: "#161629",
            borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "-5%",
            right: "-5%",
            bottom: 0,
            height: 140,
            background: "#131324",
            borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "-10%",
            right: "-10%",
            bottom: -2,
            height: 180,
            background: "#0F0F1A",
            borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
          }}
        />
      </div>

      {/* Content */}
      <div
        className="relative mx-auto grid w-full"
        style={{
          zIndex: 10,
          maxWidth: 1200,
          padding: isMobile ? "100px 24px 160px" : "120px 24px 180px",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 60,
          alignItems: "center",
        }}
      >
        {/* Left */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: leftDelay, ease: [0.22, 1, 0.36, 1] }}
        >
          <p
            className="font-caveat"
            style={{ fontSize: 22, color: "var(--terracota)", marginBottom: 16 }}
          >
            Chegou a hora.
          </p>
          <h1
            className="font-serif"
            style={{
              fontSize: isMobile ? 52 : 72,
              color: "#fff",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Seu negócio tem uma direção agora.
          </h1>
          <p
            className="font-sans"
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.70)",
              lineHeight: 1.7,
              maxWidth: 480,
              marginTop: 24,
            }}
          >
            A Pólia guia você pelas 11 etapas que toda empreendedora precisa percorrer. Na ordem certa. No seu tempo.
          </p>

          <div className="flex flex-wrap items-center" style={{ gap: 16, marginTop: 40 }}>
            <Link
              to="/lista-de-espera"
              className="font-sans font-semibold relative overflow-hidden polia-shimmer-btn"
              style={{
                background: "var(--terracota)",
                color: "#fff",
                fontSize: 16,
                padding: "14px 28px",
                borderRadius: 10,
                display: "inline-block",
                transition: "transform 0.25s ease, box-shadow 0.25s ease",
              }}
            >
              <span style={{ position: "relative", zIndex: 1 }}>Entrar na lista</span>
            </Link>
            <Link
              to="/como-funciona"
              className="font-sans transition-colors"
              style={{ fontSize: 16, color: "rgba(255,255,255,0.6)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
            >
              Como funciona →
            </Link>
          </div>

          <div className="flex items-center" style={{ gap: 6, marginTop: 60 }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.4)",
                  animation: i === 1 ? "polia-scroll-pulse 1.5s ease-in-out infinite" : undefined,
                }}
              />
            ))}
          </div>
        </motion.div>

        {/* Right */}
        {!isMobile && (
          <motion.div
            initial={{ opacity: 0, x: 40, rotateY: -12 }}
            animate={{ opacity: 1, x: 0, rotateY: -4 }}
            transition={{ duration: 1, delay: rightDelay, ease: [0.22, 1, 0.36, 1] }}
            style={{ perspective: "1000px", transformStyle: "preserve-3d" }}
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              style={{ position: "relative" }}
            >
              <div
                ref={mockupRef}
                onMouseMove={onMockupMove}
                onMouseLeave={onMockupLeave}
                style={{
                  transform: "rotateY(-4deg) rotateX(2deg)",
                  transformStyle: "preserve-3d",
                  willChange: "transform",
                }}
              >
                <UploadablePlaceholder
                  id="hero-mockup"
                  label="Mockup do produto"
                  description="Recomendado: 560×400px"
                  width={560}
                  height={400}
                />
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: -20,
                  left: "10%",
                  right: "10%",
                  height: 40,
                  background:
                    "radial-gradient(ellipse, rgba(0,0,0,0.4) 0%, transparent 70%)",
                  filter: "blur(12px)",
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </div>

      <style>{`
        .polia-shimmer-btn::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
          transform: translateX(-100%);
          transition: transform 0.5s ease;
          pointer-events: none;
        }
        .polia-shimmer-btn:hover::before { transform: translateX(100%); }
        .polia-shimmer-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(201,107,62,0.4);
        }
      `}</style>
    </section>
  );
}
