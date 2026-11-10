import { useQuery } from "@tanstack/react-query";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { statusRedesSociais } from "@/lib/redesSociais.functions";
import { CHAVE_STATUS_REDES } from "@/components/configuracoes/CardRedesSociais";

// Peças comuns das telas da Agenda das redes (ONE-155).

export const CHAVE_POSTS_REDES = "redes-posts";

/** Mesma leitura do card de Configurações: quem vê, quem usa e quais redes estão ligadas. */
export function useStatusRedes(userId: string | undefined) {
  return useQuery({
    queryKey: [CHAVE_STATUS_REDES, userId],
    enabled: !!userId,
    staleTime: 60 * 1000,
    queryFn: () => statusRedesSociais(),
  });
}

const FORMATO = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** "ter., 10/11, 14:30" no horário de Brasília. */
export function dataDoPost(iso: string | null): string {
  if (!iso) return "sem horário";
  return FORMATO.format(new Date(iso));
}

/**
 * O campo datetime-local devolve "2026-11-10T14:30" sem fuso. A dona pensa no
 * horário de Brasília, que é UTC-3 o ano todo desde 2019.
 */
export function deBrasiliaParaIso(valor: string): string {
  return `${valor}:00-03:00`;
}

export const CAIXA = "rounded-xl border border-[var(--line)] bg-white p-4 md:p-6";
export const ROTULO =
  "font-accent text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]";

/** Item de menu da Agenda: só aparece pra quem o servidor deixa ver (admin, até as revisões). */
export function useAgendaRedesVisivel(): boolean {
  const { user } = useSupabaseSession();
  return useStatusRedes(user?.id).data?.visivel === true;
}
