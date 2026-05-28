import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  phase: number;
  color: string;
}

interface StarFieldProps {
  density?: number;
  speed?: number;
  className?: string;
}

export function StarField({ density = 60, speed = 1, className }: StarFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stars: Star[] = [];
    let raf = 0;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: density }, () => ({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        size: 1 + Math.random() * 2,
        opacity: 0.2 + Math.random() * 0.7,
        speed: (0.2 + Math.random() * 0.8) * speed,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() < 0.3 ? "#C8A96E" : "#FFFFFF",
      }));
    };

    const onMouse = (e: MouseEvent) => {
      const dx = (e.clientX - window.innerWidth / 2) * 0.012;
      const dy = (e.clientY - window.innerHeight / 2) * 0.008;
      wrap.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    };

    const draw = (t: number) => {
      const rect = wrap.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      for (const s of stars) {
        const driftX = Math.sin(t * 0.0003 * s.speed + s.phase) * 8;
        const driftY = Math.cos(t * 0.00025 * s.speed + s.phase) * 6;
        const tw = 0.7 + 0.3 * Math.sin(t * 0.001 * s.speed + s.phase);
        ctx.globalAlpha = s.opacity * tw;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x + driftX, s.y + driftY, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouse);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, [density, speed]);

  return (
    <div
      ref={wrapRef}
      className={`pointer-events-none absolute inset-0 z-0 transition-transform duration-300 ease-out ${className ?? ""}`}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
