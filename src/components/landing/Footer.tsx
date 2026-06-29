import { Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import { UploadablePlaceholder } from "@/components/landing/UploadablePlaceholder";

type FooterLink = { label: string; to?: string; href?: string };

const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: "PRODUTO",
    links: [
      { label: "Como funciona", href: "/#jornada" },
      { label: "Preços", to: "/precos" },
      { label: "Manifesto", to: "/manifesto" },
      { label: "Sobre", to: "/sobre" },
    ],
  },
  {
    title: "CONTEÚDO",
    links: [
      { label: "Manifesto", to: "/manifesto" },
      { label: "Blog", href: "#" },
      { label: "Sobre", to: "/sobre" },
    ],
  },
  {
    title: "PARTICIPE",
    links: [
      { label: "Lista de espera", href: "/#cta" },
      { label: "Login", to: "/auth/login" },
    ],
  },
  {
    title: "LEGAL",
    links: [
      { label: "Termos de uso", to: "/termos" },
      { label: "Privacidade", to: "/privacidade" },
      { label: "Contato", to: "/contato" },
      { label: "Central de ajuda", to: "/ajuda" },
    ],
  },
];

const labelStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.18em",
  color: "rgba(255,255,255,0.30)",
  textTransform: "uppercase",
  marginBottom: 4,
};

const linkStyle: CSSProperties = {
  fontSize: 13,
  color: "rgba(255,255,255,0.50)",
  transition: "color 0.2s ease",
  textDecoration: "none",
  cursor: "pointer",
};

function FooterLinkItem({ link }: { link: FooterLink }) {
  const onEnter = (e: React.MouseEvent<HTMLElement>) =>
    (e.currentTarget.style.color = "rgba(255,255,255,0.85)");
  const onLeave = (e: React.MouseEvent<HTMLElement>) =>
    (e.currentTarget.style.color = "rgba(255,255,255,0.50)");

  if (link.to) {
    return (
      <Link
        to={link.to}
        className="font-sans"
        style={linkStyle}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {link.label}
      </Link>
    );
  }
  return (
    <a
      href={link.href ?? "#"}
      className="font-sans"
      style={linkStyle}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {link.label}
    </a>
  );
}

function Column({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <div className="font-sans" style={labelStyle}>
        {title}
      </div>
      {links.map((l) => (
        <FooterLinkItem key={l.label + (l.to ?? l.href ?? "")} link={l} />
      ))}
    </div>
  );
}

export function Footer(): ReactNode {
  return (
    <footer
      style={{
        background: "var(--azul-noite)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        padding: "48px 24px 40px",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          className="flex flex-wrap"
          style={{
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 40,
            paddingBottom: 40,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ maxWidth: 240 }}>
            <UploadablePlaceholder
              id="logo-polia"
              label="LOGO"
              width={110}
              height={28}
              description="SVG 330x84px"
              fit="contain"
            />
            <p
              className="font-sans"
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.35)",
                marginTop: 12,
                lineHeight: 1.6,
              }}
            >
              Para a mulher que constrói algo com as próprias mãos e quer que o mundo saiba.
            </p>
            <p
              className="caveat-decorativo"
              style={{
                fontSize: 15,
                color: "rgba(255,255,255,0.25)",
                marginTop: 16,
              }}
            >
              voar é um ato de coragem.
            </p>
          </div>

          {columns.map((c) => (
            <Column key={c.title} title={c.title} links={c.links} />
          ))}
        </div>

        <div
          className="flex flex-wrap"
          style={{
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 28,
            gap: 16,
          }}
        >
          <span className="font-sans" style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
            2026 Pólia. Feito com carinho para mulheres que constroem.
          </span>
          <span className="font-sans" style={{ fontSize: 12, color: "rgba(255,255,255,0.20)" }}>
            &#8203;
          </span>
        </div>
        <p
          className="font-sans"
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.20)",
            marginTop: 16,
          }}
        >
          Em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).
        </p>
      </div>
    </footer>
  );
}
