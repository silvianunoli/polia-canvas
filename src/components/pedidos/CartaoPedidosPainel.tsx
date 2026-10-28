import { useMemo } from "react";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { fmt } from "@/components/produtos/tipos";
import { linhaDoResumo, resumoDoDia } from "@/lib/pedidos";
import { usePedidos } from "./dados";

/**
 * Cartão do Painel (GRW-93): entregas de hoje e de amanhã, atrasados e quanto
 * entra na semana. Some sem pedido aberto, pra não somar mais um cartão vazio
 * na primeira tela. `hoje` vem do Painel, já no navegador.
 */
export function CartaoPedidosPainel({ userId, hoje }: { userId: string; hoje: string }) {
  const pedidosQuery = usePedidos(userId, hoje);
  const resumo = useMemo(
    () => resumoDoDia(pedidosQuery.data ?? [], hoje),
    [pedidosQuery.data, hoje],
  );

  if (pedidosQuery.isLoading || pedidosQuery.isError || resumo.abertos === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <p className="text-[11px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
        {/* "Entregas", não "Pedidos": o Painel já tem o "Pedidos · mês" (vendas do mês). */}
        Entregas
      </p>
      <p className="font-cabinet mt-1 text-[24px] leading-tight text-[var(--ink)]">
        {linhaDoResumo(resumo)}
      </p>
      <p className="mt-2 text-[13px] text-[var(--muted)]">
        {resumo.entraNaSemana > 0 && <>Esta semana entram {fmt(resumo.entraNaSemana)} · </>}
        <LinkInterno
          href="/pedidos"
          className="font-medium text-[var(--secondary-text)] hover:underline"
        >
          Abrir o quadro
        </LinkInterno>
      </p>
    </div>
  );
}
