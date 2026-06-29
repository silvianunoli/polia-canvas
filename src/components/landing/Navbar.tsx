import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { PoliaButton } from "@/components/ui/PoliaButton";
import { UploadablePlaceholder } from "@/components/landing/UploadablePlaceholder";

interface NavbarProps {
  transparentOnTop?: boolean;
}

export function Navbar({ transparentOnTop = true }: NavbarProps) {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(!transparentOnTop);

  useEffect(() => {
    if (!transparentOnTop) {
      setScrolled(true);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparentOnTop]);

  const pathname = location.pathname;
  if (pathname === "/auth/login" || pathname === "/auth/cadastro") {
    return null;
  }

  const isSolid = scrolled || !transparentOnTop;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-[100]"
      style={{
        transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        background: isSolid
          ? transparentOnTop
            ? "rgba(26,26,46,0.88)"
            : "rgba(26,26,46,0.95)"
          : "transparent",
        backdropFilter: isSolid ? "blur(16px) saturate(180%)" : "none",
        WebkitBackdropFilter: isSolid ? "blur(16px) saturate(180%)" : "none",
        borderBottom: isSolid ? "1px solid rgba(255,255,255,0.07)" : "1px solid transparent",
      }}
    >
      <div
        className="mx-auto flex items-center justify-between"
        style={{ maxWidth: 1200, padding: "0 24px", height: 64 }}
      >
        <Link to="/" style={{ display: "inline-block", lineHeight: 0 }} aria-label="Pólia — início">
          <UploadablePlaceholder
            id="logo-polia"
            label="LOGO"
            width={120}
            height={32}
            description="SVG 360x96px"
            fit="contain"
          />
        </Link>

        <div className="flex items-center" style={{ gap: 16 }}>
          <Link
            to="/auth/login"
            className="font-sans hidden sm:inline-block"
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.7)",
              transition: "color 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,1)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          >
            Login
          </Link>
          <PoliaButton href="/lista-de-espera" variant="primary" size="default">
            Entrar na lista
          </PoliaButton>
        </div>
      </div>
    </nav>
  );
}
