import { useMemo } from "react";

interface Particle {
  top: string;
  left: string;
  size: number;
  opacity: number;
}

export function CosmicSky({ density = 18 }: { density?: number }) {
  const particles = useMemo<Particle[]>(() => {
    const seed = density * 31;
    const arr: Particle[] = [];
    for (let i = 0; i < density; i++) {
      const x = (Math.sin(seed + i * 12.9898) * 43758.5453) % 1;
      const y = (Math.sin(seed + i * 78.233) * 43758.5453) % 1;
      const s = (Math.sin(seed + i * 4.32) * 43758.5453) % 1;
      const o = (Math.sin(seed + i * 9.11) * 43758.5453) % 1;
      arr.push({
        top: `${Math.abs(y) * 100}%`,
        left: `${Math.abs(x) * 100}%`,
        size: 2 + Math.abs(s) * 3,
        opacity: 0.3 + Math.abs(o) * 0.6,
      });
    }
    return arr;
  }, [density]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-polia-creme"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
          }}
        />
      ))}
      {/* Sparkles 4-pontas */}
      {[
        { top: "12%", left: "18%" },
        { top: "70%", left: "82%" },
        { top: "30%", left: "88%" },
      ].map((s, i) => (
        <span
          key={`spk-${i}`}
          className="absolute block bg-polia-dourado opacity-40"
          style={{
            top: s.top,
            left: s.left,
            width: 8,
            height: 8,
            transform: "rotate(45deg)",
          }}
        />
      ))}
    </div>
  );
}
