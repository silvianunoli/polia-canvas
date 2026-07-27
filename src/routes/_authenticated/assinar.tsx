import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toastErro, toastSucesso } from "@/lib/toast";
import { iniciarAssinatura, statusAssinatura, type PlanoAssinatura } from "@/lib/stripe.functions";
import { AssinaturaCheckout } from "@/components/configuracoes/AssinaturaCheckout";
import { track } from "@/lib/analytics";

type TierId = "controle" | "projete";
type CicloId = "mensal" | "anual";

interface AssinarSearch {
  plano?: TierId;
}

const TIERS: Record<
  TierId,
  { titulo: string; precoMensal: number; precoAnual: number; features: string[]; destaque?: boolean }
> = {
  controle: {
    titulo: "Controle",
    precoMensal: 29.9,
    precoAnual: 299,
    features: [
      "Tudo do Confere, mais:",
      "Produtos, com a margem de cada venda na sua frente",
      "Clientes, com a entrega que vira caixa sozinha",
      "Financeiro do mês fechado num lugar",
      "Painel completo, com quanto falta pra meta",
      "Planner, Calendário, Caderno e Metas",
    ],
    destaque: true,
  },
  projete: {
    titulo: "Projete",
    precoMensal: 47.9,
    precoAnual: 479,
    features: ["Tudo do Controle, mais:", "Um plano de conteúdo do ano pras suas redes"],
  },
};

function fmtPreco(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: v % 1 ? 2 : 0 })}`;
}

export const Route = createFileRoute("/_authenticated/assinar")({
  head: () => ({
    meta: [
      { title: "Assine a Pólia" },
      { name: "description", content: "Escolha seu plano e comece a usar a Pólia." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): AssinarSearch => ({
    plano: search.plano === "controle" || search.plano === "projete" ? search.plano : undefined,
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", sess.session.user.id)
      .maybeSingle();
    if (!profile?.onboarding_completed) throw redirect({ to: "/onboarding" });

    const { data: assinatura } = await supabase
      .from("assinaturas" as never)
      .select("status")
      .eq("user_id", sess.session.user.id)
      .maybeSingle();
    const status = (assinatura as { status: string } | null)?.status;
    const ativa = status ? ["active", "past_due", "trialing"].includes(status) : false;
    if (ativa) throw redirect({ to: "/painel" });
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

  const assinar = async (tier: TierId) => {
    const plano: PlanoAssinatura = `${tier}_${ciclo}`;
    setPlanoIniciando(plano);
    try {
      const resultado = await iniciarAssinatura({ data: { plano } });
      if (resultado.error || !resultado.clientSecret) {
        track("assinatura_falhou", { plano, motivo: resultado.error ?? "sem_client_secret" });
        toastErro(resultado.error ?? "Não consegui iniciar sua assinatura agora. Tenta de novo.");
        return;
      }
      track("assinatura_iniciada", { plano });
      setClientSecret(resultado.clientSecret);
    } catch {
      track("assinatura_falhou", { plano, motivo: "excecao_client" });
      toastErro("Não consegui iniciar sua assinatura agora. Tenta de novo.");
    } finally {
      setPlanoIniciando(null);
    }
  };

  return (
    <div className="polia-v3 flex min-h-screen items-center justify-center bg-[var(--bg)] px-6 py-16">
      <div className="w-full max-w-[760px]">
        <p className="mb-2 text-center font-sans text-[10px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
          ÚLTIMO PASSO
        </p>
        <h1 className="mb-3 text-center font-cabinet text-[36px] leading-tight text-[var(--ink)]">
          Escolha seu plano
        </h1>
        <p className="mb-8 text-center font-fraunces italic text-[16px] text-[var(--ink-soft)]">
          seu negócio já está montado. assine pra abrir o resto do app.
        </p>

        {/* Ciclo mensal/anual */}
        <div className="mx-auto mb-8 flex w-fit gap-0.5 rounded-lg border border-[var(--line)] bg-white p-[3px]">
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

        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.entries(TIERS) as [TierId, (typeof TIERS)[TierId]][]).map(([tierId, tier]) => (
            <PlanoCard
              key={tierId}
              titulo={tier.titulo}
              preco={fmtPreco(ciclo === "mensal" ? tier.precoMensal : tier.precoAnual)}
              periodo={ciclo === "mensal" ? "por mês" : "por ano"}
              features={tier.features}
              destaque={tier.destaque}
              carregando={planoIniciando === `${tierId}_${ciclo}`}
              desabilitado={planoIniciando !== null || assinaturaQuery.isLoading}
              foco={search.plano === tierId}
              onAssinar={() => assinar(tierId)}
            />
          ))}
        </div>

        <p className="mt-6 text-center font-sans text-[12px] text-[var(--muted)]">
          cancela quando quiser, direto em Configurações. Volta pro Confere, sem apagar o
          Planejamento.
        </p>
      </div>

      {clientSecret && (
        <AssinaturaCheckout
          clientSecret={clientSecret}
          onClose={() => setClientSecret(null)}
          onSucesso={() => {
            track("assinatura_concluida");
            setClientSecret(null);
            toastSucesso("Pagamento confirmado! Bem-vinda à Pólia.");
            queryClient.invalidateQueries({ queryKey: ["assinatura-status"] });
            navigate({ to: "/painel" });
          }}
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
}) {
  const realcado = destaque || foco;
  return (
    <div
      className={`flex flex-col rounded-2xl border p-6 ${
        realcado ? "border-[var(--secondary)] bg-white" : "border-[var(--line)] bg-white"
      }`}
    >
      {realcado && (
        <span className="mb-2 inline-block w-fit rounded bg-[var(--secondary)] px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[1px] text-[var(--secondary-ink)]">
          {destaque ? "Melhor valor" : "Escolhido"}
        </span>
      )}
      <p className="font-sans text-[13px] font-semibold uppercase tracking-[1px] text-[var(--ink-soft)]">
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
      <button
        type="button"
        onClick={onAssinar}
        disabled={desabilitado}
        className="mt-5 w-full rounded-xl bg-[var(--secondary)] px-4 py-3 font-sans text-[14px] font-semibold text-[var(--secondary-ink)] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {carregando ? "Preparando..." : `Assinar o ${titulo}`}
      </button>
    </div>
  );
}
