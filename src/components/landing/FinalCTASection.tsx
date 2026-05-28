import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { StarField } from "@/components/ui/StarField";
import { UploadablePlaceholder } from "./UploadablePlaceholder";
import { LandingFooter } from "./LandingFooter";
import { useIsMobile } from "@/hooks/use-mobile";

export function FinalCTASection() {
  const isMobile = useIsMobile();

  return (
    <section
      style={{
        background: "var(--azul-noite)",
        padding: "100px 24px 140px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0, opacity: 0.6 }}>
        <StarField density={50} speed={0.6} />
      </div>

      {/* Hills decorativos */}
      <svg
        viewBox="0 0 1440 200"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 200,
          pointerEvents: "none",
        }}
      >
        <ellipse cx="200" cy="220" rx="500" ry="80" fill="#181830" />
        <ellipse cx="900" cy="230" rx="600" ry="90" fill="#1B1B32" />
        <ellipse cx="1300" cy="225" rx="450" ry="75" fill="#1F1F36" />
      </svg>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-15%" }}
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
        }}
        style={{
          maxWidth: 600,
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
        }}
      >
        <motion.div
          variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
          style={{
            margin: "0 auto 40px",
            width: 180,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <UploadablePlaceholder
            id="fox-feliz"
            label="RAPOSA - FELIZ"
            width={180}
            height={200}
            description="fox-feliz.png, fundo transparente, 360x400px"
          />
        </motion.div>

        <motion.h2
          variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
          className="font-serif"
          style={{
            fontSize: isMobile ? 38 : 52,
            color: "#fff",
            lineHeight: 1.1,
            marginBottom: 20,
          }}
        >
          Sua jornada começa aqui.
        </motion.h2>

        <motion.p
          variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
          className="font-sans"
          style={{
            fontSize: 17,
            color: "rgba(255,255,255,0.55)",
            lineHeight: 1.6,
            marginBottom: 8,
          }}
        >
          Gratuito durante o beta. Sem cartão de crédito.
        </motion.p>

        <motion.p
          variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
          className="font-caveat"
          style={{
            fontSize: 18,
            color: "rgba(255,255,255,0.40)",
          }}
        >
          Já são 47 mulheres na lista de espera.
        </motion.p>

        <motion.div
          variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
          style={{ marginTop: 44 }}
        >
          <Link
            to="/auth/cadastro"
            className="polia-final-cta font-sans"
            style={{
              background: "var(--terracota)",
              color: "#fff",
              fontSize: 17,
              fontWeight: 600,
              padding: "18px 48px",
              borderRadius: 12,
              minWidth: 280,
              display: "inline-block",
              position: "relative",
              overflow: "hidden",
              textDecoration: "none",
              transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <span style={{ position: "relative", zIndex: 1 }}>
              Entrar na lista de espera
            </span>
          </Link>
        </motion.div>

        <motion.div
          variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
          style={{ marginTop: 24 }}
        >
          <Link
            to="/auth/login"
            className="polia-final-login font-sans"
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.45)",
              transition: "color 0.2s ease",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Já tenho conta. Entrar
          </Link>
        </motion.div>
      </motion.div>

      <LandingFooter />

      <style>{`
        .polia-final-cta::before {
          content: "";
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          transition: left 0.6s ease;
        }
        .polia-final-cta:hover {
          transform: translateY(-3px);
          box-shadow: 0 16px 40px rgba(201,107,62,0.45);
        }
        .polia-final-cta:hover::before {
          left: 100%;
        }
        .polia-final-cta:active {
          transform: translateY(-1px);
        }
        .polia-final-login:hover {
          color: rgba(255,255,255,0.75) !important;
        }
      `}</style>
    </section>
  );
}
