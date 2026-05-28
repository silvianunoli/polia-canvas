import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-[100]"
      style={{
        transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        background: scrolled ? "rgba(26,26,46,0.88)" : "transparent",
        backdropFilter: scrolled ? "blur(16px) saturate(180%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(16px) saturate(180%)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.07)" : "1px solid transparent",
      }}
    >
      <div
        className="mx-auto flex items-center justify-between"
        style={{ maxWidth: 1200, padding: "0 24px", height: 64 }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: 120,
            height: 32,
            border: "1px dashed var(--terracota)",
          }}
        >
          <span
            className="font-sans"
            style={{ fontSize: 10, letterSpacing: "0.2em", color: "rgba(201,107,62,0.6)" }}
          >
            LOGO
          </span>
        </div>

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
          <Link
            to="/lista-de-espera"
            className="font-sans font-semibold transition-all"
            style={{
              background: "var(--terracota)",
              color: "#fff",
              fontSize: 14,
              padding: "10px 20px",
              borderRadius: 8,
              display: "inline-block",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = "brightness(1.08)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "none";
              e.currentTarget.style.transform = "none";
            }}
          >
            Entrar na lista
          </Link>
        </div>
      </div>
    </nav>
  );
}
