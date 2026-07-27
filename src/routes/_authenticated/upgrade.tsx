import { Lock } from "lucide-react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { TIERS_PAGOS, type TierPago } from "@/lib/planos";
import { track } from "@/lib/analytics";

interface UpgradeSearch {
  rota?: string;
  tier?: TierPago;
}

export const Route = createFileRoute("/_authenticated/upgrade")({
  head: () => ({
    meta: [{ title: "Desbloqueie esse recurso" }],
  }),
  validateSearch: (search: Record<string, unknown>): UpgradeSearch => ({
    rota: typeof search.rota === "string" ? search.rota : undefined,
    tier: search.tier === "controle" || search.tier === "projete" ? search.tier : undefined,
  }),
  component: UpgradePage,
});

function UpgradePage() {
  const search = Route.useSearch();
  const tierId: TierPago = search.tier ?? "controle";
  const tier = TIERS_PAGOS[tierId];

  return (
    <div className="polia-v3 flex min-h-full items-center justify-center bg-[var(--bg)] px-6 py-16">
      <div className="w-full max-w-[440px] rounded-2xl border border-[var(--line)] bg-white p-8 text-center">
        <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface)]">
          <Lock size={20} className="text-[var(--ink-soft)]" aria-hidden="true" />
        </span>
        <p className="font-sans text-[13px] font-semibold uppercase tracking-[1px] text-[var(--ink-soft)]">
          Recurso do plano {tier.titulo}
        </p>
        <h1 className="mt-2 font-cabinet text-[26px] leading-tight text-[var(--ink)]">
          Esse recurso é do plano {tier.titulo}
        </h1>
        <p className="mt-2 font-fraunces italic text-[15px] text-[var(--ink-soft)]">
          Desbloqueie assinando o {tier.titulo}.
        </p>

        <ul className="mt-6 space-y-1.5 text-left">
          {tier.features.map((f) => (
            <li key={f} className="font-sans text-[13px] leading-snug text-[var(--ink-soft)]">
              {f}
            </li>
          ))}
        </ul>

        <Link
          to="/assinar"
          search={{ plano: tierId }}
          onClick={() => track("upgrade_cta_clicado", { rota: search.rota, tier: tierId })}
          className="mt-6 flex w-full items-center justify-center rounded-xl bg-[var(--secondary)] px-4 py-3 font-sans text-[14px] font-semibold text-[var(--secondary-ink)] no-underline"
        >
          Assinar o {tier.titulo}
        </Link>
        <Link
          to="/painel"
          className="mt-3 block font-sans text-[13px] text-[var(--muted)] no-underline hover:text-[var(--ink-soft)]"
        >
          Voltar pro Painel
        </Link>
      </div>
    </div>
  );
}
