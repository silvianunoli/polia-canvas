import { useQuery } from "@tanstack/react-query";
import { assinaturasPagasFundadora } from "@/lib/fundadora.functions";
import { textoFundadora } from "@/lib/fundadora";

/**
 * Aviso do preço de fundadora, em cima dos planos pagos (/assinar e /planos).
 * Some sozinho depois do prazo ou com as vagas esgotadas. Sem a contagem (leitura
 * falhou) não aparece: prometer vaga sem saber quantas restam seria chute.
 */
export function BlocoFundadora({ className = "" }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ["fundadora-pagas"],
    queryFn: () => assinaturasPagasFundadora(),
    staleTime: 5 * 60_000,
  });
  if (data?.pagas == null) return null;
  const t = textoFundadora(data.pagas);
  if (!t) return null;

  return (
    <div
      className={`rounded-xl border border-[var(--line)] bg-[var(--surface-pink)] px-5 py-4 text-left ${className}`}
    >
      <p className="font-accent text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink)]">
        {t.rotulo}
      </p>
      <p className="mt-1 text-[14px] leading-snug text-[var(--ink)]">{t.texto}</p>
      <p className="mt-1 text-[13px] font-medium text-[var(--ink-soft)]">{t.vagas}</p>
    </div>
  );
}
