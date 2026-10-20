import { Link } from "@tanstack/react-router";
import { useTestePro } from "@/hooks/useTestePro";
import { textoFaixaTeste } from "@/lib/testePro";
import { track } from "@/lib/analytics";

/**
 * Faixa fina no topo da área logada durante o teste de 7 dias do Pro (e por 3
 * dias depois que ele acaba, pra quem voltou pro Grátis). Sem fechar: é o único
 * lugar que diz que o Pro é temporário, e sumir com ela esconderia isso.
 */
export function FaixaTestePro({ pathname }: { pathname: string }) {
  const { data: teste } = useTestePro();
  const faixa = textoFaixaTeste(teste ?? null);
  // No checkout a faixa só repetiria a tela.
  if (!faixa || pathname.startsWith("/assinar")) return null;

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--line)] px-4 py-3 text-[13px] text-[var(--ink)] sm:px-8 ${
        faixa.urgente ? "bg-[var(--surface-pink)]" : "bg-[var(--surface)]"
      }`}
    >
      <p className="min-w-0 flex-1">{faixa.texto}</p>
      <Link
        to="/assinar"
        search={{ plano: "projete" }}
        onClick={() => track("teste_pro_faixa_cta", { urgente: faixa.urgente })}
        className="shrink-0 font-medium text-[var(--secondary-text)] underline underline-offset-2 hover:no-underline"
      >
        {faixa.cta}
      </Link>
    </div>
  );
}
