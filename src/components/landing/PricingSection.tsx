import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PoliaButton } from "@/components/ui/PoliaButton";

const benefits = [
  "11 etapas completas com guia de IA",
  "Entregáveis gerados e salvos pra sempre",
  "4 ferramentas vivas: Marca, Vitrine, Vendas e Financeiro",
  "Sem limite de uso durante o beta",
  "Acesso prioritário ao plano definitivo",
];

export function PricingSection() {
  return (
    <section
      id="precos"
      style={{
        background: "var(--cinza-claro)",
        padding: "100px 24px",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ textAlign: "center", marginBottom: 56 }}
        >
          <p
            className="font-sans"
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "rgba(201,107,62,0.70)",
            }}
          >
            QUANTO CUSTA
          </p>
          <h2
            className="font-serif"
            style={{
              fontSize: 46,
              color: "var(--azul-noite)",
              marginTop: 12,
              lineHeight: 1.15,
            }}
          >
            Durante o beta, é gratuito.
          </h2>
          <p
            className="font-caveat"
            style={{
              fontSize: 22,
              color: "var(--terracota)",
              marginTop: 10,
            }}
          >
            sem cartão de crédito. sem surpresa.
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{
            maxWidth: 560,
            margin: "0 auto",
            background: "#fff",
            borderRadius: 20,
            border: "2px solid rgba(201,107,62,0.20)",
            boxShadow: "0 8px 40px rgba(26,26,46,0.08)",
            padding: "40px 48px",
          }}
        >
          {/* Topo */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <span
              className="font-sans"
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: "#fff",
                background: "var(--verde-musgo)",
                padding: "5px 12px",
                borderRadius: 999,
              }}
            >
              ACESSO BETA
            </span>
            <span
              className="font-sans"
              style={{
                fontSize: 12,
                color: "rgba(201,107,62,0.70)",
              }}
            >
              lançamento mai/2026
            </span>
          </div>

          {/* Preço */}
          <div style={{ marginTop: 24 }}>
            <p
              className="font-serif"
              style={{
                fontSize: 80,
                lineHeight: 1,
                color: "var(--azul-noite)",
              }}
            >
              Grátis
            </p>
            <p
              className="font-sans"
              style={{
                fontSize: 15,
                color: "#5A4A3A",
                marginTop: 4,
              }}
            >
              durante o período de lançamento
            </p>
          </div>

          {/* Divisória */}
          <div
            style={{
              height: 1,
              background: "rgba(26,26,46,0.08)",
              margin: "28px 0",
            }}
          />

          {/* Lista */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {benefits.map((b) => (
              <div
                key={b}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <CheckCircle
                  size={18}
                  style={{ color: "var(--verde-musgo)", flexShrink: 0 }}
                />
                <span
                  className="font-sans"
                  style={{
                    fontSize: 15,
                    color: "var(--azul-noite)",
                  }}
                >
                  {b}
                </span>
              </div>
            ))}
          </div>

          {/* Rodapé do card */}
          <div style={{ marginTop: 36 }}>
            <PoliaButton href="/lista-de-espera" fullWidth size="large">
              Entrar na lista de espera
            </PoliaButton>
            <p
              className="font-sans"
              style={{
                fontSize: 13,
                color: "#8A7A6A",
                textAlign: "center",
                marginTop: 16,
              }}
            >
              Pós-beta: a partir de R$29/mês. Quem entrar agora garante o menor
              preço.
            </p>
            <Link
              to="/precos"
              className="font-sans"
              style={{
                display: "block",
                fontSize: 12,
                color: "rgba(201,107,62,0.70)",
                textAlign: "center",
                marginTop: 8,
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--terracota)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "rgba(201,107,62,0.70)")
              }
            >
              Ver detalhes do plano pós-beta
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
