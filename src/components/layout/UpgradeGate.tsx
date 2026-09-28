import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { BTN_ACAO } from "@/lib/botoes";

interface UpgradeGateProps {
  eyebrow: string;
  titulo: string;
  /** Descreve o que o recurso faz, pra quem ainda não assinou o Pro. */
  feature: string;
  /** Rota de origem, repassada pra `/upgrade` (mostra o ganho concreto dessa tela). */
  rota: string;
}

/**
 * Tela de bloqueio "é do Pro" — bloco copiado idêntico em projecao.tsx,
 * plano-conteudo.tsx e raiox.tsx, extraído numa rodada de limpeza de
 * duplicação (set/2026).
 */
export function UpgradeGate({ eyebrow, titulo, feature, rota }: UpgradeGateProps) {
  return (
    <PaginaLogada eyebrow={eyebrow} titulo={titulo}>
      <div className="rounded-xl border border-[var(--line)] bg-white p-6 md:p-8">
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface)]">
          <Lock size={20} className="text-[var(--ink-soft)]" aria-hidden="true" />
        </span>
        <p className="max-w-[52ch] text-[15px] leading-relaxed text-[var(--ink-soft)]">{feature}</p>
        <Link to="/upgrade" search={{ rota, tier: "projete" }} className={`${BTN_ACAO} mt-6`}>
          Conhecer o Pro
        </Link>
      </div>
    </PaginaLogada>
  );
}
