import { useEffect, useRef, useState } from "react";
import { MODULO_ICONE } from "./modulosVisual";

export interface NoMapa {
  n: number;
  nome: string;
  concluido: boolean;
  snippet: string;
  ferramentaNome: string;
  ferramentaRota: string;
}

interface Conector {
  n: number;
  d: string;
}

export function MapaMental({
  nodes,
  businessName,
  concluidos,
  total,
  onAbrirConcluido,
  onAbrirModulo,
}: {
  nodes: NoMapa[];
  businessName: string;
  concluidos: number;
  total: number;
  onAbrirConcluido: (n: number) => void;
  onAbrirModulo: (n: number) => void;
}) {
  const esquerda = nodes.slice(0, 3);
  const direita = nodes.slice(3, 6);

  const containerRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<number, HTMLElement | null>>({});
  const [conectores, setConectores] = useState<Conector[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const compute = () => {
      const c = containerRef.current;
      const ce = centerRef.current;
      if (!c || !ce) return;
      const cb = c.getBoundingClientRect();
      setSize({ w: cb.width, h: cb.height });
      const center = ce.getBoundingClientRect();
      const cx = center.left - cb.left + center.width / 2;
      const cy = center.top - cb.top + center.height / 2;
      const next: Conector[] = [];
      for (const node of nodes) {
        const el = nodeRefs.current[node.n];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const isLeft = node.n <= 3;
        const nx = (isLeft ? r.right : r.left) - cb.left;
        const ny = r.top - cb.top + r.height / 2;
        const mx = (cx + nx) / 2;
        next.push({ n: node.n, d: `M ${cx} ${cy} Q ${mx} ${cy} ${nx} ${ny}` });
      }
      setConectores(next);
    };
    compute();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(compute) : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", compute);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [nodes]);

  return (
    <div ref={containerRef} className="relative">
      {/* Conectores (desktop) */}
      <svg
        className="pointer-events-none absolute inset-0 hidden lg:block"
        width={size.w}
        height={size.h}
        aria-hidden="true"
      >
        {conectores.map((c) => (
          <path
            key={c.n}
            d={c.d}
            fill="none"
            stroke={hovered === c.n ? "var(--secondary)" : "var(--line)"}
            strokeWidth={hovered === c.n ? 2 : 1.5}
            style={{ transition: "stroke 200ms cubic-bezier(0.22,1,0.36,1)" }}
          />
        ))}
      </svg>

      <div className="relative flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-12">
        {/* Nó central */}
        <div className="lg:order-2 lg:justify-self-center">
          <div
            ref={centerRef}
            className="mx-auto w-full max-w-[300px] rounded-2xl bg-[var(--ink)] px-6 py-6 text-center text-white"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/50">
              Seu negócio
            </p>
            <p className="font-cabinet mt-1 text-[26px] leading-tight text-white">
              {businessName || "Seu negócio"}
            </p>
            <p className="mt-1.5 text-[12px] text-white/70">
              {concluidos >= total
                ? `${total} módulos · planejamento concluído`
                : `${concluidos} de ${total} módulos concluídos`}
            </p>
          </div>
        </div>

        {/* Coluna esquerda (módulos 1 a 3) */}
        <div className="flex flex-col gap-6 lg:order-1">
          {esquerda.map((node) => (
            <NoCard
              key={node.n}
              node={node}
              refCb={(el) => (nodeRefs.current[node.n] = el)}
              onHover={setHovered}
              onAbrirConcluido={onAbrirConcluido}
              onAbrirModulo={onAbrirModulo}
            />
          ))}
        </div>

        {/* Coluna direita (módulos 4 a 6) */}
        <div className="flex flex-col gap-6 lg:order-3">
          {direita.map((node) => (
            <NoCard
              key={node.n}
              node={node}
              refCb={(el) => (nodeRefs.current[node.n] = el)}
              onHover={setHovered}
              onAbrirConcluido={onAbrirConcluido}
              onAbrirModulo={onAbrirModulo}
            />
          ))}
        </div>
      </div>

      <p className="mt-8 text-center text-[13px] text-[var(--muted)]">
        Módulo concluído abre no documento. Em aberto, abre pra responder.
      </p>
    </div>
  );
}

function NoCard({
  node,
  refCb,
  onHover,
  onAbrirConcluido,
  onAbrirModulo,
}: {
  node: NoMapa;
  refCb: (el: HTMLElement | null) => void;
  onHover: (n: number | null) => void;
  onAbrirConcluido: (n: number) => void;
  onAbrirModulo: (n: number) => void;
}) {
  const Icone = MODULO_ICONE[node.n];
  const chipBg = node.n % 2 === 1 ? "var(--surface-pink)" : "var(--secondary-light)";
  return (
    <button
      type="button"
      ref={refCb}
      onMouseEnter={() => onHover(node.n)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(node.n)}
      onBlur={() => onHover(null)}
      onClick={() => (node.concluido ? onAbrirConcluido(node.n) : onAbrirModulo(node.n))}
      className="group w-full max-w-[260px] rounded-xl border border-[var(--line)] bg-white p-4 text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-[var(--secondary)] hover:shadow-[0_4px_12px_rgba(10,10,10,0.08)] lg:mx-auto"
      style={{ transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: chipBg }}
        >
          <Icone size={16} className="text-[var(--ink)]" aria-hidden="true" />
        </span>
        <span className="text-[16px] leading-tight text-[var(--ink)]">{node.nome}</span>
      </div>

      {node.concluido && node.snippet ? (
        <p className="mt-2.5 line-clamp-3 text-[12.5px] leading-snug text-[var(--ink-soft)]">
          {node.snippet}
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-1.5">
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ background: node.concluido ? "var(--secondary)" : "var(--line)" }}
          aria-hidden="true"
        />
        <span className="text-[11px] text-[var(--muted)]">
          {node.concluido ? `concluído · ${node.ferramentaNome}` : "não iniciado"}
        </span>
      </div>
    </button>
  );
}
