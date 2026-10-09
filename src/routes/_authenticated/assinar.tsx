import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toastErro, toastSucesso } from "@/lib/toast";
import {
  abrirTrocaDePlano,
  cancelarAssinatura,
  iniciarAssinatura,
  statusAssinatura,
  type PlanoAssinatura,
} from "@/lib/stripe.functions";
import { useUserMeta } from "@/hooks/useUserMeta";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { AssinaturaCheckout } from "@/components/configuracoes/AssinaturaCheckout";
import { track } from "@/lib/analytics";
import { gtagEvent } from "@/lib/gtag";
import {
  ehBeta,
  tierDoPlano,
  valorDoPlano,
  resumoDoPlano,
  FEATURES_GRATIS,
  TIERS_PAGOS,
  type TierPago,
} from "@/lib/planos";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { fraseDoGanho } from "@/lib/ganhoDoUpgrade";

type TierId = TierPago;
type CicloId = "mensal" | "anual";

interface AssinarSearch {
  plano?: TierId;
  // "onboarding": veio do fim do onboarding e vê o "ÚLTIMO PASSO". Quem chega
  // da /upgrade no meio do uso ou com a conta cancelada vê um título neutro.
  de?: "onboarding";
  // Tela bloqueada de onde ela veio (via /upgrade): vira a frase do que o
  // plano libera, em cima dos dois planos (09/10/2026).
  rota?: string;
  // Volta do Stripe depois de um meio de pagamento com redirecionamento
  // (confirmParams.return_url do AssinaturaCheckout). O Stripe acrescenta
  // redirect_status=succeeded|processing|failed.
  redirect_status?: string;
}

// Status em que a conta já tem o plano pago gravado (ver webhook).
const PLANOS_PAGOS = ["controle", "projete"];
const ESPERA_PLANO_MS = 20_000;
const INTERVALO_PLANO_MS = 1_000;

const TIERS = TIERS_PAGOS;

function fmtPreco(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: v % 1 ? 2 : 0 })}`;
}

export const Route = createFileRoute("/_authenticated/assinar")({
  head: () => ({
    meta: [
      { title: "Assine a Pólia One" },
      { name: "description", content: "Escolha seu plano e comece a usar a Pólia One." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): AssinarSearch => ({
    plano: search.plano === "controle" || search.plano === "projete" ? search.plano : undefined,
    de: search.de === "onboarding" ? "onboarding" : undefined,
    rota:
      typeof search.rota === "string" &&
      search.rota.startsWith("/") &&
      !search.rota.startsWith("//")
        ? search.rota
        : undefined,
    redirect_status:
      typeof search.redirect_status === "string" ? search.redirect_status : undefined,
  }),
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed, plano")
      .eq("id", sess.session.user.id)
      .maybeSingle();
    if (!profile?.onboarding_completed) throw redirect({ to: "/onboarding" });

    // Quem pode ver esta tela (09/10/2026, pedido da Sil: os planos lado a
    // lado em qualquer plano):
    //  - Grátis e cancelada: escolhem e pagam aqui;
    //  - Premium ou Pro com assinatura ativa no Stripe: veem o Premium e o Pro
    //    lado a lado, o seu marcado, e trocam pelo portal (cobra a diferença);
    //  - Premium liberado pela Pólia, sem assinatura, pedindo o Pro: compra o
    //    Pro aqui pelo checkout normal.
    // Beta e plano liberado sem cobrança (fora o caso acima) não têm o que
    // comprar: vão pro Painel. `profiles.plano` é a fonte do direito de acesso
    // (ver _authenticated.tsx).
    const plano = (profile as { plano?: string | null } | null)?.plano;
    if (ehBeta(plano)) throw redirect({ to: "/painel" });
    if (plano === "controle" || plano === "projete") {
      const { data: assinatura } = await supabase
        .from("assinaturas" as never)
        .select("status")
        .eq("user_id", sess.session.user.id)
        .maybeSingle();
      const status = (assinatura as { status: string } | null)?.status;
      const ativa = status ? ["active", "past_due", "trialing"].includes(status) : false;
      if (ativa) return;
      if (plano === "controle" && search.plano === "projete") return;
      throw redirect({ to: "/painel" });
    }
  },
  component: AssinarPage,
});

function AssinarPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const assinaturaQuery = useQuery({
    queryKey: ["assinatura-status"],
    queryFn: () => statusAssinatura(),
  });

  const [ciclo, setCiclo] = useState<CicloId>("mensal");
  const [planoIniciando, setPlanoIniciando] = useState<PlanoAssinatura | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [planoNoCheckout, setPlanoNoCheckout] = useState<PlanoAssinatura | null>(null);
  const [ativando, setAtivando] = useState(false);
  // Assinante (Premium ou Pro com assinatura ativa) vê os dois planos pagos
  // e troca pelo portal; não passa pelo checkout de novo.
  const meta = useUserMeta();
  const planoAtual: TierId | null =
    meta.plano === "controle" || meta.plano === "projete" ? meta.plano : null;
  const assinante = !!planoAtual && !!assinaturaQuery.data?.ativa;
  const [trocando, setTrocando] = useState<TierId | null>(null);
  const cancelaNoFim = !!assinaturaQuery.data?.cancelAtPeriodEnd;
  const dataFimPeriodo = assinaturaQuery.data?.currentPeriodEnd
    ? new Date(assinaturaQuery.data.currentPeriodEnd).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })
    : "o fim do período já pago";
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const voltarProGratis = async () => {
    setCancelando(true);
    try {
      const resultado = await cancelarAssinatura();
      if (!resultado.ok) {
        toastErro(
          resultado.error ??
            "A Pólia One não conseguiu cancelar sua assinatura agora. Tenta de novo.",
        );
        return;
      }
      track("assinatura_cancelada", { origem: "planos" });
      toastSucesso("Assinatura cancelada. Fica ativa até o fim do período já pago.");
      setConfirmandoCancelamento(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assinatura-status"] }),
        queryClient.invalidateQueries({ queryKey: ["user-meta"] }),
      ]);
    } catch {
      toastErro("A Pólia One não conseguiu cancelar sua assinatura agora. Tenta de novo.");
    } finally {
      setCancelando(false);
    }
  };
  const trocarPlano = async (destino: TierId) => {
    setTrocando(destino);
    track("upgrade_cta_clicado", { rota: search.rota, tier: destino, troca: true });
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
    setTrocando(null);
  };
  const desmontou = useRef(false);
  useEffect(() => {
    // Volta pra false na remontagem do StrictMode (dev), senão a espera parava.
    desmontou.current = false;
    return () => {
      desmontou.current = true;
    };
  }, []);

  // Depois do pagamento, quem libera o plano é o webhook do Stripe, que chega
  // segundos depois. Antes a tela ia direto pro Painel com o useUserMeta ainda
  // em cache (Grátis, staleTime 60s) e os cadeados não abriam por até 1 minuto
  // (08/10/2026). Agora espera profiles.plano virar pago (até 20s), invalida o
  // cache e só então vai pro Painel.
  const ativarPlano = useCallback(
    async (tierComprado: TierId | null) => {
      setAtivando(true);
      const liberou = (plano: string | null | undefined) => {
        if (!plano || !PLANOS_PAGOS.includes(plano)) return false;
        // Comprou o Pro: o Premium que ela já tinha não conta como liberado.
        return tierComprado !== "projete" || plano === "projete";
      };
      const limite = Date.now() + ESPERA_PLANO_MS;
      let pronto = false;
      try {
        const { data: sess } = await supabase.auth.getSession();
        const userId = sess.session?.user.id;
        while (userId && !desmontou.current && Date.now() < limite) {
          const { data } = await supabase
            .from("profiles")
            .select("plano")
            .eq("id", userId)
            .maybeSingle();
          if (liberou((data as { plano?: string | null } | null)?.plano)) {
            pronto = true;
            break;
          }
          await new Promise((r) => window.setTimeout(r, INTERVALO_PLANO_MS));
        }
      } catch {
        // Leitura falhou: o pagamento já entrou, segue pro Painel com o aviso.
      }
      if (desmontou.current) return;
      // Prefixo ["user-meta"] pega a chave ["user-meta", userId] do useUserMeta.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user-meta"] }),
        queryClient.invalidateQueries({ queryKey: ["assinatura-status"] }),
      ]);
      if (pronto) toastSucesso("Pagamento confirmado. Bem-vinda à Pólia One.");
      else toastSucesso("O pagamento entrou. O plano libera em instantes.");
      navigate({ to: "/painel" });
    },
    [navigate, queryClient],
  );

  // Volta de um meio de pagamento com redirecionamento (return_url): mesmo
  // caminho de ativação. "failed" fica na tela, pra tentar de novo.
  const statusRetorno = search.redirect_status;
  const retornoTratado = useRef(false);
  useEffect(() => {
    if (retornoTratado.current) return;
    if (statusRetorno === "succeeded" || statusRetorno === "processing") {
      retornoTratado.current = true;
      void ativarPlano(search.plano ?? null);
    } else if (statusRetorno === "failed") {
      retornoTratado.current = true;
      toastErro("O pagamento não foi confirmado. Tenta de novo ou usa outro cartão.");
    }
  }, [statusRetorno, search.plano, ativarPlano]);

  const assinar = async (tier: TierId) => {
    const plano: PlanoAssinatura = `${tier}_${ciclo}`;
    setPlanoIniciando(plano);
    try {
      const resultado = await iniciarAssinatura({ data: { plano } });
      if (resultado.error || !resultado.clientSecret) {
        track("assinatura_falhou", { plano, motivo: resultado.error ?? "sem_client_secret" });
        toastErro(
          resultado.error ??
            "A Pólia One não conseguiu iniciar sua assinatura agora. Tenta de novo.",
        );
        return;
      }
      track("assinatura_iniciada", { plano });
      setPlanoNoCheckout(plano);
      setClientSecret(resultado.clientSecret);
    } catch {
      track("assinatura_falhou", { plano, motivo: "excecao_client" });
      toastErro("A Pólia One não conseguiu iniciar sua assinatura agora. Tenta de novo.");
    } finally {
      setPlanoIniciando(null);
    }
  };

  if (ativando) {
    return (
      <div className="polia-v3 flex min-h-screen items-center justify-center bg-[var(--bg)] px-6 py-16">
        <div role="status" aria-live="polite" className="max-w-[420px] text-center">
          <h1 className="font-cabinet text-[28px] leading-tight text-[var(--ink)]">
            Ativando o plano...
          </h1>
          <p className="mt-3 font-sans text-[15px] text-[var(--ink-soft)]">
            O pagamento entrou. A Pólia One está liberando o plano na sua conta, leva só alguns
            segundos.
          </p>
        </div>
      </div>
    );
  }

  // "ÚLTIMO PASSO / O seu negócio já está montado" só faz sentido no fim do
  // onboarding. Quem chega da /upgrade no meio do uso ou com a conta cancelada
  // vê um título neutro (08/10/2026).
  const vemDoOnboarding = search.de === "onboarding";
  // Veio de uma tela bloqueada: diz o que destrava, no plano que a tela pede.
  const ganhoDaTela =
    search.rota && search.plano ? fraseDoGanho(search.rota, TIERS[search.plano].titulo) : null;

  return (
    <div className="polia-v3 flex min-h-screen items-center justify-center bg-[var(--bg)] px-6 py-16">
      <div className="w-full max-w-[1000px]">
        {vemDoOnboarding && (
          <p className="mb-2 text-center text-[10px] font-accent font-bold uppercase tracking-[2px] text-[var(--muted)]">
            ÚLTIMO PASSO
          </p>
        )}
        {ganhoDaTela && search.plano && (
          <p className="mb-2 text-center text-[10px] font-accent font-bold uppercase tracking-[2px] text-[var(--muted)]">
            Recurso do plano {TIERS[search.plano].titulo}
          </p>
        )}
        <h1 className="mb-3 text-center font-cabinet text-[36px] leading-tight text-[var(--ink)]">
          {assinante ? "Os planos da Pólia One" : "Escolha seu plano"}
        </h1>
        <p className="mb-8 text-center font-sans text-[16px] text-[var(--ink-soft)]">
          {ganhoDaTela
            ? assinante
              ? `${ganhoDaTela} A troca cobra só a diferença do mês.`
              : ganhoDaTela
            : assinante
              ? "A troca é feita na página de pagamento, que cobra só a diferença do mês. O que já está guardado continua no lugar."
              : vemDoOnboarding
                ? "O seu negócio já está montado. Escolhe o plano, que ele abre na sua conta assim que o pagamento entra."
                : "O plano abre na sua conta assim que o pagamento entra. O que já está guardado continua no lugar."}
        </p>

        {/* Ciclo mensal/anual. Assinante escolhe o ciclo no portal, na troca. */}
        <div
          hidden={assinante}
          className="mx-auto mb-8 flex w-fit gap-0.5 rounded-lg border border-[var(--line)] bg-white p-[3px]"
        >
          {(
            [
              { id: "mensal", label: "Mensal" },
              { id: "anual", label: "Anual · 2 meses grátis" },
            ] as { id: CicloId; label: string }[]
          ).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCiclo(c.id)}
              aria-pressed={ciclo === c.id}
              className={`rounded-md px-4 py-2 font-sans text-[13px] font-medium transition-colors ${
                ciclo === c.id
                  ? "bg-[var(--secondary)] text-[var(--secondary-ink)]"
                  : "text-[var(--ink-soft)]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Assinante também vê o Grátis (pedido da Sil, 09/10/2026: "precisa
              aparecer tudo"). Voltar pro Grátis é cancelar a assinatura, com a
              mesma confirmação de Configurações; o plano pago segue até o fim
              do período já pago. */}
          <PlanoCard
            titulo="Grátis"
            preco="R$ 0"
            periodo="sem cobrança"
            features={FEATURES_GRATIS}
            botaoLabel={
              !assinante
                ? "Continuar no Grátis"
                : cancelaNoFim
                  ? `Volta pro Grátis em ${dataFimPeriodo}`
                  : "Voltar pro Grátis"
            }
            carregando={false}
            desabilitado={
              planoIniciando !== null ||
              trocando !== null ||
              assinaturaQuery.isLoading ||
              (assinante && cancelaNoFim)
            }
            onAssinar={() =>
              assinante ? setConfirmandoCancelamento(true) : navigate({ to: "/painel" })
            }
          />
          {(Object.entries(TIERS) as [TierId, (typeof TIERS)[TierId]][]).map(([tierId, tier]) => (
            <PlanoCard
              key={tierId}
              titulo={tier.titulo}
              preco={fmtPreco(ciclo === "mensal" ? tier.precoMensal : tier.precoAnual)}
              periodo={ciclo === "mensal" ? "por mês" : "por ano"}
              features={tier.features}
              destaque={assinante ? false : tier.destaque}
              carregando={assinante ? trocando === tierId : planoIniciando === `${tierId}_${ciclo}`}
              desabilitado={
                planoIniciando !== null ||
                trocando !== null ||
                assinaturaQuery.isLoading ||
                (assinante && planoAtual === tierId)
              }
              foco={assinante ? false : search.plano === tierId}
              seuPlano={assinante && planoAtual === tierId}
              botaoLabel={
                assinante
                  ? planoAtual === tierId
                    ? "Seu plano atual"
                    : `Mudar pro ${tier.titulo}`
                  : undefined
              }
              botaoPrincipal={assinante && planoAtual !== tierId}
              onAssinar={() => (assinante ? trocarPlano(tierId) : assinar(tierId))}
            />
          ))}
        </div>

        <p
          hidden={assinante}
          className="mt-6 text-center font-sans text-[12px] text-[var(--muted)]"
        >
          cancela quando quiser, direto em Configurações. Volta pro plano Grátis, sem apagar o
          Planejamento.
        </p>
      </div>

      <ConfirmarAcao
        open={confirmandoCancelamento}
        onOpenChange={(aberto) => {
          if (!cancelando) setConfirmandoCancelamento(aberto);
        }}
        titulo="Voltar pro plano Grátis?"
        descricao={
          <>
            O {planoAtual ? TIERS[planoAtual].titulo : "plano"} continua ativo até {dataFimPeriodo}.
            Depois, a conta volta pro plano Grátis: os dados continuam guardados, e as telas do
            plano pago deixam de abrir. Não tem nova cobrança.
          </>
        }
        textoCancelar="Manter assinatura"
        textoConfirmar="Voltar pro Grátis"
        textoCarregando="Cancelando…"
        destrutivo
        carregando={cancelando}
        onConfirmar={voltarProGratis}
      />

      {clientSecret && (
        <AssinaturaCheckout
          clientSecret={clientSecret}
          resumo={resumoDoPlano(planoNoCheckout)}
          onClose={() => setClientSecret(null)}
          onSucesso={() => {
            track("assinatura_concluida");
            // Conversão de compra pro GA4/Google Ads (FUN-09).
            const valor = valorDoPlano(planoNoCheckout);
            if (valor !== null) {
              gtagEvent("purchase", {
                value: valor,
                currency: "BRL",
                items: [
                  {
                    item_id: planoNoCheckout,
                    item_name: planoNoCheckout,
                    price: valor,
                    quantity: 1,
                  },
                ],
              });
            }
            setClientSecret(null);
            // Espera o webhook liberar o plano antes de ir pro Painel (ver
            // ativarPlano). O tier vem da chave do plano: "projete_anual" -> "projete".
            void ativarPlano(planoNoCheckout ? (planoNoCheckout.split("_")[0] as TierId) : null);
          }}
          returnUrl={
            typeof window !== "undefined" && planoNoCheckout
              ? `${window.location.origin}/assinar?plano=${planoNoCheckout.split("_")[0]}`
              : undefined
          }
        />
      )}
    </div>
  );
}

function PlanoCard({
  titulo,
  preco,
  periodo,
  features,
  destaque,
  foco,
  carregando,
  desabilitado,
  onAssinar,
  botaoLabel,
  seuPlano,
  botaoPrincipal,
}: {
  titulo: string;
  preco: string;
  periodo: string;
  features: string[];
  destaque?: boolean;
  foco?: boolean;
  carregando: boolean;
  desabilitado: boolean;
  onAssinar: () => void;
  botaoLabel?: string;
  /** Assinante: marca o cartão do plano dela. */
  seuPlano?: boolean;
  /** Botão com rótulo próprio que ainda é a ação principal (ex.: "Mudar pro Pro"). */
  botaoPrincipal?: boolean;
}) {
  const realcado = destaque || foco || seuPlano;
  return (
    <div
      className={`flex flex-col rounded-2xl border p-6 ${
        realcado ? "border-[var(--secondary)] bg-white" : "border-[var(--line)] bg-white"
      }`}
    >
      {/* O selo existe só num dos cartões, e sem reservar a altura ele empurrava
          título e preço 28px pra baixo: os dois planos ficavam desalinhados
          justamente na linha que a pessoa compara. `invisible` guarda o espaço. */}
      <span
        aria-hidden={!realcado}
        className={`mb-2 inline-block w-fit rounded bg-[var(--secondary)] px-2 py-0.5 text-[10px] font-accent font-bold uppercase tracking-[1px] text-[var(--secondary-ink)] ${
          realcado ? "" : "invisible"
        }`}
      >
        {seuPlano ? "Seu plano" : destaque ? "Melhor valor" : "Escolhido"}
      </span>
      <p className="text-[13px] font-accent font-bold uppercase tracking-[1px] text-[var(--ink-soft)]">
        {titulo}
      </p>
      <p className="mt-1 font-cabinet text-[32px] leading-none text-[var(--ink)]">{preco}</p>
      <p className="mt-1 font-sans text-[12px] text-[var(--muted)]">{periodo}</p>
      <ul className="mt-4 space-y-1.5">
        {features.map((f) => (
          <li key={f} className="font-sans text-[12.5px] leading-snug text-[var(--ink-soft)]">
            {f}
          </li>
        ))}
      </ul>
      {/* `mt-auto` no wrapper ancora o botão na base do cartão. Com `mt-5` ele
          parava logo depois da lista, e como o Premium tem mais itens que o
          Pro, os dois botões ficavam 99px desalinhados — na única tela do
          app que cobra. */}
      <div className="mt-auto pt-5">
        <button
          type="button"
          onClick={onAssinar}
          disabled={desabilitado}
          className={`${botaoLabel && !botaoPrincipal ? BTN_ACAO_CONTORNO : BTN_ACAO} w-full`}
        >
          {carregando ? "Preparando..." : (botaoLabel ?? `Assinar o ${titulo}`)}
        </button>
      </div>
    </div>
  );
}
