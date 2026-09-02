import { Lock } from "lucide-react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { TIERS_PAGOS, type TierPago } from "@/lib/planos";
import { track } from "@/lib/analytics";

interface UpgradeSearch {
  rota?: string;
  tier?: TierPago;
}

// Sem `?tier`, a tela vende o Controle. Fica aqui em cima porque o título da aba
// e o corpo da página precisam cair no MESMO padrão: eram dois lugares decidindo
// o plano, e o título estava fixo no Controle mesmo com `?tier=projete`.
const TIER_PADRAO: TierPago = "controle";

export const Route = createFileRoute("/_authenticated/upgrade")({
  head: ({ match }) => ({
    meta: [
      {
        title: `Esse recurso é do ${TIERS_PAGOS[match.search.tier ?? TIER_PADRAO].titulo} · Pólia`,
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): UpgradeSearch => ({
    rota: typeof search.rota === "string" ? search.rota : undefined,
    tier: search.tier === "controle" || search.tier === "projete" ? search.tier : undefined,
  }),
  component: UpgradePage,
});

// O ganho concreto da área de onde ela veio. Sem rota conhecida, cai no fallback.
const GANHO_POR_ROTA: Record<string, string> = {
  "/financeiro": "Aqui entra tudo que entrou e saiu, e o Controle mostra quanto sobrou no mês.",
  "/produtos": "O Controle solta o limite: cada produto com o custo, o preço e quanto sobra.",
  // Raio-x é Projete, não Controle (ROTAS_PROJETE + o portão `temProjete` dentro
  // da página). Nomear o Controle aqui vendia por R$ 29,90 uma tela que só abre
  // no Projete, e ainda contradizia o selo "Recurso do plano Projete" logo acima.
  "/raiox": "O Projete lê o seu mês e devolve onde o dinheiro está vazando.",
  "/projecao": "O Projete mostra quantas vendas fecham o mês e quantas pagam o seu pró-labore.",
  "/plano-conteudo": "O Projete monta as 365 ideias de post do ano a partir da sua marca.",
};

function UpgradePage() {
  const search = Route.useSearch();
  const tierId: TierPago = search.tier ?? TIER_PADRAO;
  const tier = TIERS_PAGOS[tierId];
  const ganho =
    (search.rota ? GANHO_POR_ROTA[search.rota] : undefined) ??
    `Assinando o ${tier.titulo}, essa tela abre na sua conta na hora.`;

  return (
    <div className="polia-v3 flex min-h-full items-center justify-center bg-[var(--bg)] px-6 py-16">
      <div className="w-full max-w-[440px] rounded-2xl border border-[var(--line)] bg-white p-8 text-center">
        <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface)]">
          <Lock size={20} className="text-[var(--ink-soft)]" aria-hidden="true" />
        </span>
        <p className="font-sans text-[13px] font-semibold uppercase tracking-[1px] text-[var(--ink-soft)]">
          Recurso do plano {tier.titulo}
        </p>
        <h1 className="mt-2 font-cabinet text-[22px] leading-snug text-[var(--ink)]">{ganho}</h1>
        {/* Sem rota conhecida o ganho já é essa frase: não repete embaixo. */}
        {search.rota && GANHO_POR_ROTA[search.rota] && (
          <p className="mt-2 font-fraunces italic text-[15px] text-[var(--ink-soft)]">
            Assinando o {tier.titulo}, essa tela abre na sua conta na hora.
          </p>
        )}

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
