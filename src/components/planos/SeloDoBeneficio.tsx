import { seloDoBeneficio, type Beneficio } from "@/lib/planos";

/**
 * Selo ao lado do item da lista de planos. "Novo" em pêssego: o amarelo é um
 * por tela (DESIGN.md) e o turquesa já é o selo "Melhor valor"/"Pra quem já
 * vende" do mesmo cartão. "Em breve" fica neutro, porque ainda não é recurso.
 */
export function SeloDoBeneficio({ beneficio }: { beneficio: Beneficio }) {
  const selo = seloDoBeneficio(beneficio);
  if (!selo) return null;
  return (
    <span
      className={`font-accent ml-2 inline-block whitespace-nowrap rounded-full px-2 py-0.5 align-[2px] text-[10px] font-bold uppercase leading-[1.4] tracking-[0.06em] ${
        selo === "novo"
          ? "bg-[var(--accent)] text-[var(--ink)]"
          : "border border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]"
      }`}
    >
      {selo === "novo" ? "Novo" : "Em breve"}
    </span>
  );
}
