import { Link } from "@tanstack/react-router";

const columns: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: "Produto",
    links: [
      { label: "Como funciona", to: "/como-funciona" },
      { label: "Preços", to: "/precos" },
      { label: "Sobre", to: "/sobre" },
    ],
  },
  {
    title: "Conteúdo",
    links: [
      { label: "Manifesto", to: "/manifesto" },
      { label: "Blog", to: "/blog" },
      { label: "Central de ajuda", to: "/ajuda" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Termos", to: "/termos" },
      { label: "Privacidade", to: "/privacidade" },
      { label: "Contato", to: "/contato" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer
      style={{
        marginTop: 80,
        paddingTop: 48,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          display: "grid",
          gridTemplateColumns: "1.2fr repeat(3, 1fr)",
          gap: 40,
        }}
        className="polia-footer-grid"
      >
        <div>
          <div
            style={{
              width: 100,
              height: 26,
              border: "1px dashed rgba(255,255,255,0.2)",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              color: "rgba(255,255,255,0.3)",
              marginBottom: 10,
            }}
          >
            LOGO
          </div>
          <div
            className="caveat-decorativo"
            style={{ fontSize: 14, color: "rgba(255,255,255,0.35)" }}
          >
            2026 Pólia. Feito com carinho.
          </div>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <div
              className="font-sans"
              style={{
                fontSize: 11,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.55)",
                marginBottom: 14,
                fontWeight: 600,
              }}
            >
              {col.title}
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="polia-footer-link font-sans"
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.40)",
                      textDecoration: "none",
                      transition: "color 0.2s ease",
                    }}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div
        style={{
          maxWidth: 1200,
          margin: "40px auto 0",
          padding: "24px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div
          className="font-sans"
          style={{ fontSize: 12, color: "rgba(255,255,255,0.30)" }}
        >
          © 2026 Pólia
        </div>
        <div
          className="caveat-decorativo"
          style={{ fontSize: 16, color: "rgba(255,255,255,0.35)" }}
        >
          voar é um ato de coragem.
        </div>
      </div>

      <style>{`
        .polia-footer-link:hover { color: rgba(255,255,255,0.75) !important; }
        @media (max-width: 768px) {
          .polia-footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .polia-footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  );
}
