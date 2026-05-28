import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { StarField } from "@/components/ui/StarField";

type Etapa = { n: number; nome: string; sub: string };
type Fase = { nome: string; cor: string; etapas: Etapa[] };

const fases: Fase[] = [
  {
    nome: "Sonho",
    cor: "#C9407A",
    etapas: [
      { n: 1, nome: "Descoberta", sub: "Quem você é. Quem você quer alcançar." },
      { n: 2, nome: "Identidade do seu negócio", sub: "Que cara, que vibe, que palavras te representam." },
      { n: 3, nome: "Modelo de Negócio", sub: "Por que você existe, pra quem e por que escolheriam você." },
    ],
  },
  {
    nome: "Construção",
    cor: "#1A7FAD",
    etapas: [
      { n: 4, nome: "Presença digital", sub: "O que você vende, como entrega e quanto cobra." },
      { n: 5, nome: "Conteúdo", sub: "Onde te acham, como você aparece e como compram." },
      { n: 6, nome: "Sua rotina", sub: "Quanto você produz, como organiza e quando repõe." },
    ],
  },
  {
    nome: "Venda",
    cor: "#1A8F5C",
    etapas: [
      { n: 7, nome: "Suas vendas", sub: "Como ela sabe, se decide e fecha." },
      { n: 8, nome: "Seus clientes", sub: "Como acolhe, resolve e fideliza." },
      { n: 9, nome: "Sua audiência", sub: "O que ela consome, o que para o scroll, como você chega." },
    ],
  },
  {
    nome: "Evolução",
    cor: "#6B50CC",
    etapas: [
      { n: 10, nome: "Crescimento", sub: "Que número, quando olhar, o que fazer." },
      { n: 11, nome: "Sua rede", sub: "Onde você quer estar, com quem, em quanto." },
    ],
  },
];

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function EtapaNode({
  etapa,
  cor,
  isLeft,
  delay,
  isMobile,
}: {
  etapa: Etapa;
  cor: string;
  isLeft: boolean;
  delay: number;
  isMobile: boolean;
}) {
  const [hover, setHover] = useState(false);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => e.isIntersecting && setInView(true),
      { rootMargin: "-80px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const colStart = isMobile ? 1 : isLeft ? 1 : 3;
  const justify = isMobile ? "flex-start" : isLeft ? "flex-end" : "flex-start";

  return (
    <div
      ref={ref}
      style={{
        gridColumn: colStart,
        gridRow: 1,
        display: "flex",
        justifyContent: justify,
        position: "relative",
        marginLeft: isMobile ? 52 : 0,
      }}
    >
      <motion.div
        initial={{ opacity: 0, x: isMobile ? 20 : isLeft ? -20 : 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          padding: "20px 24px",
          background: hover ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${hover ? hexA(cor, 0.4) : "rgba(255,255,255,0.07)"}`,
          borderRadius: 12,
          maxWidth: 340,
          transform: hover ? "translateY(-2px)" : "translateY(0)",
          transition: "background 0.25s, border-color 0.25s, transform 0.25s",
        }}
      >
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 10,
            color: cor,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 6,
            fontWeight: 500,
          }}
        >
          Etapa {String(etapa.n).padStart(2, "0")}
        </div>
        <div
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 22,
            color: "#fff",
            lineHeight: 1.2,
          }}
        >
          {etapa.nome}
        </div>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            color: "rgba(255,255,255,0.45)",
            lineHeight: 1.55,
            marginTop: 6,
          }}
        >
          {etapa.sub}
        </div>
      </motion.div>

      {/* Ponto na linha central */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: isMobile ? 20 : "50%",
          transform: isMobile
            ? `translate(-50%, -50%) scale(${inView ? 1 : 0})`
            : `translate(-50%, -50%) scale(${inView ? 1 : 0})`,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: cor,
          boxShadow: inView ? `0 0 0 4px ${hexA(cor, 0.2)}` : "none",
          transition: "transform 0.5s cubic-bezier(0.22,1,0.36,1), box-shadow 0.5s",
          zIndex: 2,
          marginLeft: isMobile ? 0 : undefined,
        }}
      />
    </div>
  );
}

function FaseGroup({
  fase,
  startIdx,
  isMobile,
}: {
  fase: Fase;
  startIdx: number;
  isMobile: boolean;
}) {
  return (
    <div style={{ marginBottom: 80 }}>
      {/* Badge */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 32,
          position: "relative",
          zIndex: 3,
        }}
      >
        <motion.span
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            display: "inline-block",
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            color: "#fff",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: hexA(fase.cor, 0.25),
            border: `1px solid ${hexA(fase.cor, 0.4)}`,
            padding: "6px 14px",
            borderRadius: 999,
            fontWeight: 500,
          }}
        >
          {fase.nome}
        </motion.span>
      </div>

      {/* Etapas */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {fase.etapas.map((etapa, i) => {
          const globalIdx = startIdx + i;
          const isLeft = globalIdx % 2 === 0;
          return (
            <div
              key={etapa.n}
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 48px 1fr",
                alignItems: "center",
                position: "relative",
              }}
            >
              <EtapaNode
                etapa={etapa}
                cor={fase.cor}
                isLeft={isLeft}
                delay={i * 0.12}
                isMobile={isMobile}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function JourneySection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, [isMobile]);

  useEffect(() => {
    const onScroll = () => {
      const el = containerRef.current;
      const path = pathRef.current;
      if (!el || !path || !pathLength) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height + vh;
      const scrolled = vh - rect.top;
      const progress = Math.min(1, Math.max(0, scrolled / total));
      path.style.strokeDashoffset = String(pathLength * (1 - progress));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathLength]);

  let startIdx = 0;

  return (
    <section
      style={{
        background: "var(--azul-noite)",
        padding: "120px 0 160px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <StarField density={60} speed={0.3} />

      {/* Contador decorativo */}
      {!isMobile && (
        <div
          style={{
            position: "absolute",
            top: 120,
            right: 60,
            textAlign: "right",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 120,
              color: "rgba(255,255,255,0.04)",
              lineHeight: 1,
            }}
          >
            11
          </div>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 11,
              color: "rgba(255,255,255,0.20)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            etapas
          </div>
        </div>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{
          textAlign: "center",
          padding: "0 24px",
          marginBottom: 80,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            color: "rgba(255,255,255,0.40)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            marginBottom: 16,
            fontWeight: 500,
          }}
        >
          A Jornada
        </div>
        <h2
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 48,
            color: "#fff",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          11 etapas. 4 fases.
        </h2>
        <div
          style={{
            fontFamily: "'Caveat', cursive",
            fontSize: 22,
            color: "var(--terracota)",
            marginTop: 12,
          }}
        >
          Um negócio que é seu.
        </div>
      </motion.div>

      {/* Timeline container */}
      <div
        ref={containerRef}
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "0 24px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* SVG line */}
        <svg
          width="2"
          height="100%"
          style={{
            position: "absolute",
            left: isMobile ? 32 : "50%",
            top: 0,
            height: "100%",
            transform: isMobile ? "none" : "translateX(-50%)",
            overflow: "visible",
            pointerEvents: "none",
          }}
          preserveAspectRatio="none"
        >
          <line
            x1="1"
            y1="0"
            x2="1"
            y2="100%"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="1.5"
          />
          <path
            ref={pathRef}
            d="M 1 0 L 1 10000"
            stroke={hexA("#C96B3E", 0.6)}
            strokeWidth="1.5"
            fill="none"
            style={{
              strokeDasharray: pathLength,
              strokeDashoffset: pathLength,
              transition: "stroke-dashoffset 0.1s linear",
            }}
          />
        </svg>

        {fases.map((fase) => {
          const group = (
            <FaseGroup
              key={fase.nome}
              fase={fase}
              startIdx={startIdx}
              isMobile={isMobile}
            />
          );
          startIdx += fase.etapas.length;
          return group;
        })}
      </div>
    </section>
  );
}
