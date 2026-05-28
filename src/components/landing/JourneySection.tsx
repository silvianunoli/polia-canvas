import { useEffect, useRef, useState } from "react";
import { StarField } from "@/components/ui/StarField";

interface Etapa {
  numero: number;
  nome: string;
  subtitulo: string;
  fase: string;
  corFase: string;
}

const etapas: Etapa[] = [
  { numero: 1, nome: "Descoberta", subtitulo: "Quem você é. Quem você quer alcançar.", fase: "Sonho", corFase: "#C9407A" },
  { numero: 2, nome: "Identidade do seu negócio", subtitulo: "Que cara, que vibe, que palavras te representam.", fase: "Sonho", corFase: "#C9407A" },
  { numero: 3, nome: "Modelo de Negócio", subtitulo: "Por que você existe, pra quem e por que escolheriam você.", fase: "Sonho", corFase: "#C9407A" },
  { numero: 4, nome: "Presença digital", subtitulo: "O que você vende, como entrega e quanto cobra.", fase: "Construção", corFase: "#1A7FAD" },
  { numero: 5, nome: "Conteúdo", subtitulo: "Onde te acham, como você aparece e como compram.", fase: "Construção", corFase: "#1A7FAD" },
  { numero: 6, nome: "Sua rotina", subtitulo: "Quanto você produz, como organiza e quando repõe.", fase: "Construção", corFase: "#1A7FAD" },
  { numero: 7, nome: "Suas vendas", subtitulo: "Como ela sabe, se decide e fecha.", fase: "Venda", corFase: "#1A8F5C" },
  { numero: 8, nome: "Seus clientes", subtitulo: "Como acolhe, resolve e fideliza.", fase: "Venda", corFase: "#1A8F5C" },
  { numero: 9, nome: "Sua audiência", subtitulo: "O que ela consome, o que para o scroll, como você chega.", fase: "Venda", corFase: "#1A8F5C" },
  { numero: 10, nome: "Crescimento", subtitulo: "Que número, quando olhar, o que fazer.", fase: "Evolução", corFase: "#6B50CC" },
  { numero: 11, nome: "Sua rede", subtitulo: "Onde você quer estar, com quem, em quanto.", fase: "Evolução", corFase: "#6B50CC" },
];

const CARD_WIDTH = 220;
const CARD_GAP = 80;
const TRACK_PADDING = 80;
const LEFT_TITLE_OFFSET = 320;

function StarIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2l2.39 7.36H22l-6.18 4.49L18.21 21 12 16.5 5.79 21l2.39-7.15L2 9.36h7.61z" />
    </svg>
  );
}

function EtapaCard({ etapa, isLast }: { etapa: Etapa; isLast: boolean }) {
  return (
    <div style={{ flexShrink: 0, width: CARD_WIDTH, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: `1.5px solid ${etapa.corFase}80`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            background: "rgba(26,26,46,0.6)",
          }}
        >
          <StarIcon color={etapa.corFase} />
        </div>
        {!isLast && (
          <div
            style={{
              width: CARD_GAP,
              height: 1,
              background: `linear-gradient(90deg, ${etapa.corFase}66, transparent)`,
            }}
          />
        )}
      </div>
      <p
        className="font-sans"
        style={{
          fontSize: 11,
          color: etapa.corFase,
          marginTop: 16,
          letterSpacing: "0.08em",
        }}
      >
        ETAPA {String(etapa.numero).padStart(2, "0")}
      </p>
      <h3
        className="font-serif"
        style={{
          fontSize: 18,
          color: "#fff",
          lineHeight: 1.25,
          marginTop: 6,
          maxWidth: 180,
        }}
      >
        {etapa.nome}
      </h3>
      <p
        className="font-sans"
        style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.45)",
          lineHeight: 1.5,
          marginTop: 8,
          maxWidth: 180,
        }}
      >
        {etapa.subtitulo}
      </p>
    </div>
  );
}

export function JourneySection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (isMobile) return;
    let raf = 0;
    const update = () => {
      const section = sectionRef.current;
      const track = trackRef.current;
      if (!section || !track) return;
      const rect = section.getBoundingClientRect();
      const winH = window.innerHeight;
      const total = section.offsetHeight - winH;
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      const progress = total > 0 ? scrolled / total : 0;
      const trackWidth = track.scrollWidth;
      const maxTranslate = Math.max(0, trackWidth - window.innerWidth + LEFT_TITLE_OFFSET);
      const tx = progress * maxTranslate;
      track.style.transform = `translate3d(${-tx}px, -50%, 0)`;
      if (progressFillRef.current) {
        progressFillRef.current.style.height = `${progress * 100}%`;
      }
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [isMobile]);

  // Phase badge positions (above cards 1, 4, 7, 10 → indexes 0,3,6,9)
  const phaseAnchors = [0, 3, 6, 9];

  const trackWidth = etapas.length * CARD_WIDTH + (etapas.length - 1) * CARD_GAP + TRACK_PADDING * 2;

  // SVG path through star centers
  // Star center x relative to track: TRACK_PADDING + i*(CARD_WIDTH+CARD_GAP) + 24
  const starY = 80; // arbitrary baseline within svg
  const starPoints = etapas.map((_, i) => ({
    x: TRACK_PADDING + i * (CARD_WIDTH + CARD_GAP) + 24,
    y: starY + Math.sin(i * 0.9) * 18,
  }));
  const pathD = starPoints
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = starPoints[i - 1];
      const cx = (prev.x + p.x) / 2;
      return `Q ${cx} ${prev.y}, ${p.x} ${p.y}`;
    })
    .join(" ");

  if (isMobile) {
    return (
      <section style={{ background: "var(--azul-noite)", padding: "80px 24px", position: "relative" }}>
        <StarField density={50} speed={0.4} />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 600, margin: "0 auto" }}>
          <p className="font-caveat" style={{ fontSize: 20, color: "var(--terracota)" }}>sua jornada</p>
          <h2 className="font-serif" style={{ fontSize: 36, color: "#fff", lineHeight: 1.15, marginTop: 4 }}>
            11 etapas. 4 fases.
          </h2>
          <p className="font-sans" style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", marginTop: 12, lineHeight: 1.6 }}>
            Cada etapa gera algo real que fica com você pra sempre.
          </p>
          <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 32 }}>
            {etapas.map((e) => (
              <EtapaCard key={e.numero} etapa={e} isLast />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      style={{
        position: "relative",
        height: `${etapas.length * 120}vh`,
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          background: "var(--azul-noite)",
        }}
      >
        <StarField density={80} speed={0.4} />

        {/* Glow orb */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 600,
            height: 600,
            background: "radial-gradient(circle, rgba(200,169,110,0.06) 0%, transparent 60%)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* Left fixed title */}
        <div
          style={{
            position: "absolute",
            left: 60,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 10,
            maxWidth: 260,
          }}
        >
          <p className="font-caveat" style={{ fontSize: 20, color: "var(--terracota)", margin: 0 }}>
            sua jornada
          </p>
          <h2
            className="font-serif"
            style={{ fontSize: 42, color: "#fff", lineHeight: 1.15, margin: "4px 0 0" }}
          >
            11 etapas. 4 fases.
          </h2>
          <p
            className="font-sans"
            style={{
              fontSize: 15,
              color: "rgba(255,255,255,0.55)",
              marginTop: 12,
              lineHeight: 1.6,
            }}
          >
            Cada etapa gera algo real que fica com você pra sempre.
          </p>
        </div>

        {/* Track */}
        <div
          ref={trackRef}
          style={{
            position: "absolute",
            left: LEFT_TITLE_OFFSET,
            top: "50%",
            transform: "translate3d(0, -50%, 0)",
            display: "flex",
            alignItems: "center",
            gap: 0,
            padding: `0 ${TRACK_PADDING}px`,
            willChange: "transform",
          }}
        >
          {/* SVG connector */}
          <svg
            width={trackWidth}
            height={200}
            style={{
              position: "absolute",
              left: 0,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 1,
              pointerEvents: "none",
            }}
          >
            <path
              d={pathD}
              stroke="rgba(200,169,110,0.25)"
              strokeWidth={1.5}
              fill="none"
              strokeDasharray="6 4"
              transform={`translate(0, ${100 - starY})`}
            />
          </svg>

          {/* Phase badges */}
          {phaseAnchors.map((idx) => {
            const e = etapas[idx];
            const left = TRACK_PADDING + idx * (CARD_WIDTH + CARD_GAP);
            return (
              <div
                key={`badge-${idx}`}
                style={{
                  position: "absolute",
                  left,
                  top: -60,
                  zIndex: 10,
                }}
              >
                <span
                  className="font-sans"
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "#fff",
                    background: `${e.corFase}33`,
                    border: `1px solid ${e.corFase}4D`,
                    padding: "4px 10px",
                    borderRadius: 999,
                  }}
                >
                  {e.fase}
                </span>
              </div>
            );
          })}

          {etapas.map((e, i) => (
            <div key={e.numero} style={{ position: "relative", zIndex: 2 }}>
              <EtapaCard etapa={e} isLast={i === etapas.length - 1} />
            </div>
          ))}
        </div>

        {/* Scroll progress indicator */}
        <div
          style={{
            position: "absolute",
            right: 40,
            bottom: 60,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 2,
              height: 80,
              background: "rgba(255,255,255,0.10)",
              borderRadius: 99,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              ref={progressFillRef}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "0%",
                background: "var(--terracota)",
                borderRadius: 99,
              }}
            />
          </div>
          <span
            className="font-sans"
            style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}
          >
            role para explorar
          </span>
        </div>
      </div>
    </section>
  );
}
