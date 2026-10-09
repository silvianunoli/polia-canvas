import { useId } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Campo } from "@/components/ui/Campo";
import {
  ITENS_CUSTO_FIXO,
  somarCustosFixos,
  type ChaveCustoFixo,
} from "@/lib/custosFixos.functions";
import { fmt, num } from "./tipos";

export type DetalheFixos = Partial<Record<ChaveCustoFixo, string>>;

/**
 * Custos fixos do mês, usado pelos perfis Produto e Serviço da calculadora
 * (09/10/2026). Fechado, é um campo de total, como sempre foi. "Detalhar"
 * abre um campo por item e o total vira a soma deles. Os valores moram na
 * Calculadora (estado compartilhado entre as abas, igual ao valor-hora).
 */
export function BlocoCustosFixos({
  total,
  onTotal,
  detalhado,
  onDetalhado,
  detalhe,
  onDetalhe,
  doFinanceiro,
}: {
  total: string;
  onTotal: (v: string) => void;
  detalhado: boolean;
  onDetalhado: (v: boolean) => void;
  detalhe: DetalheFixos;
  onDetalhe: (d: DetalheFixos) => void;
  /** Saídas fixas do mês no Financeiro, por item. null = ainda carregando ou sem lançamento. */
  doFinanceiro: Record<ChaveCustoFixo, number> | null;
}) {
  const painelId = useId();
  const soma = somarCustosFixos(detalhe);
  const totalFinanceiro = doFinanceiro
    ? ITENS_CUSTO_FIXO.reduce((acc, i) => acc + doFinanceiro[i.chave], 0)
    : 0;

  // Ao abrir, um total digitado antes que não bate com o detalhe vai pra
  // "Outros": o número dela não some. Ao fechar, o total vira a soma.
  const abrir = () => {
    if (Math.abs(somarCustosFixos(detalhe) - num(total)) >= 0.01) {
      onDetalhe(num(total) > 0 ? { outros: total } : {});
    }
    onDetalhado(true);
  };
  const fechar = () => {
    onTotal(soma > 0 ? String(Math.round(soma * 100) / 100) : "");
    onDetalhado(false);
  };

  const puxarDoFinanceiro = () => {
    if (!doFinanceiro) return;
    const novo: DetalheFixos = {};
    for (const i of ITENS_CUSTO_FIXO) {
      const v = doFinanceiro[i.chave];
      if (v > 0) novo[i.chave] = String(Math.round(v * 100) / 100);
    }
    onDetalhe(novo);
    onDetalhado(true);
  };

  return (
    <div>
      {!detalhado ? (
        <Campo
          label="Custos fixos do mês (R$)"
          hint="Aluguel, internet, ferramentas, contador: o que sai todo mês, venda ou não venda."
        >
          <input
            type="number"
            inputMode="decimal"
            value={total}
            onChange={(e) => onTotal(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            placeholder="0"
          />
        </Campo>
      ) : (
        <p className="flex items-baseline justify-between gap-4 text-[13px] text-[var(--ink-soft)]">
          <span>Custos fixos do mês</span>
          <span className="font-medium text-[var(--ink)]" aria-live="polite">
            {fmt(soma)}
          </span>
        </p>
      )}

      <div className="mt-1 flex flex-wrap gap-x-4">
        <button
          type="button"
          onClick={detalhado ? fechar : abrir}
          aria-expanded={detalhado}
          aria-controls={painelId}
          className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
        >
          {detalhado ? (
            <ChevronUp size={14} aria-hidden="true" />
          ) : (
            <ChevronDown size={14} aria-hidden="true" />
          )}
          {detalhado ? "Recolher" : "Detalhar os custos fixos"}
        </button>
        {totalFinanceiro > 0 && (
          <button
            type="button"
            onClick={puxarDoFinanceiro}
            className="inline-flex min-h-11 items-center text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
          >
            Puxar do Financeiro deste mês ({fmt(totalFinanceiro)})
          </button>
        )}
      </div>

      {detalhado && (
        <div
          id={painelId}
          className="mt-2 grid grid-cols-1 gap-4 rounded-xl border border-[var(--line)] bg-white p-4 sm:grid-cols-2"
        >
          {ITENS_CUSTO_FIXO.map((i) => (
            <Campo key={i.chave} label={`${i.categoria} (R$)`} hint={i.dica}>
              <input
                type="number"
                inputMode="decimal"
                value={detalhe[i.chave] ?? ""}
                onChange={(e) => onDetalhe({ ...detalhe, [i.chave]: e.target.value })}
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
                placeholder="0"
              />
            </Campo>
          ))}
        </div>
      )}
    </div>
  );
}
