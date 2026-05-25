import { useMemo } from "react";

type Particle = { top: string; left: string; size: number; opacity: number; color: string };
type Sparkle = { top: string; left: string; size: number; opacity: number; color: string };

const STAR_COLORS = ["#FDF8F5", "#D8D2CC", "#E89770"];
const SPARKLE_COLORS = ["#FDF8F5", "#E89770"];

function rand(seed: number) {
  // deterministic pseudo-random so SSR/CSR match
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function CosmicBackground() {
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      top: `${rand(i + 1) * 100}%`,
      left: `${rand(i + 101) * 100}%`,
      size: 2 + Math.floor(rand(i + 201) * 4),
      opacity: 0.4 + rand(i + 301) * 0.4,
      color: STAR_COLORS[Math.floor(rand(i + 401) * STAR_COLORS.length)],
    }));
  }, []);

  const sparkles = useMemo<Sparkle[]>(() => {
    return Array.from({ length: 6 }, (_, i) => ({
      top: `${10 + rand(i + 501) * 80}%`,
      left: `${5 + rand(i + 601) * 90}%`,
      size: 7 + Math.floor(rand(i + 701) * 8),
      opacity: 0.5 + rand(i + 801) * 0.4,
      color: SPARKLE_COLORS[Math.floor(rand(i + 901) * SPARKLE_COLORS.length)],
    }));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden bg-[#1A1A2E]" aria-hidden="true">
      {/* Glow ellipses */}
      <div
        className="absolute -top-40 -left-40 h-[700px] w-[700px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(201,107,62,0.18) 0%, rgba(201,107,62,0) 70%)",
        }}
      />
      <div
        className="absolute -top-20 left-1/2 h-[900px] w-[900px] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(200,169,110,0.12) 0%, rgba(200,169,110,0) 70%)",
        }}
      />
      <div
        className="absolute -bottom-32 -right-40 h-[600px] w-[600px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(107,80,204,0.15) 0%, rgba(107,80,204,0) 70%)",
        }}
      />

      {/* Particles */}
      {particles.map((p, i) => (
        <div
          key={`p-${i}`}
          className="absolute rounded-full"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
        />
      ))}

      {/* Sparkles (4-point stars via SVG) */}
      {sparkles.map((s, i) => (
        <svg
          key={`s-${i}`}
          className="absolute"
          style={{ top: s.top, left: s.left, opacity: s.opacity }}
          width={s.size}
          height={s.size}
          viewBox="0 0 24 24"
          fill={s.color}
        >
          <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" />
        </svg>
      ))}

      {/* Hills - horizon at bottom */}
      <div
        className="absolute -bottom-[350px] left-1/2 h-[700px] w-[1800px] -translate-x-1/2 rounded-[50%]"
        style={{ backgroundColor: "#0F0F1F" }}
      />
      <div
        className="absolute -bottom-[250px] left-1/4 h-[500px] w-[1200px] -translate-x-1/2 rounded-[50%]"
        style={{ backgroundColor: "#15152A" }}
      />
    </div>
  );
}
