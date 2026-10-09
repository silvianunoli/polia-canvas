import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { TIERS_PAGOS, ehBeta, temProjete, tierDoPlano, type TierPago } from "@/lib/planos";
import { track } from "@/lib/analytics";
import { BTN_ACAO } from "@/lib/botoes";
import { SeloCadeado } from "@/components/layout/UpgradeGate";
import { useUserMeta } from "@/hooks/useUserMeta";
import { abrirTrocaDePlano, statusAssinatura } from "@/lib/stripe.functions";
import { toastErro } from "@/lib/toast";
import { GANHO_POR_ROTA, fraseDoGanho } from "@/lib/ganhoDoUpgrade";

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

function UpgradePage() {
  const search = Route.useSearch();
  const tierId: TierPago = search.tier ?? TIER_PADRAO;
  const tier = TIERS_PAGOS[tierId];
  const ganho = fraseDoGanho(search.rota, tier.titulo);

  // Quem já é Premium e quer o Pro não passa pelo /assinar (só serve pro
  // Grátis): troca o plano da assinatura que já existe, no portal do Stripe,
  // que cobra só a diferença (QA-06).
  const meta = useUserMeta();
  // Troca no portal só existe pra quem tem assinatura ativa no Stripe. Premium
  // liberado pela Pólia (convite, sem cobrança) compra o Pro pelo checkout
  // normal do /assinar (08/10/2026).
  const queroProSendoPremium = tierId === "projete" && meta.plano === "controle";
  const assinaturaQuery = useQuery({
    queryKey: ["assinatura-status"],
    queryFn: () => statusAssinatura(),
    enabled: queroProSendoPremium,
  });
  const trocaDePlano = queroProSendoPremium && !!assinaturaQuery.data?.ativa;
  const carregandoPlano = meta.carregando || (queroProSendoPremium && assinaturaQuery.isLoading);
  // Sem saber se ela tem assinatura ativa, o link pro /assinar virava
  // pingue-pongue (/assinar lê assinaturas e devolve pra cá). Mostra o erro com
  // "Tentar de novo" em vez do link (08/10/2026).
  const erroAssinatura = queroProSendoPremium && assinaturaQuery.isError;
  // O plano dela já cobre o tier pedido (ex.: Premium chegando em
  // /upgrade?tier=controle pelo teto do Assistente). Não vende o que ela tem.
  const jaCobre =
    !meta.carregando &&
    (tierId === "projete"
      ? temProjete(meta.plano)
      : ehBeta(meta.plano) || tierDoPlano(meta.plano) === "controle");
  const [abrindo, setAbrindo] = useState(false);
  // Grátis (ou cancelada) escolhe entre os dois planos na /assinar, lado a lado,
  // com o plano desta tela em destaque e a mesma frase do ganho (09/10/2026,
  // pedido da Sil: "mostra direto o Premium e o Pro"). Esta tela fica só pra
  // Premium pedindo o Pro (troca no portal) e pra quem o plano já cobre.
  const navigate = useNavigate();
  const vaiPraComparacao = !meta.carregando && !jaCobre && !queroProSendoPremium;
  useEffect(() => {
    if (!vaiPraComparacao) return;
    void navigate({ to: "/assinar", search: { plano: tierId, rota: search.rota }, replace: true });
  }, [vaiPraComparacao, navigate, tierId, search.rota]);
  const mudarProPro = async () => {
    setAbrindo(true);
    track("upgrade_cta_clicado", { rota: search.rota, tier: tierId, troca: true });
    try {
      const r = await abrirTrocaDePlano();
      if (r.url) {
        window.location.assign(r.url);
        return;
      }
      toastErro(
        r.error ?? "A Pólia One não conseguiu abrir a troca de plano agora. Tenta de novo.",
      );
    } catch {
      toastErro("A Pólia One não conseguiu abrir a troca de plano agora. Tenta de novo.");
    }
    setAbrindo(false);
  };

  if (meta.carregando || vaiPraComparacao) {
    return (
      <div className="polia-v3 flex min-h-full items-center justify-center bg-[var(--bg)] px-6 py-16">
        <p className="font-sans text-[14px] text-[var(--muted)]">Carregando os planos...</p>
      </div>
    );
  }

  if (jaCobre) {
    return (
      <div className="polia-v3 flex min-h-full items-center justify-center bg-[var(--bg)] px-6 py-16">
        <div className="w-full max-w-[440px] rounded-2xl border border-[var(--line)] bg-white p-8 text-center">
          <h1 className="font-cabinet text-[22px] leading-snug text-[var(--ink)]">
            Isso já está no seu plano.
          </h1>
          <Link to="/painel" className={`${BTN_ACAO} mt-6 w-full`}>
            Ir pro Painel
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="polia-v3 flex min-h-full items-center justify-center bg-[var(--bg)] px-6 py-16">
      <div className="w-full max-w-[440px] rounded-2xl border border-[var(--line)] bg-white p-8 text-center">
        <SeloCadeado className="mx-auto mb-4" />
        <p className="text-[13px] font-accent font-bold uppercase tracking-[1px] text-[var(--ink-soft)]">
          Recurso do plano {tier.titulo}
        </p>
        <h1 className="mt-2 font-cabinet text-[22px] leading-snug text-[var(--ink)]">{ganho}</h1>
        {/* Sem rota conhecida o ganho já é essa frase: não repete embaixo. */}
        {search.rota && GANHO_POR_ROTA[search.rota] && (
          <p className="mt-2 font-sans text-[15px] text-[var(--ink-soft)]">
            Assinando o {tier.titulo}, isso abre na sua conta na hora.
          </p>
        )}

        <ul className="mt-6 space-y-1.5 text-left">
          {tier.features.map((f) => (
            <li key={f} className="font-sans text-[13px] leading-snug text-[var(--ink-soft)]">
              {f}
            </li>
          ))}
        </ul>

        {carregandoPlano ? (
          <button type="button" disabled className={`${BTN_ACAO} mt-6 w-full`}>
            Carregando...
          </button>
        ) : erroAssinatura ? (
          <div className="mt-6">
            <p role="alert" className="font-sans text-[14px] text-[var(--danger)]">
              A Pólia One não conseguiu conferir a sua assinatura agora.
            </p>
            <button
              type="button"
              onClick={() => void assinaturaQuery.refetch()}
              disabled={assinaturaQuery.isFetching}
              aria-busy={assinaturaQuery.isFetching || undefined}
              className={`${BTN_ACAO} mt-3 w-full`}
            >
              {assinaturaQuery.isFetching ? "Conferindo..." : "Tentar de novo"}
            </button>
          </div>
        ) : trocaDePlano ? (
          <>
            <button
              type="button"
              onClick={mudarProPro}
              disabled={abrindo}
              aria-busy={abrindo || undefined}
              className={`${BTN_ACAO} mt-6 w-full`}
            >
              {abrindo ? "Abrindo..." : "Mudar pro Pro"}
            </button>
            <p className="mt-3 font-sans text-[13px] leading-snug text-[var(--muted)]">
              A troca é feita na página de pagamento, que cobra só a diferença do mês.
            </p>
          </>
        ) : (
          <Link
            to="/assinar"
            search={{ plano: tierId }}
            onClick={() => track("upgrade_cta_clicado", { rota: search.rota, tier: tierId })}
            className={`${BTN_ACAO} mt-6 w-full`}
          >
            Assinar o {tier.titulo}
          </Link>
        )}
        <Link
          to="/painel"
          className="mt-3 inline-flex min-h-11 items-center font-sans text-[13px] text-[var(--secondary-text)] no-underline hover:underline"
        >
          Voltar pro Painel
        </Link>
      </div>
    </div>
  );
}
