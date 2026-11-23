import { useMemo, useState } from "react";
import { Download, Scale } from "lucide-react";
import { Vazio } from "@/components/layout/Vazio";
import { BlockError } from "@/components/ui/BlockError";
import { BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { formatarReais } from "@/lib/formatarReais";
import { baixarCsv, gerarCsv } from "@/lib/csv";
import { track } from "@/lib/analytics";
import {
  CABECALHO_PLANILHA,
  fechamentoDoMes,
  lancamentosDoMes,
  linhasDaPlanilha,
  ROTULO_FORMA,
  type ChaveForma,
  type LancamentoDoFechamento,
} from "@/lib/fechamentoDoMes";
import { useExtrasDoFechamento } from "./fechamentoDados";

const fmt = (v: number) => formatarReais(v, { sempreCentavos: true });

type LancamentoComOrigem = LancamentoDoFechamento & { id_externo?: string | null };

/**
 * Fechamento do mês (ONE-207 Fase 3): a conciliação da planilha da Sil.
 * Quanto entrou por forma de recebimento, o dia a dia, as taxas e os juros, e
 * a planilha do mês pra baixar. Lê os lançamentos que o Financeiro já tem.
 */
export function SecaoFechamento({
  userId,
  hoje,
  lancamentos,
}: {
  userId: string;
  hoje: string;
  lancamentos: readonly LancamentoComOrigem[];
}) {
  const mesAtual = hoje.slice(0, 7);
  const [anoMes, setAnoMes] = useState(mesAtual);
  const [verDias, setVerDias] = useState(false);

  const doMes = useMemo(() => lancamentosDoMes(lancamentos, anoMes), [lancamentos, anoMes]);
  const idsDeVenda = useMemo(
    () => doMes.filter((l) => l.id_externo?.startsWith("venda:")).map((l) => l.id),
    [doMes],
  );
  const assinatura = useMemo(() => doMes.map((l) => l.id).join(","), [doMes]);
  const extras = useExtrasDoFechamento(userId, anoMes, idsDeVenda, assinatura);

  const fechamento = useMemo(
    () => (extras.data ? fechamentoDoMes(lancamentos, anoMes, extras.data) : null),
    [lancamentos, anoMes, extras.data],
  );
  const formasDoDia = useMemo<ChaveForma[]>(
    () => fechamento?.porForma.map((f) => f.chave) ?? [],
    [fechamento],
  );

  const nomeDoMes = useMemo(() => {
    const [a, m] = anoMes.split("-").map(Number);
    if (!a || !m) return "";
    return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [anoMes]);

  const baixar = () => {
    if (!extras.data) return;
    baixarCsv(
      `fechamento-${anoMes}.csv`,
      gerarCsv(CABECALHO_PLANILHA, linhasDaPlanilha(lancamentos, anoMes, extras.data)),
    );
    track("fechamento_planilha_baixada", { linhas: doMes.length, mes_atual: anoMes === mesAtual });
  };

  const diferencas =
    fechamento &&
    [
      fechamento.taxasNoRecebimento > 0 &&
        `Taxas e descontos no recebimento: ${fmt(fechamento.taxasNoRecebimento)}`,
      fechamento.jurosPagos > 0 && `Juros e multas pagos: ${fmt(fechamento.jurosPagos)}`,
      fechamento.descontosObtidos > 0 &&
        `Descontos nas contas pagas: ${fmt(fechamento.descontosObtidos)}`,
    ].filter(Boolean);

  return (
    <section id="fechamento" className="mt-12 scroll-mt-24" aria-labelledby="titulo-fechamento">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-fechamento" className="text-[20px] leading-tight text-[var(--ink)]">
            Fechamento do mês
          </h2>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Quanto entrou por forma de recebimento, pra bater com o banco e a maquininha.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
            Mês
            <input
              type="month"
              value={anoMes}
              max={mesAtual}
              onChange={(e) => e.target.value && setAnoMes(e.target.value)}
              className="min-h-11 rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={baixar}
            disabled={!extras.data || doMes.length === 0}
            className={BTN_ACAO_CONTORNO}
          >
            <Download size={14} aria-hidden="true" />
            Baixar planilha do mês
          </button>
        </div>
      </div>

      <div className="mt-4">
        {extras.isError ? (
          <div role="alert">
            <BlockError
              message="A Pólia One não conseguiu montar o fechamento agora. Nada foi perdido, é só a leitura que falhou."
              onRetry={() => void extras.refetch()}
            />
          </div>
        ) : !fechamento ? (
          <div
            className="h-24 animate-pulse rounded-xl border border-[var(--line)] bg-white motion-reduce:animate-none"
            aria-busy="true"
            aria-label="Montando o fechamento do mês"
          />
        ) : doMes.length === 0 ? (
          <Vazio
            icone={Scale}
            denso
            titulo={`Nada lançado em ${nomeDoMes}.`}
            texto="O fechamento aparece assim que o mês tiver entradas ou saídas no histórico."
          />
        ) : (
          <>
            <BlocoPorForma
              titulo="Entradas por forma de recebimento"
              itens={fechamento.porForma}
              unidade={["entrada", "entradas"]}
              vazio={`Nenhuma entrada em ${nomeDoMes}.`}
            />
            <BlocoPorForma
              titulo="Saídas por forma de pagamento"
              itens={fechamento.saidasPorForma}
              unidade={["saída", "saídas"]}
              vazio={`Nenhuma saída em ${nomeDoMes}.`}
            />

            <p className="mt-4 text-[13px] text-[var(--ink-soft)]">
              Entrou {fmt(fechamento.entradas)} e saiu {fmt(fechamento.saidas)} em {nomeDoMes}.
              {[...fechamento.porForma, ...fechamento.saidasPorForma].some(
                (f) => f.chave === "nao_informada",
              ) &&
                " Lançamento sem forma fica em “Não informada”: dá pra escolher a forma editando o lançamento no histórico."}
            </p>
            {diferencas && diferencas.length > 0 && (
              <p className="mt-1 text-[13px] text-[var(--muted)]">{diferencas.join(" · ")}</p>
            )}

            <button
              type="button"
              onClick={() => setVerDias((v) => !v)}
              aria-expanded={verDias}
              className="mt-2 inline-flex min-h-11 items-center text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
            >
              {verDias ? "Esconder o dia a dia" : "Ver o dia a dia"}
            </button>

            {verDias && (
              <div className="mt-1 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
                <table className="w-full min-w-[480px] text-[13px]">
                  <caption className="sr-only">
                    Entradas por forma de recebimento e saídas, dia a dia, em {nomeDoMes}
                  </caption>
                  <thead>
                    <tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
                      <th scope="col" className="px-3 py-2 font-normal">
                        Dia
                      </th>
                      {formasDoDia.map((f) => (
                        <th key={f} scope="col" className="px-3 py-2 text-right font-normal">
                          {ROTULO_FORMA[f]}
                        </th>
                      ))}
                      <th scope="col" className="px-3 py-2 text-right font-normal">
                        Entradas
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-normal">
                        Saídas
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums text-[var(--ink-soft)]">
                    {fechamento.porDia.map((d) => (
                      <tr key={d.data} className="border-b border-[var(--line)] last:border-0">
                        <th scope="row" className="px-3 py-2 text-left font-normal">
                          {d.data.slice(8, 10)}/{d.data.slice(5, 7)}
                        </th>
                        {formasDoDia.map((f) => (
                          <td key={f} className="px-3 py-2 text-right">
                            {d.porForma[f] ? fmt(d.porForma[f]!) : ""}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right text-[var(--ink)]">
                          {d.entradas ? fmt(d.entradas) : ""}
                        </td>
                        <td className="px-3 py-2 text-right">{d.saidas ? fmt(d.saidas) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function BlocoPorForma({
  titulo,
  itens,
  unidade,
  vazio,
}: {
  titulo: string;
  itens: { chave: ChaveForma; total: number; quantidade: number }[];
  unidade: [string, string];
  vazio: string;
}) {
  return (
    <div className="mt-4 first:mt-0">
      <h3 className="text-[13px] font-medium text-[var(--ink-soft)]">{titulo}</h3>
      {itens.length > 0 ? (
        <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {itens.map((f) => (
            <li key={f.chave} className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-[10px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                {ROTULO_FORMA[f.chave]}
              </p>
              <p className="font-cabinet mt-1 text-[22px] leading-none tabular-nums text-[var(--ink)]">
                {fmt(f.total)}
              </p>
              <p className="mt-1 text-[12px] text-[var(--muted)]">
                {f.quantidade} {f.quantidade === 1 ? unidade[0] : unidade[1]}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[14px] text-[var(--muted)]">{vazio}</p>
      )}
    </div>
  );
}
