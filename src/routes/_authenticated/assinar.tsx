import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toastErro, toastSucesso } from "@/lib/toast";
import { iniciarAssinatura, statusAssinatura } from "@/lib/stripe.functions";
import { AssinaturaCheckout } from "@/components/configuracoes/AssinaturaCheckout";
import { track } from "@/lib/analytics";

const VALOR_PLANO_MENSAL = 29;
const VALOR_PLANO_ANUAL = 290;

export const Route = createFileRoute("/_authenticated/assinar")({
  head: () => ({
    meta: [
      { title: "Assine a Pólia" },
      { name: "description", content: "Escolha seu plano e comece a usar a Pólia." },
    ],
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
  const assinaturaQuery = useQuery({
    queryKey: ["assinatura-status"],
    queryFn: () => statusAssinatura(),
  });

  const [planoIniciando, setPlanoIniciando] = useState<"mensal" | "anual" | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const assinar = async (plano: "mensal" | "anual") => {
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
      <div className="w-full max-w-[640px]">
        <p className="mb-2 text-center font-sans text-[10px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
          ÚLTIMO PASSO
        </p>
        <h1 className="mb-3 text-center font-fraunces text-[36px] leading-tight text-[var(--ink)]">
          Escolha seu plano
        </h1>
        <p className="mb-10 text-center font-fraunces italic text-[16px] text-[var(--ink-soft)]">
          seu negócio já está montado. assine pra abrir o painel e continuar.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <PlanoCard
            titulo="Mensal"
            preco={`R$ ${VALOR_PLANO_MENSAL}`}
            periodo="por mês"
            carregando={planoIniciando === "mensal"}
            desabilitado={planoIniciando !== null || assinaturaQuery.isLoading}
            onAssinar={() => assinar("mensal")}
          />
          <PlanoCard
            titulo="Anual"
            preco={`R$ ${VALOR_PLANO_ANUAL}`}
            periodo="por ano · 2 meses grátis"
            destaque
            carregando={planoIniciando === "anual"}
            desabilitado={planoIniciando !== null || assinaturaQuery.isLoading}
            onAssinar={() => assinar("anual")}
          />
        </div>

        <p className="mt-6 text-center font-sans text-[12px] text-[var(--muted)]">
          cancela quando quiser, direto em Configurações.
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
  destaque,
  carregando,
  desabilitado,
  onAssinar,
}: {
  titulo: string;
  preco: string;
  periodo: string;
  destaque?: boolean;
  carregando: boolean;
  desabilitado: boolean;
  onAssinar: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 ${
        destaque ? "border-[var(--secondary)] bg-white" : "border-[var(--line)] bg-white"
      }`}
    >
      {destaque && (
        <span className="mb-2 inline-block rounded bg-[var(--secondary)] px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[1px] text-[var(--secondary-ink)]">
          Melhor valor
        </span>
      )}
      <p className="font-sans text-[13px] font-semibold uppercase tracking-[1px] text-[var(--ink-soft)]">
        {titulo}
      </p>
      <p className="mt-1 font-fraunces text-[32px] leading-none text-[var(--ink)]">{preco}</p>
      <p className="mt-1 font-sans text-[12px] text-[var(--muted)]">{periodo}</p>
      <button
        type="button"
        onClick={onAssinar}
        disabled={desabilitado}
        className="mt-5 w-full rounded-xl bg-[var(--secondary)] px-4 py-3 font-sans text-[14px] font-semibold text-[var(--secondary-ink)] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {carregando ? "Preparando..." : "Assinar"}
      </button>
    </div>
  );
}
