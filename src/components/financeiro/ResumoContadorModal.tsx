import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import {
  montarResumoContador,
  linhasCsvResumoContador,
  type LancamentoResumo,
} from "@/lib/resumoContador.functions";
import { gerarResumoContadorPdf } from "@/lib/gerarResumoContadorPdf";
import { gerarCsv, baixarCsv } from "@/lib/csv";
import { track } from "@/lib/analytics";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function opcoesDeMes(): { mes: number; ano: number; label: string }[] {
  const hoje = new Date();
  const opcoes = [];
  for (let i = 0; i < 13; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    opcoes.push({
      mes: d.getMonth() + 1,
      ano: d.getFullYear(),
      label: `${MESES[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return opcoes;
}

export function ResumoContadorModal({
  lancamentos,
  razaoSocial,
  cnpj,
  onClose,
  onEditarLancamento,
  onIrParaFinanceiro,
}: {
  lancamentos: LancamentoResumo[];
  razaoSocial: string | null;
  cnpj: string | null;
  onClose: () => void;
  onEditarLancamento: (id: string) => void;
  onIrParaFinanceiro: () => void;
}) {
  const opcoes = useMemo(opcoesDeMes, []);
  const [selecionado, setSelecionado] = useState(opcoes[0]);
  const [erro, setErro] = useState<string | null>(null);

  const resumo = useMemo(
    () => montarResumoContador(lancamentos, selecionado.mes, selecionado.ano),
    [lancamentos, selecionado],
  );

  const vazio =
    resumo.receitas.itens.length === 0 &&
    resumo.despesas.itens.length === 0 &&
    resumo.proLabore.itens.length === 0;
  const dadosEmpresaFaltando = !razaoSocial?.trim() || !cnpj?.trim();

  const baixarPdf = () => {
    setErro(null);
    try {
      gerarResumoContadorPdf({
        razaoSocial: razaoSocial?.trim() || null,
        cnpj: cnpj?.trim() || null,
        mes: selecionado.mes,
        ano: selecionado.ano,
        resumo,
      });
      track("resumo_contador_baixado", {
        formato: "pdf",
        mes: selecionado.mes,
        ano: selecionado.ano,
      });
    } catch {
      setErro("Não conseguimos gerar o arquivo agora. Tenta de novo.");
    }
  };

  const baixarCsvResumo = () => {
    setErro(null);
    try {
      const cabecalho = ["Data", "Tipo", "Categoria", "Descrição", "Valor"];
      baixarCsv(
        `resumo-contador-polia-${String(selecionado.mes).padStart(2, "0")}-${selecionado.ano}.csv`,
        gerarCsv(cabecalho, linhasCsvResumoContador(resumo)),
      );
      track("resumo_contador_baixado", {
        formato: "csv",
        mes: selecionado.mes,
        ano: selecionado.ano,
      });
    } catch {
      setErro("Não conseguimos gerar o arquivo agora. Tenta de novo.");
    }
  };

  return (
    <div
      className="polia-v3 fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/50 px-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Resumo do mês pro contador"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-[22px] text-[var(--ink)]">Resumo pro contador</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <label className="mb-1 block text-[12px] text-[var(--muted)]">Mês</label>
        <select
          value={`${selecionado.mes}-${selecionado.ano}`}
          onChange={(e) => {
            const [mes, ano] = e.target.value.split("-").map(Number);
            const nova = opcoes.find((o) => o.mes === mes && o.ano === ano);
            if (nova) setSelecionado(nova);
          }}
          className="mb-5 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
        >
          {opcoes.map((o) => (
            <option key={`${o.mes}-${o.ano}`} value={`${o.mes}-${o.ano}`}>
              {o.label}
            </option>
          ))}
        </select>

        {vazio ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] bg-white px-5 py-10 text-center">
            <p className="mx-auto max-w-[360px] text-[14px] leading-relaxed text-[var(--muted)]">
              Esse mês ainda não tem receita nem despesa registrada. Lance o que entrou e saiu e o
              resumo se monta.
            </p>
            <button
              type="button"
              onClick={onIrParaFinanceiro}
              className="mt-3 text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
            >
              Lançar no Financeiro →
            </button>
          </div>
        ) : (
          <>
            {dadosEmpresaFaltando && (
              <div className="mb-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--ink-soft)]">
                Falta o nome e o CNPJ da empresa no resumo.{" "}
                <Link
                  to="/configuracoes"
                  className="font-medium text-[var(--secondary-text)] no-underline"
                >
                  Completar nas Configurações
                </Link>
              </div>
            )}

            <div className="rounded-xl border border-[var(--line)] p-4">
              {(razaoSocial?.trim() || cnpj?.trim()) && (
                <div className="mb-3 border-b border-[var(--line)] pb-3 text-[13px] text-[var(--ink-soft)]">
                  {razaoSocial?.trim() && <p>{razaoSocial}</p>}
                  {cnpj?.trim() && <p>CNPJ {cnpj}</p>}
                </div>
              )}

              <SecaoLista
                titulo="Receitas"
                total={resumo.receitas.total}
                itens={resumo.receitas.itens.map((it) => ({
                  id: it.id,
                  esquerda: it.descricao?.trim() || "sem descrição",
                  valor: it.valor,
                }))}
                onClickItem={onEditarLancamento}
              />
              <SecaoLista
                titulo="Despesas"
                total={resumo.despesas.total}
                itens={resumo.despesas.porCategoria.map((c) => ({
                  id: c.categoria,
                  esquerda: c.categoria,
                  valor: c.total,
                }))}
              />
              <SecaoLista titulo="Pró-labore" total={resumo.proLabore.total} itens={[]} />

              <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3">
                <p className="text-[15px] font-medium text-[var(--ink)]">Resultado do mês</p>
                <p className="text-[15px] font-medium text-[var(--ink)]">
                  {moeda.format(resumo.resultado)}
                </p>
              </div>
            </div>

            <p className="mt-4 text-[11.5px] leading-relaxed text-[var(--muted)]">
              Resumo gerencial do que você registrou na Pólia. Não substitui as notas fiscais, as
              guias de imposto e os extratos bancários, que o seu contador também precisa.
            </p>

            {erro && (
              <p className="mt-3 text-[13px] text-[var(--danger)]" role="alert">
                {erro}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={baixarPdf}
                className="flex-1 rounded-xl bg-[var(--secondary)] px-4 py-2.5 font-medium text-[var(--secondary-ink)] hover:opacity-90"
              >
                {erro ? "Tentar de novo · PDF" : "Baixar PDF"}
              </button>
              <button
                type="button"
                onClick={baixarCsvResumo}
                className="flex-1 rounded-xl border border-[var(--line)] px-4 py-2.5 font-medium text-[var(--ink)] hover:bg-[var(--surface)]"
              >
                {erro ? "Tentar de novo · CSV" : "Baixar CSV"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SecaoLista({
  titulo,
  total,
  itens,
  onClickItem,
}: {
  titulo: string;
  total: number;
  itens: { id: string; esquerda: string; valor: number }[];
  onClickItem?: (id: string) => void;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-[var(--ink)]">{titulo}</p>
        <p className="text-[13px] font-medium text-[var(--ink)]">{moeda.format(total)}</p>
      </div>
      {itens.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {itens.map((it) =>
            onClickItem ? (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => onClickItem(it.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left text-[12.5px] text-[var(--muted)] hover:bg-[var(--surface)]"
                >
                  <span className="truncate">{it.esquerda}</span>
                  <span className="shrink-0">{moeda.format(it.valor)}</span>
                </button>
              </li>
            ) : (
              <li
                key={it.id}
                className="flex items-center justify-between gap-2 px-1 text-[12.5px] text-[var(--muted)]"
              >
                <span className="truncate">{it.esquerda}</span>
                <span className="shrink-0">{moeda.format(it.valor)}</span>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
