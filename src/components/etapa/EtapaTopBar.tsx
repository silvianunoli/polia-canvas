import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

interface EtapaTopBarProps {
  etapa: number;
  fase: "SONHO" | "CONSTRUÇÃO" | "VENDA" | "EVOLUÇÃO";
  nome: string;
  /** Cor da fase (token Pólia). Opcional — derivado da fase quando ausente. */
  cor?: string;
  /** Variante de fundo. "dark" pra etapas com fundo escuro (1,2,3,4,5,6,10,11), "light" pra fundo creme. NOTA: variant dark será removida no Sprint 2 (todas viram light). */
  variant?: "dark" | "light";
}

const FASE_COR: Record<EtapaTopBarProps["fase"], string> = {
  SONHO: "#C9407A",
  CONSTRUÇÃO: "#1A7FAD",
  VENDA: "#1A8F5C",
  EVOLUÇÃO: "#6B50CC",
};

/**
 * Barra contextual da etapa: breadcrumb + "voltar ao painel".
 * Mora abaixo do PainelNav em todas as páginas /etapa/N.
 */
export function EtapaTopBar({
  etapa,
  fase,
  nome,
  cor,
  variant = "dark",
}: EtapaTopBarProps) {
  const corFase = cor ?? FASE_COR[fase];
  const textBase = variant === "dark" ? "#FDF8F5" : "#1A1A2E";
  const dim = variant === "dark" ? "opacity-60" : "opacity-50";

  return (
    <>
      {/* Voltar ao painel — fixo no canto superior esquerdo, sempre visível */}
      <Link
        to="/painel"
        aria-label="Voltar ao painel"
        className="caveat-decorativo fixed top-6 left-6 z-50 inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
        style={{ color: variant === "dark" ? "#C8A96E" : "#9A7728" }}
      >
        <ArrowLeft size={16} />
        voltar ao painel
      </Link>

      <div className="border-b border-[rgba(255,255,255,0.06)] bg-transparent">
        <div className="mx-auto flex max-w-[1280px] items-center justify-end gap-4 px-6 py-3 md:px-12">
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 font-accent text-[10px] font-bold uppercase tracking-[1.5px]"
              style={{
                background: `${corFase}26`,
                color: corFase,
              }}
            >
              {fase} · Etapa {etapa}
            </span>
            <span
              className={`font-sans text-[13px] ${dim}`}
              style={{ color: textBase }}
            >
              {nome}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
