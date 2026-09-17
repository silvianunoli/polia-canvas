// Mapa rota -> feature do produto, o mesmo catálogo de founder_features no
// banco. Fica em código (não em query) porque roda a cada troca de rota no
// client. Ao criar rota logada nova, entra aqui e no seed da tabela.
export const FEATURES_POR_ROTA: { prefixo: string; feature: string }[] = [
  { prefixo: "/painel", feature: "painel" },
  { prefixo: "/planejamento", feature: "planejamento" },
  { prefixo: "/produtos", feature: "produtos" },
  { prefixo: "/projecao", feature: "projecao" },
  { prefixo: "/financeiro", feature: "financeiro" },
  { prefixo: "/raiox", feature: "raiox" },
  { prefixo: "/clientes", feature: "clientes" },
  { prefixo: "/metas", feature: "metas" },
  { prefixo: "/caderno", feature: "caderno" },
  { prefixo: "/planner", feature: "planner" },
  { prefixo: "/plano-conteudo", feature: "plano_conteudo" },
  { prefixo: "/calendario", feature: "calendario" },
  { prefixo: "/aimer", feature: "aimer" },
  { prefixo: "/marca", feature: "marca" },
  { prefixo: "/mercado", feature: "mercado" },
  { prefixo: "/configuracoes", feature: "configuracoes" },
  { prefixo: "/chamados", feature: "chamados" },
  { prefixo: "/assinar", feature: "assinar" },
  { prefixo: "/upgrade", feature: "upgrade" },
  { prefixo: "/onboarding", feature: "onboarding" },
];

export function featureDaRota(pathname: string): string | null {
  for (const f of FEATURES_POR_ROTA) {
    if (pathname === f.prefixo || pathname.startsWith(f.prefixo + "/")) return f.feature;
  }
  return null;
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// Sem id de registro na página: "/chamados/3f2a..." vira "/chamados/:id",
// senão cada chamado seria uma "tela" diferente nas contagens.
export function normalizarPagina(pathname: string): string {
  return pathname.replace(UUID_RE, ":id").replace(/\/\d+(?=\/|$)/g, "/:n");
}

export type Ambiente = "prod" | "preview" | "dev";

export function ambienteDoHost(hostname: string): Ambiente {
  if (hostname === "one.usepolia.com.br") return "prod";
  if (hostname === "localhost" || hostname === "127.0.0.1") return "dev";
  return "preview";
}
