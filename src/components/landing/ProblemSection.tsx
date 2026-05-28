import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { XCircle } from "lucide-react";

const dores = [
  "Planilha que virou bagunça em uma semana",
  "Cobrar sem saber se o preço é justo",
  "Aparecer nas redes sem saber pra quem",
  "Sentir que todo mundo sabe algo que você não sabe",
  "Canva sem estratégia nenhuma por trás",
  "Começar e parar. Começar e parar.",
];

function PainCard({ text, index }: { text: string; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        padding: "20px 24px",
        background: "#ffffff",
        borderRadius: 10,
        border: "1px solid #E8E0D8",
        display: "flex",
        alignItems: "center",
        gap: 12,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.5s ease ${index * 80}ms, transform 0.5s ease ${index * 80}ms`,
      }}
    >
      <XCircle size={18} color="#E07B5A" style={{ flexShrink: 0 }} />
      <span
        className="font-sans"
        style={{ fontSize: 15, color: "#4A3728", lineHeight: 1.5 }}
      >
        {text}
      </span>
    </div>
  );
}

export function ProblemSection() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <section
      style={{
        background: "var(--creme)",
        position: "relative",
        padding: "120px 24px",
        clipPath: "polygon(0 5%, 100% 0, 100% 100%, 0% 100%)",
        marginTop: -80,
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <p
          className="font-sans"
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--terracota)",
            marginBottom: 48,
            textAlign: "center",
          }}
        >
          Você já sentiu isso
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: 16,
            maxWidth: 800,
            margin: "0 auto",
          }}
        >
          {dores.map((d, i) => (
            <PainCard key={i} text={d} index={i} />
          ))}
        </div>

        <div style={{ marginTop: 72, textAlign: "center" }}>
          <div
            style={{
              height: 1,
              background:
                "linear-gradient(90deg, transparent, rgba(201,107,62,0.3), transparent)",
              maxWidth: 200,
              margin: "0 auto 56px",
            }}
          />
          <motion.h2
            className="font-serif"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontSize: isMobile ? 34 : 48,
              color: "var(--azul-noite)",
              lineHeight: 1.2,
              maxWidth: 680,
              margin: "0 auto",
            }}
          >
            A Pólia não te ensina. Ela te mostra o caminho.
          </motion.h2>
          <motion.p
            className="font-caveat"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontSize: 22,
              color: "var(--terracota)",
              marginTop: 20,
            }}
          >
            Etapa por etapa. Entregável por entregável.
          </motion.p>
        </div>
      </div>
    </section>
  );
}
