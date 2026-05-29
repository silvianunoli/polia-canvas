// Helper único de mapeamento Etapa → Fase Pólia.
// Use em TODOS os lugares (badges, chips, cores) pra evitar drift de copy/cor.

export type FaseId = "sonho" | "construcao" | "venda" | "evolucao";

export interface FaseInfo {
  id: FaseId;
  nome: string;
  cor: string; // hex
  corBg: string; // rgba 12%
  corBorder: string; // rgba 30%
}

const FASES: Record<FaseId, FaseInfo> = {
  sonho: {
    id: "sonho",
    nome: "Sonho",
    cor: "#C9407A",
    corBg: "rgba(201,64,122,0.12)",
    corBorder: "rgba(201,64,122,0.3)",
  },
  construcao: {
    id: "construcao",
    nome: "Construção",
    cor: "#1A7FAD",
    corBg: "rgba(26,127,173,0.12)",
    corBorder: "rgba(26,127,173,0.3)",
  },
  venda: {
    id: "venda",
    nome: "Venda",
    cor: "#1A8F5C",
    corBg: "rgba(26,143,92,0.12)",
    corBorder: "rgba(26,143,92,0.3)",
  },
  evolucao: {
    id: "evolucao",
    nome: "Evolução",
    cor: "#6B50CC",
    corBg: "rgba(107,80,204,0.12)",
    corBorder: "rgba(107,80,204,0.3)",
  },
};

export function getFaseByEtapa(etapa: number): FaseInfo {
  if (etapa <= 3) return FASES.sonho;
  if (etapa <= 6) return FASES.construcao;
  if (etapa <= 9) return FASES.venda;
  return FASES.evolucao;
}

export function getFaseById(id: FaseId): FaseInfo {
  return FASES[id];
}

/** Aceita rótulo legado ("Sonho", "construcao", "Construção"…) e devolve FaseInfo. */
export function getFaseByLabel(label: string | null | undefined): FaseInfo | null {
  if (!label) return null;
  const l = label.toLowerCase();
  if (l.includes("sonho")) return FASES.sonho;
  if (l.includes("constru")) return FASES.construcao;
  if (l.includes("venda")) return FASES.venda;
  if (l.includes("evolu")) return FASES.evolucao;
  return null;
}
