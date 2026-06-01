import { Link } from "@tanstack/react-router";
import { StarField } from "@/components/ui/StarField";
import { PlaceholderImage } from "@/components/PlaceholderImage";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export type ErrorCode =
  | "400"
  | "401"
  | "403"
  | "404"
  | "408"
  | "500"
  | "502"
  | "503";

type RaposaState =
  | "feliz"
  | "animada"
  | "curiosa"
  | "amparando"
  | "dormindo"
  | "confusa"
  | "esperando";

interface CopyMap {
  title: string;
  subtitle: string;
  raposa: RaposaState;
  pageTitle: string;
}

const COPY: Record<ErrorCode, CopyMap> = {
  "400": {
    title: "Algo veio torto.",
    subtitle: "Volta um passinho e tenta de novo.",
    raposa: "curiosa",
    pageTitle: "Requisição inválida",
  },
  "401": {
    title: "Te perdi por um segundo.",
    subtitle: "Faz login de novo, eu te espero aqui.",
    raposa: "dormindo",
    pageTitle: "Sessão expirou",
  },
  "403": {
    title: "Esse cantinho ainda não é seu.",
    subtitle: "Volta quando estiver na fase certa.",
    raposa: "amparando",
    pageTitle: "Acesso restrito",
  },
  "404": {
    title: "Esse marco ainda não existe no mapa.",
    subtitle: "Mas a sua jornada continua por aqui.",
    raposa: "curiosa",
    pageTitle: "Página não encontrada",
  },
  "408": {
    title: "A conexão respirou fundo demais.",
    subtitle: "Tenta de novo daqui a pouco.",
    raposa: "esperando",
    pageTitle: "Tempo esgotado",
  },
  "500": {
    title: "O mapa perdeu o norte um segundo.",
    subtitle: "Não é você, sou eu. Já volto a te guiar.",
    raposa: "confusa",
    pageTitle: "Erro interno",
  },
  "502": {
    title: "O mapa perdeu o norte um segundo.",
    subtitle: "Não é você, sou eu. Já volto a te guiar.",
    raposa: "confusa",
    pageTitle: "Servidor instável",
  },
  "503": {
    title: "O mapa perdeu o norte um segundo.",
    subtitle: "Não é você, sou eu. Já volto a te guiar.",
    raposa: "confusa",
    pageTitle: "Servidor indisponível",
  },
};

interface ErrorPageProps {
  code: ErrorCode;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCta?: () => void;
}

export function ErrorPage({
  code,
  title,
  subtitle,
  ctaLabel = "Voltar pro início",
  ctaHref = "/painel",
  onCta,
}: ErrorPageProps) {
  const copy = COPY[code];
  useDocumentTitle(copy.pageTitle);

  return (
    <div
      style={{
        background: "var(--azul-noite, #1A1A2E)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
        padding: 24,
      }}
    >
      <StarField density={40} speed={0.4} />
      {/* hill base */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 140,
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(10,10,30,0.95) 30%, transparent 75%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 520,
          width: "100%",
        }}
      >
        <div
          style={{
            fontFamily: "Caveat, cursive",
            fontSize: 20,
            color: "#C8A96E",
            marginBottom: 16,
          }}
        >
          ops.
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <PlaceholderImage
            slot={`mascote-raposa-${copy.raposa}`}
            width={120}
            height={140}
            description={`Raposa · estado ${copy.raposa}`}
          />
        </div>

        <div style={{ position: "relative", paddingTop: 24 }}>
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              fontFamily: "DM Serif Display, serif",
              fontSize: 96,
              lineHeight: 1,
              color: "rgba(255,255,255,0.07)",
              pointerEvents: "none",
              userSelect: "none",
              letterSpacing: "-0.04em",
            }}
          >
            {code}
          </div>
          <h1
            style={{
              position: "relative",
              fontFamily: "DM Serif Display, serif",
              fontSize: 36,
              lineHeight: 1.15,
              color: "#FDF8F5",
              margin: 0,
              marginTop: 24,
            }}
          >
            {title ?? copy.title}
          </h1>
        </div>
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 18,
            color: "rgba(253,248,245,0.65)",
            marginTop: 16,
            lineHeight: 1.5,
          }}
        >
          {subtitle ?? copy.subtitle}
        </p>
        <p
          style={{
            fontFamily: "Caveat, cursive",
            fontSize: 16,
            color: "#C8A96E",
            opacity: 0.85,
            marginTop: 8,
          }}
        >
          Deixa a Pólia te guiar de volta.
        </p>

        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          {onCta ? (
            <button
              onClick={onCta}
              style={{
                background: "#C96B3E",
                color: "#FDF8F5",
                fontFamily: "Inter, sans-serif",
                fontSize: 16,
                fontWeight: 600,
                padding: "16px 40px",
                borderRadius: 12,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(201,107,62,0.25)",
                minHeight: 44,
              }}
            >
              {ctaLabel}
            </button>
          ) : (
            <Link
              to={ctaHref}
              style={{
                background: "#C96B3E",
                color: "#FDF8F5",
                fontFamily: "Inter, sans-serif",
                fontSize: 16,
                fontWeight: 600,
                padding: "16px 40px",
                borderRadius: 12,
                display: "inline-block",
                textDecoration: "none",
                boxShadow: "0 8px 24px rgba(201,107,62,0.25)",
                minHeight: 44,
              }}
            >
              {ctaLabel}
            </Link>
          )}
          {ctaHref !== "/jornada" && (
            <Link
              to="/jornada"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 14,
                color: "rgba(253,248,245,0.65)",
                textDecoration: "underline",
                textUnderlineOffset: 4,
                minHeight: 44,
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              voltar pra jornada
            </Link>
          )}
        </div>

      </div>
    </div>
  );
}
