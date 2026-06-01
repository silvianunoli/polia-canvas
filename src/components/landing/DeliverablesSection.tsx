import { useState } from "react";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { UploadablePlaceholder } from "./UploadablePlaceholder";

interface Card {
  id: string;
  nome: string;
  subtitulo: string;
  gradient: string;
  iconColor: string;
  descricaoUpload: string;
}

const cards: Card[] = [
  {
    id: "deliverable-marca",
    nome: "Sua marca viva",
    subtitulo: "Identidade, voz e visual sempre atualizados",
    gradient: "linear-gradient(135deg, #FDF0E8 0%, #F5DDD0 100%)",
    iconColor: "#C96B3E",
    descricaoUpload: "Brand Board completo, 800x560px, PNG",
  },
  {
    id: "deliverable-vitrine",
    nome: "Sua vitrine",
    subtitulo: "Produto, presença e como te encontram",
    gradient: "linear-gradient(135deg, #E8F4FD 0%, #D0E8F5 100%)",
    iconColor: "#1A7FAD",
    descricaoUpload: "Tela de vitrine/presença digital, 800x560px, PNG",
  },
  {
    id: "deliverable-vendas",
    nome: "Suas vendas",
    subtitulo: "Do primeiro contato ao fechamento",
    gradient: "linear-gradient(135deg, #E8F5EE 0%, #D0F0E0 100%)",
    iconColor: "#1A8F5C",
    descricaoUpload: "Tela do painel de vendas, 800x560px, PNG",
  },
  {
    id: "deliverable-financeiro",
    nome: "Financeiro",
    subtitulo: "Quanto entra, quanto sobra, a meta do mês",
    gradient: "linear-gradient(135deg, #F0EBF8 0%, #E2D5F0 100%)",
    iconColor: "#6B50CC",
    descricaoUpload: "Dashboard financeiro, 800x560px, PNG",
  },
];

function DiamondIcon({ color }: { color: string }) {
  return (
    <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
      <path
        d="M16 2L30 16L16 30L2 16L16 2Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path
        d="M16 2L23 16L16 30L9 16L16 2Z"
        stroke={color}
        strokeWidth={1}
        strokeLinejoin="round"
        opacity={0.6}
      />
    </svg>
  );
}

function DeliverableCard({ card, isMobile }: { card: Card; isMobile: boolean }) {
  const [flipped, setFlipped] = useState(false);

  if (isMobile) {
    return (
      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid rgba(26,26,46,0.08)",
          background: card.gradient,
        }}
      >
        <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 12 }}>
          <DiamondIcon color={card.iconColor} />
          <div className="font-serif" style={{ fontSize: 26, color: "var(--azul-noite)", lineHeight: 1.1 }}>
            {card.nome}
          </div>
          <div className="font-sans" style={{ fontSize: 14, color: "rgba(26,26,46,0.6)" }}>
            {card.subtitulo}
          </div>
        </div>
        <div style={{ padding: "0 16px 16px" }}>
          <UploadablePlaceholder
            id={card.id}
            label={card.nome.toUpperCase()}
            width="100%"
            height={220}
            description={card.descricaoUpload}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        height: 280,
        perspective: 1000,
        cursor: "pointer",
      }}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            background: card.gradient,
            borderRadius: 16,
            border: "1px solid rgba(26,26,46,0.08)",
            padding: 40,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <DiamondIcon color={card.iconColor} />
          <div>
            <div
              className="font-serif"
              style={{ fontSize: 28, color: "var(--azul-noite)", lineHeight: 1.1, marginBottom: 8 }}
            >
              {card.nome}
            </div>
            <div className="font-sans" style={{ fontSize: 14, color: "rgba(26,26,46,0.6)" }}>
              {card.subtitulo}
            </div>
          </div>
        </div>

        {/* Back */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid rgba(26,26,46,0.08)",
          }}
        >
          <UploadablePlaceholder
            id={card.id}
            label={card.nome.toUpperCase()}
            width="100%"
            height="100%"
            description={card.descricaoUpload}
          />
        </div>
      </div>
    </div>
  );
}

export function DeliverablesSection() {
  const isMobile = useIsMobile();

  return (
    <section
      style={{
        background: "#fff",
        padding: "120px 24px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ textAlign: "center", marginBottom: 72 }}
        >
          <div
            className="font-sans"
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "rgba(201,107,62,0.7)",
            }}
          >
            AS FERRAMENTAS VIVAS
          </div>
          <h2
            className="font-serif"
            style={{
              fontSize: isMobile ? 36 : 48,
              lineHeight: 1.1,
              color: "var(--azul-noite)",
              marginTop: 12,
            }}
          >
            O que você constrói anda com você.
          </h2>
          <p
            className="font-sans"
            style={{
              fontSize: 17,
              lineHeight: 1.7,
              color: "#5A4A3A",
              maxWidth: 520,
              margin: "16px auto 0",
            }}
          >
            Cada fase da jornada desbloqueia uma ferramenta viva que você vai usar todo dia no seu negócio.
          </p>
        </motion.div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
            gap: 24,
          }}
        >
          {cards.map((c) => (
            <DeliverableCard key={c.id} card={c} isMobile={isMobile} />
          ))}
        </div>
      </div>
    </section>
  );
}
