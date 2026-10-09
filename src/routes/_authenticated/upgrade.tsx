import { useEffect } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { TIERS_PAGOS, ehBeta, temProjete, tierDoPlano, type TierPago } from "@/lib/planos";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { useUserMeta } from "@/hooks/useUserMeta";

interface UpgradeSearch {
  rota?: string;
  tier?: TierPago;
}

// Sem `?tier`, a tela vende o Premium. Fica aqui em cima porque o título da aba
// e o corpo da página precisam cair no MESMO padrão: eram dois lugares decidindo
// o plano, e o título estava fixo no Premium mesmo com `?tier=projete`.
const TIER_PADRAO: TierPago = "controle";

export const Route = createFileRoute("/_authenticated/upgrade")({
  head: ({ match }) => ({
    meta: [
      {
        title: `Esse recurso é do ${TIERS_PAGOS[match.search.tier ?? TIER_PADRAO].titulo} · Pólia One`,
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): UpgradeSearch => ({
    rota: typeof search.rota === "string" ? search.rota : undefined,
    tier: search.tier === "controle" || search.tier === "projete" ? search.tier : undefined,
  }),
  component: UpgradePage,
});

// Desde 09/10/2026 (pedido da Sil: "precisa aparecer tudo") esta rota só
// decide pra onde ir. Quem não tem o recurso vai pra /assinar, que mostra o
// Grátis, o Premium e o Pro lado a lado em qualquer plano: no Grátis escolhe e
// paga; no Premium ou no Pro o plano dela vem marcado, a troca abre no portal
// do Stripe (cobra só a diferença) e o Grátis vira "Voltar pro Grátis". Aqui
// só sobra a tela de quem o plano já cobre.
function UpgradePage() {
  const search = Route.useSearch();
  const tierId: TierPago = search.tier ?? TIER_PADRAO;
  const meta = useUserMeta();
  // O plano dela já cobre o tier pedido (ex.: Premium chegando em
  // /upgrade?tier=controle pelo teto do Assistente). Não vende o que ela tem.
  const jaCobre =
    !meta.carregando &&
    (tierId === "projete"
      ? temProjete(meta.plano)
      : ehBeta(meta.plano) || tierDoPlano(meta.plano) === "controle");
  const navigate = useNavigate();
  const vaiProsPlanos = !meta.carregando && !jaCobre;
  useEffect(() => {
    if (!vaiProsPlanos) return;
    void navigate({ to: "/assinar", search: { plano: tierId, rota: search.rota }, replace: true });
  }, [vaiProsPlanos, navigate, tierId, search.rota]);

  if (!jaCobre) {
    return (
      <div className="polia-v3 flex min-h-full items-center justify-center bg-[var(--bg)] px-6 py-16">
        <p className="font-sans text-[14px] text-[var(--muted)]">Carregando os planos...</p>
      </div>
    );
  }

  return (
    <div className="polia-v3 flex min-h-full items-center justify-center bg-[var(--bg)] px-6 py-16">
      <div className="w-full max-w-[440px] rounded-2xl border border-[var(--line)] bg-white p-8 text-center">
        <h1 className="font-cabinet text-[22px] leading-snug text-[var(--ink)]">
          Isso já está no seu plano.
        </h1>
        <Link to="/painel" className={`${BTN_ACAO} mt-6 w-full`}>
          Ir pro Painel
        </Link>
        {!ehBeta(meta.plano) && (
          <Link to="/assinar" className={`${BTN_ACAO_CONTORNO} mt-3 w-full`}>
            Ver os planos
          </Link>
        )}
      </div>
    </div>
  );
}
