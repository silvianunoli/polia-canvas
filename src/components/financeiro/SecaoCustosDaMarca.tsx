import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Campo } from "@/components/ui/Campo";
import { BTN_ACAO } from "@/lib/botoes";
import { toastSucesso } from "@/lib/toast";
import { somarCustosFixos } from "@/lib/custosFixos.functions";
import { BlocoCustosFixos, type DetalheFixos } from "@/components/produtos/BlocoCustosFixos";
import { useDadosDaCalculadora } from "@/components/produtos/useDadosDaCalculadora";
import {
  fmt,
  normalizarDigitado,
  num,
  numeroParaCampo,
  numInvalido,
  numPos,
} from "@/components/produtos/tipos";
import {
  CHAVE_CUSTOS_MARCA,
  salvarCustosMarca,
  useCustosMarca,
  useSugestaoPecasMes,
} from "./custosMarcaDados";

const INPUT =
  "w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

/**
 * Aba "Custos da marca" do Financeiro (ONE-258, 24/11/2026, pedido da Sil:
 * "esse cadastro deve ser feito no financeiro, uma única vez"). A Calculadora
 * do cadastro de produto lê daqui e não pergunta mais esses números.
 */
export function SecaoCustosDaMarca({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const custosQuery = useCustosMarca(userId);
  const sugestaoQuery = useSugestaoPecasMes(userId);
  const dados = useDadosDaCalculadora(userId);

  const [carregou, setCarregou] = useState(false);
  const [fixosTotal, setFixosTotal] = useState("");
  const [fixosDetalhado, setFixosDetalhado] = useState(false);
  const [fixosDetalhe, setFixosDetalhe] = useState<DetalheFixos>({});
  const [proLabore, setProLabore] = useState("");
  const [pecasMes, setPecasMes] = useState("");
  const [impostoPct, setImpostoPct] = useState("");
  const [taxaPct, setTaxaPct] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Os campos nascem do que está salvo, uma vez (sem apagar o que ela digita).
  useEffect(() => {
    const c = custosQuery.data;
    if (!c || carregou) return;
    const temDetalhe = Object.keys(c.fixosDetalhe).length > 0;
    setFixosDetalhado(temDetalhe);
    setFixosDetalhe(c.fixosDetalhe as DetalheFixos);
    setFixosTotal(c.fixosMes > 0 ? numeroParaCampo(c.fixosMes) : "");
    setProLabore(c.proLabore > 0 ? numeroParaCampo(c.proLabore) : "");
    setPecasMes(c.pecasMes ? String(c.pecasMes) : "");
    setImpostoPct(c.impostoPct > 0 ? numeroParaCampo(c.impostoPct) : "");
    setTaxaPct(c.taxaRecebimentoPct > 0 ? numeroParaCampo(c.taxaRecebimentoPct) : "");
    setCarregou(true);
  }, [custosQuery.data, carregou]);

  const fixosMes = fixosDetalhado ? somarCustosFixos(fixosDetalhe) : numPos(fixosTotal);
  const pecas = Math.round(numPos(pecasMes));
  const pecasInvalidas = pecasMes.trim() !== "" && !(pecas >= 1);
  const temErro =
    [fixosTotal, proLabore, pecasMes, impostoPct, taxaPct].some((s) => numInvalido(s)) ||
    Object.values(fixosDetalhe).some((s) => numInvalido(s ?? "")) ||
    pecasInvalidas ||
    numPos(impostoPct) >= 100 ||
    numPos(taxaPct) >= 100;
  const rateio = pecas >= 1 ? (fixosMes + numPos(proLabore)) / pecas : null;

  const salvar = async () => {
    if (temErro || salvando) return;
    setSalvando(true);
    setErro(null);
    const detalheLimpo: Record<string, string> = {};
    if (fixosDetalhado) {
      for (const [k, v] of Object.entries(fixosDetalhe)) if (v && v.trim()) detalheLimpo[k] = v;
    }
    const falha = await salvarCustosMarca(userId, {
      fixosMes,
      fixosDetalhe: detalheLimpo,
      proLabore: numPos(proLabore),
      pecasMes: pecas >= 1 ? pecas : null,
      impostoPct: numPos(impostoPct),
      taxaRecebimentoPct: numPos(taxaPct),
    });
    setSalvando(false);
    if (falha) {
      setErro(falha);
      return;
    }
    void qc.invalidateQueries({ queryKey: [CHAVE_CUSTOS_MARCA, userId] });
    // A Projeção lê o mesmo pró-labore.
    void qc.invalidateQueries({ queryKey: ["projecao"] });
    toastSucesso("Custos da marca salvos. A Calculadora já usa esses números.");
  };

  if (custosQuery.isLoading) {
    return <p className="mt-6 text-[14px] text-[var(--muted)]">Carregando os custos da marca...</p>;
  }
  if (custosQuery.isError) {
    return (
      <div role="alert" className="mt-6 space-y-2">
        <p className="text-[14px] text-[var(--danger)]">
          A Pólia One não conseguiu ler os custos da marca agora.
        </p>
        <button
          type="button"
          onClick={() => void custosQuery.refetch()}
          className="inline-flex min-h-11 items-center text-[14px] font-medium text-[var(--secondary-text)] hover:underline"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div id="custos-da-marca" className="mt-6 max-w-[720px] space-y-6">
      <p className="text-[14px] text-[var(--ink-soft)]">
        O que a marca gasta todo mês e não é de uma peça só. Preenche uma vez e muda quando a vida
        mudar: a Calculadora de preço usa esses números em todo produto.
      </p>

      <section className="space-y-4 rounded-xl border border-[var(--line)] bg-white p-5">
        <h2 className="font-cabinet text-[18px] tracking-[-0.02em] text-[var(--ink)]">
          Custos fixos do mês
        </h2>
        <BlocoCustosFixos
          total={fixosTotal}
          onTotal={setFixosTotal}
          detalhado={fixosDetalhado}
          onDetalhado={setFixosDetalhado}
          detalhe={fixosDetalhe}
          onDetalhe={setFixosDetalhe}
          doFinanceiro={dados.fixosDoFinanceiro}
          reservaEquipamentos={dados.reservaEquipamentos}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 rounded-xl border border-[var(--line)] bg-white p-5 sm:grid-cols-2">
        <h2 className="font-cabinet text-[18px] tracking-[-0.02em] text-[var(--ink)] sm:col-span-2">
          Salário e vendas
        </h2>
        <Campo
          label="Pró-labore (seu salário) (R$)"
          hint="Quanto quer tirar pra você por mês. É o mesmo da Projeção: mudar aqui muda lá."
          error={numInvalido(proLabore) ? "Coloque um número." : undefined}
        >
          <input
            type="text"
            inputMode="decimal"
            value={proLabore}
            onChange={(e) => setProLabore(normalizarDigitado(e.target.value))}
            className={INPUT}
            placeholder="0"
          />
        </Campo>
        <Campo
          label="Peças vendidas por mês"
          hint="Somando todos os produtos. É esse número que divide os custos fixos e o salário entre as peças."
          error={
            numInvalido(pecasMes) || pecasInvalidas ? "Coloque um número de 1 pra cima." : undefined
          }
        >
          <input
            type="text"
            inputMode="numeric"
            value={pecasMes}
            onChange={(e) => setPecasMes(normalizarDigitado(e.target.value))}
            className={INPUT}
            placeholder="ex: 120"
          />
        </Campo>
        {sugestaoQuery.data != null && (
          <p className="text-[12.5px] text-[var(--muted)] sm:col-span-2">
            Nas vendas dos últimos 3 meses, a marca vendeu em média {sugestaoQuery.data}{" "}
            {sugestaoQuery.data === 1 ? "peça" : "peças"} por mês.{" "}
            {String(sugestaoQuery.data) !== pecasMes.trim() && (
              <button
                type="button"
                onClick={() => setPecasMes(String(sugestaoQuery.data))}
                className="inline-flex min-h-11 items-center font-medium text-[var(--secondary-text)] hover:underline"
              >
                Usar {sugestaoQuery.data}
              </button>
            )}
          </p>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 rounded-xl border border-[var(--line)] bg-white p-5 sm:grid-cols-2">
        <h2 className="font-cabinet text-[18px] tracking-[-0.02em] text-[var(--ink)] sm:col-span-2">
          Sobre cada venda (%)
        </h2>
        <Campo
          label="Imposto sobre a venda (%)"
          hint="No MEI, deixe 0: o DAS é fixo e entra nos custos fixos, em Contador e imposto fixo. No Simples, a alíquota da faixa da marca."
          error={
            numInvalido(impostoPct) || numPos(impostoPct) >= 100
              ? "Coloque um número abaixo de 100."
              : undefined
          }
        >
          <input
            type="text"
            inputMode="decimal"
            value={impostoPct}
            onChange={(e) => setImpostoPct(normalizarDigitado(e.target.value))}
            className={INPUT}
            placeholder="0"
          />
        </Campo>
        <Campo
          label="Taxa de recebimento (%)"
          hint="O que a maquininha, o Pix ou o link de pagamento ficam de cada venda direta. A taxa de cada marketplace fica em Marketplaces."
          error={
            numInvalido(taxaPct) || numPos(taxaPct) >= 100
              ? "Coloque um número abaixo de 100."
              : undefined
          }
        >
          <input
            type="text"
            inputMode="decimal"
            value={taxaPct}
            onChange={(e) => setTaxaPct(normalizarDigitado(e.target.value))}
            className={INPUT}
            placeholder="0"
          />
        </Campo>
      </section>

      <div className="rounded-xl bg-[var(--surface)] p-4 text-[13px] text-[var(--ink-soft)]">
        {rateio != null
          ? `Cada peça carrega ${fmt(Math.round(rateio * 100) / 100)} dos custos da marca: ${fmt(fixosMes)} de fixos${num(proLabore) > 0 ? ` e ${fmt(numPos(proLabore))} de salário` : ""}, divididos por ${pecas} ${pecas === 1 ? "peça" : "peças"}.`
          : "Com as peças vendidas por mês preenchidas, a Pólia One mostra quanto dos custos da marca cada peça carrega."}
      </div>

      {erro && (
        <p role="alert" className="text-[13px] text-[var(--danger)]">
          {erro}
        </p>
      )}
      <button
        type="button"
        onClick={() => void salvar()}
        disabled={salvando || temErro}
        className={BTN_ACAO}
      >
        {salvando ? "Salvando..." : "Salvar os custos da marca"}
      </button>
    </div>
  );
}
