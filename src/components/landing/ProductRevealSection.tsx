import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { StarField } from "@/components/ui/StarField";
import { UploadablePlaceholder } from "./UploadablePlaceholder";

const superlabel = {
  fontFamily: "Inter, sans-serif",
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: "0.18em",
  marginBottom: 16,
};

export function ProductRevealSection() {
  const isMobile = useIsMobile();

  return (
    <section style={{ background: "var(--creme)" }}>
      {/* === MOMENTO 1: O Painel === */}
      <div
        style={{
          background: "var(--creme)",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          padding: isMobile ? "80px 24px" : "0",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: isMobile ? 0 : "0 60px",
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1.2fr",
            gap: isMobile ? 48 : 80,
            alignItems: "center",
            width: "100%",
          }}
        >
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-15%" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div style={{ ...superlabel, color: "rgba(201,107,62,0.7)" }}>O SEU PAINEL</div>
            <h2
              className="font-serif"
              style={{
                fontSize: isMobile ? 34 : 44,
                lineHeight: 1.15,
                color: "var(--azul-noite)",
                maxWidth: 360,
                margin: 0,
              }}
            >
              Tudo no mesmo lugar. Sempre atualizado.
            </h2>
            <p
              className="font-sans"
              style={{
                fontSize: 17,
                lineHeight: 1.7,
                color: "#5A4A3A",
                marginTop: 20,
                maxWidth: 340,
              }}
            >
              Seu painel acompanha cada etapa que você conclui e mostra exatamente o que vem a seguir.
            </p>
            <p
              className="caveat-decorativo"
              style={{ fontSize: 20, color: "var(--terracota)", marginTop: 24 }}
            >
              Você nunca vai ficar perdida de novo.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-15%" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={{ perspective: 1200, position: "relative" }}
          >
            <div
              style={{
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 24px 64px rgba(26,26,46,0.12)",
              }}
            >
              <UploadablePlaceholder
                id="product-painel"
                label="SCREENSHOT DO PAINEL (D1)"
                width={isMobile ? "100%" : 640}
                height={isMobile ? 280 : 420}
                description="Dashboard principal, 1280x840px, PNG"
              />
            </div>
            <div
              style={{
                position: "absolute",
                bottom: -24,
                left: "5%",
                right: "5%",
                height: 48,
                background:
                  "radial-gradient(ellipse, rgba(0,0,0,0.15) 0%, transparent 70%)",
                filter: "blur(16px)",
                pointerEvents: "none",
              }}
            />
          </motion.div>
        </div>
      </div>

      {/* Transição creme → noite */}
      <div
        style={{
          height: 2,
          background: "linear-gradient(90deg, var(--creme), var(--azul-noite))",
        }}
      />

      {/* === MOMENTO 2: Uma Etapa por Dentro === */}
      <div
        style={{
          background: "var(--azul-noite)",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          padding: isMobile ? "80px 24px" : "0",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <StarField density={40} speed={0.3} />
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: isMobile ? 0 : "0 60px",
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr",
            gap: isMobile ? 48 : 80,
            alignItems: "center",
            position: "relative",
            zIndex: 1,
            width: "100%",
          }}
        >
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-15%" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={{
              borderRadius: 16,
              overflow: "hidden",
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.06), 0 32px 80px rgba(0,0,0,0.5)",
              order: isMobile ? 2 : 1,
            }}
          >
            <UploadablePlaceholder
              id="product-etapa"
              label="SCREENSHOT DE UMA ETAPA"
              width={isMobile ? "100%" : 640}
              height={isMobile ? 300 : 440}
              description="Tela de uma etapa (ex: E2 Identidade), 1280x880px, PNG"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-15%" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={{ order: isMobile ? 1 : 2 }}
          >
            <div style={{ ...superlabel, color: "rgba(255,255,255,0.40)" }}>
              DENTRO DAS ETAPAS
            </div>
            <h2
              className="font-serif"
              style={{
                fontSize: isMobile ? 34 : 44,
                lineHeight: 1.15,
                color: "#fff",
                maxWidth: 360,
                margin: 0,
              }}
            >
              Cada etapa entrega algo real.
            </h2>
            <p
              className="font-sans"
              style={{
                fontSize: 17,
                lineHeight: 1.7,
                color: "rgba(255,255,255,0.65)",
                marginTop: 20,
                maxWidth: 340,
              }}
            >
              Você não termina com mais perguntas. Termina com um entregável na mão, pronto pra usar no seu negócio.
            </p>
            <p
              className="caveat-decorativo"
              style={{ fontSize: 20, color: "var(--terracota)", marginTop: 24 }}
            >
              Algo concreto. Algo seu.
            </p>
            <ul
              style={{
                marginTop: 32,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                listStyle: "none",
                padding: 0,
              }}
            >
              {[
                "Formulários que fazem as perguntas certas",
                "IA que sugere com base no seu contexto",
                "Entregável gerado automaticamente ao final",
              ].map((t) => (
                <li
                  key={t}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <CheckCircle size={18} color="var(--verde-musgo)" />
                  <span
                    className="font-sans"
                    style={{ fontSize: 15, color: "rgba(255,255,255,0.80)" }}
                  >
                    {t}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>

      {/* === MOMENTO 3: O Entregável === */}
      <div
        style={{
          background: "var(--creme-escuro)",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          padding: isMobile ? "80px 24px" : "60px 0",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: isMobile ? 0 : "0 60px",
            textAlign: "center",
            width: "100%",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              style={{
                ...superlabel,
                color: "rgba(201,107,62,0.7)",
                marginBottom: 20,
              }}
            >
              O QUE VOCÊ LEVA
            </div>
            <h2
              className="font-serif"
              style={{
                fontSize: isMobile ? 40 : 52,
                lineHeight: 1.1,
                color: "var(--azul-noite)",
                margin: 0,
              }}
            >
              É seu. Pra sempre.
            </h2>
            <p
              className="font-sans"
              style={{
                fontSize: 18,
                lineHeight: 1.7,
                color: "#5A4A3A",
                maxWidth: 560,
                margin: "20px auto 0",
              }}
            >
              Cada entregável que você gera fica salvo na sua biblioteca pessoal. Você edita, atualiza e usa quando quiser.
            </p>
            <p
              className="caveat-decorativo"
              style={{
                fontSize: 24,
                color: "var(--terracota)",
                marginTop: 16,
              }}
            >
              Sua biblioteca cresce com o seu negócio.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            style={{
              marginTop: 56,
              maxWidth: 800,
              marginLeft: "auto",
              marginRight: "auto",
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 40px 100px rgba(26,26,46,0.15)",
              transition: "transform 0.4s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1.01)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            }}
          >
            <UploadablePlaceholder
              id="product-entregavel"
              label="SCREENSHOT DE UM ENTREGÁVEL"
              width={isMobile ? "100%" : 800}
              height={isMobile ? 320 : 500}
              description="Ex: Brand Board ou Mini-pitch gerado, 1600x1000px, PNG"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
