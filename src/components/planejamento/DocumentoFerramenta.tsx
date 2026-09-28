import { CamposDoc, FerramentaVazia } from "@/components/planejamento/CamposDoc";

interface DocumentoFerramentaProps {
  carregando: boolean;
  temAlgo: boolean;
  mapa: Map<string, string>;
  campos: string[];
  moduloN: number;
  tituloVazio: string;
  textoVazio: string;
}

/**
 * Estados de loading/vazio/conteúdo de uma ferramenta derivada do Planejamento
 * (marca, mapa de mercado) — bloco copiado idêntico entre marca.tsx e
 * mercado.tsx, extraído numa rodada de limpeza de duplicação (set/2026).
 */
export function DocumentoFerramenta({
  carregando,
  temAlgo,
  mapa,
  campos,
  moduloN,
  tituloVazio,
  textoVazio,
}: DocumentoFerramentaProps) {
  return (
    <div>
      {carregando ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface)]"
            />
          ))}
        </div>
      ) : temAlgo ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6 md:p-8">
          <CamposDoc mapa={mapa} campos={campos} />
        </div>
      ) : (
        <FerramentaVazia moduloN={moduloN} titulo={tituloVazio} texto={textoVazio} />
      )}
    </div>
  );
}
