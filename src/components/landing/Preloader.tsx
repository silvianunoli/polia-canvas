import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { StarField } from "@/components/ui/StarField";

export function Preloader() {
  const [shouldRender, setShouldRender] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const visited = sessionStorage.getItem("polia-visited");
    if (visited) return;
    sessionStorage.setItem("polia-visited", "true");
    setShouldRender(true);

    const t1 = window.setTimeout(() => setFadeOut(true), 1800);
    const t2 = window.setTimeout(() => setShouldRender(false), 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-[400ms]"
      style={{
        background: "var(--azul-noite)",
        opacity: fadeOut ? 0 : 1,
        pointerEvents: fadeOut ? "none" : "auto",
      }}
    >
      <StarField density={40} />
      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-center"
          style={{
            width: 140,
            height: 36,
            border: "1px dashed var(--terracota)",
            background: "transparent",
          }}
        >
          <span
            className="font-sans"
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "rgba(201,107,62,0.6)",
            }}
          >
            LOGO
          </span>
        </motion.div>
        <div className="mt-6 flex gap-2">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "rgba(201,107,62,0.4)",
                animation: "polia-pulse-dot 1.2s ease-in-out infinite",
                animationDelay: `${delay}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
