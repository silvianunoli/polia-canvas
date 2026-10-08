import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { TIERS_PAGOS, ehBeta, temProjete, tierDoPlano, type TierPago } from "@/lib/planos";
import { track } from "@/lib/analytics";
import { BTN_ACAO } from "@/lib/botoes";
import { SeloCadeado } from "@/components/layout/UpgradeGate";
import { useUserMeta } from "@/hooks/useUserMeta";
import { abrirTrocaDePlano, statusAssinatura } from "@/lib/stripe.functions";
import { toastErro } from "@/lib/toast";

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

// O ganho concreto da área de onde ela veio. Sem rota conhecida, cai no fallback.
const GANHO_POR_ROTA: Record<string, string> = {
  "/financeiro": "Aqui entra tudo que entrou e saiu, e o Premium mostra quanto sobrou no mês.",
  // Botão "Resumo pro contador" do Financeiro: a tela já abre no Premium, o
  // que é do Pro é o resumo (08/10/2026).
  "/financeiro/resumo": "O Pro monta o resumo do mês pro contador, em PDF e CSV.",
  "/produtos": "O Premium solta o limite: cada produto com o custo, o preço e quanto sobra.",
  "/calculadora":
    "O Pro abre o modo Encomenda: o preço de um pedido sob medida, material por material.",
  // Raio-x é Pro, não Premium (ROTAS_PROJETE + o portão `temProjete` dentro
  // da página). Nomear o Premium aqui vendia por R$ 29,90 uma tela que só abre
  // no Pro, e ainda contradizia o selo "Recurso do plano Pro" logo acima.
  "/raiox": "O Pro lê o seu mês e devolve onde o dinheiro está vazando.",
  "/projecao": "O Pro mostra quantas vendas fecham o mês e quantas pagam o seu salário.",
  // O banco tem 60 ideias por nicho, que se repetem ao longo do ano: não
  // prometer "uma ideia nova por dia" (08/10/2026).
  "/plano-conteudo":
    "O Pro monta o plano de conteúdo do ano: 60 ideias do seu nicho espalhadas pelos dias, uma por dia.",
  // Rotas pagas que caíam no fallback genérico (08/10/2026).
  "/marca": "O Premium escreve o documento da sua Marca a partir do que o Planejamento já sabe.",
  "/mercado": "O Premium monta o Mapa de Mercado a partir das respostas do Planejamento.",
  "/calendario": "O Premium abre o Calendário, com a agenda do Google junto.",
  "/clientes": "O Premium mostra cada cliente com o status do pedido, da espera à entrega.",
  // Telas com cota no Grátis: a tela abre, o que o Premium muda é o limite.
  "/caderno": "O Premium tira o limite do Caderno: notas sem teto.",
  "/planner": "O Premium tira o limite do Planner: quadros sem teto.",
  "/aimer": "O Premium aumenta o teto diário do Assistente.",
};

// Telas que abrem no Grátis com limite. Sem frase própria, o fallback não
// pode dizer "essa tela abre": ela já está aberta, o que muda é o limite
// ("aumenta", não "tira": a IA do Planejamento tem teto até no Pro).
const ROTAS_COM_COTA = ["/caderno", "/planner", "/produtos", "/planejamento", "/aimer"];

function UpgradePage() {
  const search = Route.useSearch();
  const tierId: TierPago = search.tier ?? TIER_PADRAO;
  const tier = TIERS_PAGOS[tierId];
  const rotaComCota = !!search.rota && ROTAS_COM_COTA.some((r) => search.rota!.startsWith(r));
  const ganho =
    (search.rota ? GANHO_POR_ROTA[search.rota] : undefined) ??
    (rotaComCota
      ? `O ${tier.titulo} aumenta o limite.`
      : `Assinando o ${tier.titulo}, essa tela abre na sua conta na hora.`);

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
