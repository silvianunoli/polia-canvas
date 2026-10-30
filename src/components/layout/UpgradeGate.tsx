import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { BTN_ACAO } from "@/lib/botoes";
import { tiersPagos, type TierPago } from "@/lib/planos";

interface UpgradeGateProps {
  eyebrow: string;
  titulo: string;
  /** Descreve o que o recurso faz, pra quem ainda não assinou o Pro. */
  feature: string;
  /** Rota de origem, repassada pra `/upgrade` (mostra o ganho concreto dessa tela). */
  rota: string;
  /** Plano que abre a tela. Pro por padrão; Raio-x e Projeção passam a ser Premium na virada. */
  tier?: TierPago;
}

/**
 * Tela de bloqueio "é do Pro" — bloco copiado idêntico em projecao.tsx,
 * plano-conteudo.tsx e raiox.tsx, extraído numa rodada de limpeza de
 * duplicação (set/2026).
 */
export function UpgradeGate({
  eyebrow,
  titulo,
  feature,
  rota,
  tier = "projete",
}: UpgradeGateProps) {
  return (
    <PaginaLogada eyebrow={eyebrow} titulo={titulo}>
      <div className="rounded-xl border border-[var(--line)] bg-white p-6 md:p-8">
        <SeloCadeado />
        <p className="max-w-[52ch] text-[15px] leading-relaxed text-[var(--ink-soft)]">{feature}</p>
        <Link to="/upgrade" search={{ rota, tier }} className={`${BTN_ACAO} mt-6`}>
          Conhecer o {tiersPagos()[tier].titulo}
        </Link>
      </div>
    </PaginaLogada>
  );
}

/** Cadeado em círculo das telas de bloqueio; a /upgrade usa o mesmo (UX-10). */
export function SeloCadeado({ className = "mb-4" }: { className?: string }) {
  return (
    <span
      className={`${className} flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface)]`}
    >
      <Lock size={20} className="text-[var(--ink-soft)]" aria-hidden="true" />
    </span>
  );
}
