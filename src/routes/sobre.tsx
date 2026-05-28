import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Compass, Heart, Star, Users } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { StarField } from "@/components/ui/StarField";
import { UploadablePlaceholder } from "@/components/landing/UploadablePlaceholder";
import { LandingFooter } from "@/components/landing/LandingFooter";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — Pólia" },
      {
        name: "description",
        content:
          "Por que a Pólia existe: um começo honesto para negócios reais, feito por quem sabe o que é começar do zero.",
      },
      { property: "og:title", content: "Sobre — Pólia" },
      { property: "og:description", content: "Um começo honesto para negócios reais." },
    ],
  }),
  component: SobrePage,
});

const valores = [
  {
    icon: Compass,
    color: "var(--terracota)",
    nome: "Clareza primeiro",
    desc: "Cada feature, cada palavra e cada etapa existe pra reduzir confusão, nunca pra aumentar.",
  },
  {
    icon: Heart,
    color: "var(--terracota)",
    nome: "Sem julgamento",
    desc: "Aqui não tem resposta errada. Só o próximo passo certo pra você, no seu negócio, na sua realidade.",
  },
  {
    icon: Star,
    color: "var(--dourado)",
    nome: "Entregáveis reais",
    desc: "A Pólia não entrega aprendizados. Entrega coisas concretas que ficam com você mesmo que um dia você cancele.",
  },
  {
    icon: Users,
    color: "var(--verde-musgo)",
    nome: "Construída com quem usa",
    desc: "Cada decisão de produto passa por mulheres empreendedoras reais. Você é parte da Pólia desde o primeiro dia.",
  },
];

const marcos = [
  { data: "Jan 2026", titulo: "A ideia vira problema real", desc: "Sil percebe que nenhuma ferramenta em PT-BR ocupa esse espaço." },
  { data: "Mar 2026", titulo: "Discovery e ICP", desc: "10 entrevistas com mulheres empreendedoras. A Aimer ganha nome e rosto." },
  { data: "Mai 2026", titulo: "Pólia nasce", desc: "Nome, identidade visual e as 11 etapas tomam forma." },
  { data: "Em breve", titulo: "Primeiro coorte", desc: "10 a 15 mulheres testam a Pólia antes de todo mundo." },
];

function SobrePage() {
  return (
    <div style={{ background: "var(--azul-noite)", minHeight: "100vh" }}>
      <Navbar />

      {/* SEÇÃO 1 — HERO */}
      <section
        style={{
          background: "var(--azul-noite)",
          minHeight: "70vh",
          display: "flex",
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <StarField density={50} speed={0.4} />
        <div
          style={{
            position: "absolute",
            top: "-10%",
            right: "-10%",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "rgba(201,107,62,0.08)",
            filter: "blur(100px)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{
            maxWidth: 800,
            margin: "0 auto",
            padding: "120px 24px 80px",
            textAlign: "center",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div
            className="font-sans"
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.40)",
              marginBottom: 20,
              fontWeight: 500,
            }}
          >
            Sobre a Pólia
          </div>
          <h1
            className="font-serif"
            style={{
              fontSize: "clamp(38px, 6vw, 62px)",
              color: "#fff",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            Um começo honesto para negócios reais.
          </h1>
          <div
            className="font-caveat"
            style={{
              fontSize: 22,
              color: "var(--terracota)",
              marginTop: 20,
            }}
          >
            Feita por quem sabe o que é começar do zero.
          </div>
        </motion.div>

        {/* Hills */}
        <svg
          viewBox="0 0 1440 200"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            bottom: -1,
            left: 0,
            width: "100%",
            height: 160,
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <ellipse cx="240" cy="220" rx="500" ry="80" fill="#181830" />
          <ellipse cx="900" cy="230" rx="600" ry="90" fill="#1B1B32" />
          <ellipse cx="1300" cy="225" rx="450" ry="75" fill="#1F1F36" />
        </svg>
      </section>

      {/* SEÇÃO 2 — A HISTÓRIA */}
      <section
        style={{
          background: "var(--creme)",
          padding: "100px 24px",
          clipPath: "polygon(0 4%, 100% 0, 100% 100%, 0% 100%)",
          marginTop: -60,
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {/* MOMENTO A */}
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
          >
            <motion.div
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              className="font-sans"
              style={{
                fontSize: 11,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "rgba(201,107,62,0.7)",
                marginBottom: 24,
                fontWeight: 500,
              }}
            >
              Quem fez
            </motion.div>

            <motion.div
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              className="sobre-fundadora-row"
              style={{
                display: "flex",
                gap: 48,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 200,
                  height: 200,
                  borderRadius: "50%",
                  border: "2px solid rgba(201,107,62,0.2)",
                  overflow: "hidden",
                }}
              >
                <UploadablePlaceholder
                  id="foto-fundadora"
                  label="FOTO DA FUNDADORA"
                  width={200}
                  height={200}
                  description="Foto da fundadora, 400x400px, JPG/PNG"
                />
              </div>

              <div style={{ flex: 1 }}>
                <h2
                  className="font-serif"
                  style={{
                    fontSize: 36,
                    color: "var(--azul-noite)",
                    lineHeight: 1.2,
                    margin: 0,
                  }}
                >
                  Sil fundou a Pólia porque sentiu na pele.
                </h2>
                <p
                  className="font-sans"
                  style={{
                    fontSize: 17,
                    color: "#5A4A3A",
                    lineHeight: 1.8,
                    marginTop: 16,
                  }}
                >
                  Coloca aqui sua história em 3-4 parágrafos. O que você vivia antes
                  de criar a Pólia. Qual era a dor que você sentia. O momento em que
                  decidiu construir isso. Por que você acredita que toda mulher
                  merece começar certo.
                </p>
                <p
                  className="font-caveat"
                  style={{
                    fontSize: 20,
                    color: "var(--terracota)",
                    marginTop: 20,
                  }}
                >
                  Ainda construindo. Junto com você.
                </p>
              </div>
            </motion.div>
          </motion.div>

          {/* Divisor */}
          <div
            style={{
              height: 1,
              background: "rgba(201,107,62,0.15)",
              margin: "72px 0",
            }}
          />
          <div style={{ height: 120 }} />

          {/* MOMENTO B */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={{ textAlign: "center" }}
          >
            <h3
              className="font-serif"
              style={{
                fontSize: 44,
                color: "var(--azul-noite)",
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              72% das empreendedoras brasileiras começam sem planejamento.
            </h3>
            <p
              className="font-caveat"
              style={{
                fontSize: 22,
                color: "var(--terracota)",
                marginTop: 12,
              }}
            >
              A Pólia existe pra mudar esse número.
            </p>
            <p
              className="font-sans"
              style={{
                fontSize: 17,
                color: "#5A4A3A",
                lineHeight: 1.7,
                maxWidth: 580,
                margin: "20px auto 0",
              }}
            >
              60% dos negócios fecham antes de 2 anos. Não por falta de talento.
              Por falta de estrutura, clareza e direção no começo certo.
            </p>
          </motion.div>
        </div>

        <style>{`
          @media (max-width: 720px) {
            .sobre-fundadora-row {
              flex-direction: column !important;
              align-items: center !important;
              text-align: center;
            }
          }
        `}</style>
      </section>

      {/* SEÇÃO 3 — VALORES */}
      <section style={{ background: "var(--cinza-claro)", padding: "100px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <h2
            className="font-serif"
            style={{
              fontSize: 40,
              color: "var(--azul-noite)",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            O que guia cada decisão da Pólia.
          </h2>
        </div>

        <div
          className="sobre-valores-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
          {valores.map((v, i) => {
            const Icon = v.icon;
            return (
              <motion.div
                key={v.nome}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  padding: 32,
                  background: "#fff",
                  borderRadius: 14,
                  border: "1px solid rgba(26,26,46,0.07)",
                }}
              >
                <Icon size={28} color={v.color} />
                <h3
                  className="font-serif"
                  style={{
                    fontSize: 22,
                    color: "var(--azul-noite)",
                    marginTop: 16,
                    marginBottom: 10,
                    lineHeight: 1.3,
                  }}
                >
                  {v.nome}
                </h3>
                <p
                  className="font-sans"
                  style={{
                    fontSize: 15,
                    color: "#5A4A3A",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {v.desc}
                </p>
              </motion.div>
            );
          })}
        </div>

        <style>{`
          @media (max-width: 880px) {
            .sobre-valores-grid { grid-template-columns: 1fr 1fr !important; }
          }
          @media (max-width: 600px) {
            .sobre-valores-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </section>

      {/* SEÇÃO 4 — TIMELINE */}
      <section style={{ background: "var(--creme)", padding: "100px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <h2
            className="font-serif"
            style={{
              fontSize: 40,
              color: "var(--azul-noite)",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Como a Pólia nasceu.
          </h2>
          <p
            className="font-caveat"
            style={{
              fontSize: 20,
              color: "var(--terracota)",
              marginTop: 12,
            }}
          >
            uma história em andamento
          </p>
        </div>

        <div
          className="sobre-timeline"
          style={{
            maxWidth: 640,
            margin: "0 auto",
            position: "relative",
          }}
        >
          <div
            className="sobre-timeline-line"
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              top: 0,
              bottom: 0,
              width: 2,
              background: "rgba(201,107,62,0.15)",
            }}
          />

          {marcos.map((m, i) => {
            const isRight = i % 2 === 0;
            return (
              <motion.div
                key={m.titulo}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="sobre-timeline-item"
                data-side={isRight ? "right" : "left"}
                style={{
                  position: "relative",
                  marginBottom: 48,
                  display: "flex",
                  justifyContent: isRight ? "flex-end" : "flex-start",
                }}
              >
                <div
                  className="sobre-timeline-dot"
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: 8,
                    transform: "translateX(-50%)",
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: "var(--terracota)",
                    boxShadow: "0 0 0 4px rgba(201,107,62,0.15)",
                    zIndex: 1,
                  }}
                />
                <div
                  className="sobre-timeline-content"
                  style={{
                    maxWidth: 260,
                    paddingLeft: isRight ? 32 : 0,
                    paddingRight: isRight ? 0 : 32,
                    textAlign: isRight ? "left" : "right",
                  }}
                >
                  <div
                    className="font-sans"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "rgba(201,107,62,0.7)",
                      fontWeight: 600,
                    }}
                  >
                    {m.data}
                  </div>
                  <div
                    className="font-serif"
                    style={{
                      fontSize: 20,
                      color: "var(--azul-noite)",
                      marginTop: 4,
                      lineHeight: 1.3,
                    }}
                  >
                    {m.titulo}
                  </div>
                  <div
                    className="font-sans"
                    style={{
                      fontSize: 14,
                      color: "#5A4A3A",
                      marginTop: 6,
                      lineHeight: 1.6,
                    }}
                  >
                    {m.desc}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <style>{`
          @media (max-width: 720px) {
            .sobre-timeline-line { left: 20px !important; transform: none !important; }
            .sobre-timeline-item { justify-content: flex-start !important; padding-left: 52px; }
            .sobre-timeline-dot { left: 20px !important; transform: translateX(-50%) !important; }
            .sobre-timeline-content {
              max-width: 100% !important;
              padding-left: 0 !important;
              padding-right: 0 !important;
              text-align: left !important;
            }
          }
        `}</style>
      </section>

      {/* SEÇÃO 5 — CTA */}
      <section
        style={{
          background: "var(--azul-noite)",
          padding: "100px 24px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <StarField density={40} speed={0.5} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: "relative", zIndex: 1, maxWidth: 600, margin: "0 auto" }}
        >
          <div
            className="font-caveat"
            style={{ fontSize: 24, color: "var(--terracota)" }}
          >
            pronta pra começar?
          </div>
          <h2
            className="font-serif"
            style={{
              fontSize: 48,
              color: "#fff",
              lineHeight: 1.1,
              marginTop: 12,
              marginBottom: 16,
            }}
          >
            Faça parte do primeiro coorte.
          </h2>
          <p
            className="font-sans"
            style={{
              fontSize: 17,
              color: "rgba(255,255,255,0.55)",
              marginTop: 16,
              maxWidth: 480,
              margin: "16px auto 0",
              lineHeight: 1.6,
            }}
          >
            Acesso gratuito durante o beta. Você ajuda a construir a Pólia e ainda
            constrói o seu negócio junto.
          </p>

          <div style={{ marginTop: 40 }}>
            <Link
              to="/lista-de-espera"
              className="polia-final-cta font-sans"
              style={{
                background: "var(--terracota)",
                color: "#fff",
                fontSize: 17,
                fontWeight: 600,
                padding: "18px 44px",
                borderRadius: 12,
                display: "inline-block",
                textDecoration: "none",
                position: "relative",
                overflow: "hidden",
                transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s",
              }}
            >
              <span style={{ position: "relative", zIndex: 1 }}>
                Entrar na lista de espera
              </span>
            </Link>
          </div>
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
          .polia-final-cta:hover::before { left: 100%; }
        `}</style>
      </section>
    </div>
  );
}
