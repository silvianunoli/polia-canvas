import { Trophy, Sparkles, Star } from "lucide-react";

export type ConquistaEstado = "vazio" | "atual" | "anterior";

interface ConquistaSemanaProps {
  estado: ConquistaEstado;
  /** Título da conquista (ex.: "3 tarefas floresceram"). */
  titulo?: string;
  /** Microcopy emocional opcional (Caveat). */
  sub?: string;
}

/**
 * Bloco "Conquista da semana" do Painel — 3 estados.
 * Mora num card do tamanho dos demais widgets do painel.
 */
export function ConquistaSemana({ estado, titulo, sub }: ConquistaSemanaProps) {
  if (estado === "vazio") {
    return (
      <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] p-6">
        <div className="mb-3 flex items-center gap-2">
          <Star size={16} className="text-polia-creme/50" />
          <p className="font-accent text-[10px] font-bold uppercase tracking-[2px] text-polia-creme/60">
            CONQUISTA DA SEMANA
          </p>
        </div>
        <p className="font-sans text-[14px] text-polia-creme/70">
          sua primeira conquista aparece quando você concluir a primeira tarefa.
        </p>
        <p className="mt-2 caveat-decorativo text-polia-creme/40">
          tudo começa aqui.
        </p>
      </div>
    );
  }

  if (estado === "atual") {
    return (
      <div
        className="rounded-2xl border p-6"
        style={{
          background: "rgba(232,151,112,0.08)",
          borderColor: "rgba(232,151,112,0.25)",
        }}
      >
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-polia-terracota" />
          <p className="font-accent text-[10px] font-bold uppercase tracking-[2px] text-polia-terracota">
            CONQUISTA DESTA SEMANA
          </p>
        </div>
        <p className="font-sans text-[16px] font-semibold text-polia-creme">
          {titulo ?? "essa semana você avançou."}
        </p>
        {sub && (
          <p className="mt-2 caveat-decorativo text-polia-terracota">
            {sub}
          </p>
        )}
      </div>
    );
  }

  // anterior
  return (
    <div className="rounded-2xl border border-[rgba(200,169,110,0.25)] bg-[rgba(200,169,110,0.06)] p-6">
      <div className="mb-3 flex items-center gap-2">
        <Trophy size={16} className="text-polia-dourado" />
        <p className="font-accent text-[10px] font-bold uppercase tracking-[2px] text-polia-dourado">
          CONQUISTA RECENTE
        </p>
      </div>
      <p className="font-sans text-[15px] text-polia-creme/90">
        {titulo ?? "acesa na sua constelação."}
      </p>
      {sub && (
        <p className="mt-2 caveat-decorativo text-polia-creme/60">
          {sub}
        </p>
      )}
    </div>
  );
}
