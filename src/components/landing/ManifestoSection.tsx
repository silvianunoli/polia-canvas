import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { StarField } from "@/components/ui/StarField";
import { useIsMobile } from "@/hooks/use-mobile";

export function ManifestoSection() {
  const isMobile = useIsMobile();
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setRevealed(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const reveal = (delay: number): React.CSSProperties => ({
    display: "inline-block",
    clipPath: revealed ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)",
    opacity: revealed ? 1 : 0,
    transition: `clip-path 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}ms, opacity 0.4s ease ${delay}ms`,
  });

  const lineSize = isMobile ? 40 : 64;
  const caveatSize = isMobile ? 24 : 32;

  return (
    <section
      ref={ref}
      style={{
        background: "var(--azul-noite)",
        overflow: "hidden",
        position: "relative",
        padding: isMobile ? "100px 24px" : "160px 24px",
        minHeight: "80vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <StarField density={90} speed={0.5} />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 800,
          height: 800,
          background: "radial-gradient(circle, rgba(200,169,110,0.05) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          textAlign: "center",
          position: "relative",
          zIndex: 1,
          maxWidth: 800,
          margin: "0 auto",
        }}
      >
        <h2
          className="font-serif"
          style={{
            fontSize: lineSize,
            color: "#fff",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          <span style={reveal(0)}>Você não precisa de mais um curso.</span>
        </h2>
        <h2
          className="font-serif"
          style={{
            fontSize: lineSize,
            color: "#fff",
            lineHeight: 1.1,
            margin: 0,
            marginTop: 8,
          }}
        >
          <span style={reveal(200)}>Você precisa de um começo.</span>
        </h2>

        <div style={{ height: 64 }} />

        <div
          className="caveat-decorativo"
          style={{ fontSize: caveatSize, color: "var(--terracota)" }}
        >
          <span style={reveal(600)}>E a Pólia começa com você.</span>
        </div>

        <div style={{ height: 48 }} />

        <p
          className="font-sans"
          style={{
            fontSize: 19,
            color: "rgba(255,255,255,0.55)",
            lineHeight: 1.6,
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          <span style={reveal(1000)}>
            Para a mulher que já sabe o que quer construir. Que só precisa saber por onde começar.
          </span>
        </p>

        <div style={{ height: 32 }} />

        <div style={reveal(1300)}>
          <Link
            to="/manifesto"
            className="caveat-decorativo polia-manifesto-link"
            style={{
              fontSize: 20,
              color: "rgba(255,255,255,0.50)",
              borderBottom: "1px solid rgba(255,255,255,0.20)",
              paddingBottom: 2,
              textDecoration: "none",
              transition: "color 0.2s ease, border-color 0.2s ease",
            }}
          >
            voar é um ato de coragem. Leia o manifesto.
          </Link>
        </div>
      </div>

      <style>{`
        .polia-manifesto-link:hover {
          color: rgba(255,255,255,0.80) !important;
          border-bottom-color: rgba(255,255,255,0.60) !important;
        }
      `}</style>
    </section>
  );
}
