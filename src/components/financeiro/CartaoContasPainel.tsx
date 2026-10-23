import { useMemo } from "react";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { formatarReais } from "@/lib/formatarReais";
import { frasePrazo, resumoContas } from "@/lib/contasPagar";
import { useContasPagar } from "./contasPagarDados";

const fmt = (v: number) => formatarReais(v, { sempreCentavos: true });

/**
 * Cartão do Painel (ONE-127): conta atrasada e o que vence nos próximos 7
 * dias. Some quando não há nada nesse prazo, pra não ocupar a primeira tela
 * com um cartão vazio.
 */
export function CartaoContasPainel({ userId, hoje }: { userId: string; hoje: string }) {
  // Só as a pagar interessam aqui; a data no futuro deixa as pagas de fora.
  const query = useContasPagar(userId, "9999-12-31");
  const resumo = useMemo(() => resumoContas(query.data ?? [], hoje), [query.data, hoje]);

  if (!hoje || query.isLoading || query.isError) return null;
  const { atrasadas, semana } = resumo;
  if (atrasadas.quantidade === 0 && semana.quantidade === 0) return null;

  // O rótulo diz o que o total soma: com atrasada no meio, não é só a semana.
  const rotulo =
    atrasadas.quantidade > 0 && semana.quantidade > 0
      ? "Contas a pagar · atrasadas e próximos 7 dias"
      : atrasadas.quantidade > 0
        ? "Contas a pagar · atrasadas"
        : "Contas a pagar · próximos 7 dias";

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <p className="text-[11px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
        {rotulo}
      </p>
      <p className="font-cabinet mt-1 text-[24px] leading-tight text-[var(--ink)]">
        {fmt(semana.total + atrasadas.total)} pra sair
      </p>
      <p className="mt-2 text-[13px] text-[var(--muted)]">
        {frasePrazo(resumo)} ·{" "}
        <LinkInterno
          href="/financeiro#contas-a-pagar"
          className="font-medium text-[var(--secondary-text)] hover:underline"
        >
          Ver contas
        </LinkInterno>
      </p>
    </div>
  );
}
