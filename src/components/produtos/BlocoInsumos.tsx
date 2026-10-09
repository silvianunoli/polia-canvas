import { useId, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";
import { Campo } from "@/components/ui/Campo";
import { custoNaPeca, maoDeObraPorPeca } from "@/lib/precificacao.functions";
import { fmt, num, numInvalido } from "./tipos";
import { itemParaConta, totalDosInsumos, type ItemInsumo } from "./insumos";

const round2 = (v: number) => Math.round(v * 100) / 100;

const INPUT =
  "w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

const BOTAO_LINK =
  "inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-[var(--secondary-text)] hover:underline";

function CampoTotal({
  label,
  dica,
  value,
  onChange,
}: {
  label: string;
  dica?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Campo label={label} hint={dica}>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT}
        placeholder="0"
      />
    </Campo>
  );
}

function TotalCalculado({ label, valor }: { label: string; valor: number }) {
  return (
    <p className="flex items-baseline justify-between gap-4 text-[13px] text-[var(--ink-soft)]">
      <span>{label}</span>
      <span className="font-medium text-[var(--ink)]" aria-live="polite">
        {fmt(round2(valor))}
      </span>
    </p>
  );
}

function BotaoDetalhar({
  aberto,
  onClick,
  painelId,
  rotulo,
}: {
  aberto: boolean;
  onClick: () => void;
  painelId: string;
  rotulo: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={aberto}
      aria-controls={painelId}
      className={BOTAO_LINK}
    >
      {aberto ? (
        <ChevronUp size={14} aria-hidden="true" />
      ) : (
        <ChevronDown size={14} aria-hidden="true" />
      )}
      {aberto ? "Recolher" : rotulo}
    </button>
  );
}

/**
 * Matéria-prima ou embalagem por peça (09/10/2026). Fechado, é o campo de
 * total de sempre. "Calcular pelo pacote" abre uma linha por material:
 * paguei / veio quanto / uso por peça, e o total vira a soma das linhas.
 */
export function BlocoInsumos({
  label,
  dica,
  total,
  onTotal,
  detalhado,
  onDetalhado,
  itens,
  onItens,
  exemploNome,
  exemploUnidade,
  rotuloAdicionar,
}: {
  label: string;
  dica?: string;
  total: string;
  onTotal: (v: string) => void;
  detalhado: boolean;
  onDetalhado: (v: boolean) => void;
  itens: ItemInsumo[];
  onItens: (itens: ItemInsumo[]) => void;
  exemploNome: string;
  exemploUnidade: string;
  rotuloAdicionar: string;
}) {
  const painelId = useId();
  const soma = totalDosInsumos(itens);

  const novaLinha = (pago = ""): ItemInsumo => ({
    id: crypto.randomUUID(),
    nome: "",
    pago,
    rende: "",
    unidade: "",
    uso: "1",
  });

  // Ao abrir, o total digitado antes vira a primeira linha (R$ X, 1 por
  // peça), se as linhas não somam ele: o número dela não some. Ao fechar, o
  // total vira a soma das linhas.
  const abrir = () => {
    if (Math.abs(totalDosInsumos(itens) - num(total)) >= 0.01 || itens.length === 0) {
      onItens([novaLinha(num(total) > 0 ? total : "")]);
    }
    onDetalhado(true);
  };
  const fechar = () => {
    onTotal(soma > 0 ? String(round2(soma)) : "");
    onDetalhado(false);
  };

  const mudar = (id: string, campo: keyof ItemInsumo, v: string) =>
    onItens(itens.map((i) => (i.id === id ? { ...i, [campo]: v } : i)));

  return (
    <div className="sm:col-span-2">
      {detalhado ? (
        <TotalCalculado label={label.replace(" (R$)", " por peça")} valor={soma} />
      ) : (
        <CampoTotal label={label} dica={dica} value={total} onChange={onTotal} />
      )}
      <BotaoDetalhar
        aberto={detalhado}
        onClick={detalhado ? fechar : abrir}
        painelId={painelId}
        rotulo="Calcular pelo pacote"
      />

      {detalhado && (
        <div id={painelId} className="mt-1 space-y-2">
          {itens.map((it) => {
            const naPeca = custoNaPeca(itemParaConta(it));
            const unidade = it.unidade.trim();
            return (
              <div key={it.id} className="rounded-lg border border-[var(--line)] bg-white p-3">
                <div className="flex items-start gap-2">
                  <input
                    value={it.nome}
                    onChange={(e) => mudar(it.id, "nome", e.target.value)}
                    aria-label="Nome do material"
                    placeholder={exemploNome}
                    className={INPUT}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const i = itens.findIndex((x) => x.id === it.id);
                      const copia = { ...it, id: crypto.randomUUID() };
                      onItens([...itens.slice(0, i + 1), copia, ...itens.slice(i + 1)]);
                    }}
                    aria-label="Duplicar material"
                    title="Duplicar"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)]"
                  >
                    <Copy size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onItens(itens.filter((x) => x.id !== it.id))}
                    aria-label="Remover material"
                    title="Remover"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)]"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <CampoLinha
                    label="Paguei (R$)"
                    value={it.pago}
                    onChange={(v) => mudar(it.id, "pago", v)}
                  />
                  <CampoLinha
                    label="Veio quanto"
                    value={it.rende}
                    onChange={(v) => mudar(it.id, "rende", v)}
                    placeholder="1"
                  />
                  <Campo label="Unidade">
                    <input
                      value={it.unidade}
                      onChange={(e) => mudar(it.id, "unidade", e.target.value)}
                      placeholder={exemploUnidade}
                      className={INPUT}
                    />
                  </Campo>
                  <CampoLinha
                    label="Uso por peça"
                    value={it.uso}
                    onChange={(v) => mudar(it.id, "uso", v)}
                  />
                </div>
                <p className="mt-2 text-[12.5px] text-[var(--muted)]">
                  {naPeca > 0
                    ? `${fmt(round2(naPeca))} na peça${
                        num(it.rende) > 1
                          ? ` (${fmt(num(it.pago))} ÷ ${it.rende}${unidade ? ` ${unidade}` : ""} × ${it.uso})`
                          : ""
                      }`
                    : "Preencha quanto pagou e quanto usa em uma peça."}
                </p>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => onItens([...itens, novaLinha()])}
            className={BOTAO_LINK}
          >
            <Plus size={14} aria-hidden="true" />
            {rotuloAdicionar}
          </button>
        </div>
      )}
    </div>
  );
}

function CampoLinha({
  label,
  value,
  onChange,
  placeholder = "0",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Campo label={label} error={numInvalido(value) ? "Coloque um número." : undefined}>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT}
        placeholder={placeholder}
      />
    </Campo>
  );
}

/**
 * Mão de obra por peça (09/10/2026). "Calcular pelo tempo" troca o número
 * solto por minutos por peça × valor da hora. O campo do valor da hora vem
 * pronto da Calculadora (é o mesmo do Serviço e da Encomenda).
 */
export function BlocoMaoDeObra({
  total,
  onTotal,
  detalhado,
  onDetalhado,
  minutos,
  onMinutos,
  valorHora,
  campoValorHora,
}: {
  total: string;
  onTotal: (v: string) => void;
  detalhado: boolean;
  onDetalhado: (v: boolean) => void;
  minutos: string;
  onMinutos: (v: string) => void;
  valorHora: string;
  campoValorHora: ReactNode;
}) {
  const painelId = useId();
  const calculado = maoDeObraPorPeca(num(minutos), num(valorHora));

  // Ao abrir com um valor já digitado e a hora conhecida, o tempo sai dele
  // (R$ 30 a R$ 40/h = 45 min), pra conta não zerar de surpresa.
  const abrir = () => {
    if (!num(minutos) && num(total) > 0 && num(valorHora) > 0) {
      onMinutos(String(Math.round((num(total) / num(valorHora)) * 60)));
    }
    onDetalhado(true);
  };
  const fechar = () => {
    onTotal(calculado > 0 ? String(round2(calculado)) : total);
    onDetalhado(false);
  };

  return (
    <div className="sm:col-span-2">
      {detalhado ? (
        <TotalCalculado label="Mão de obra por peça" valor={calculado} />
      ) : (
        <CampoTotal
          label="Mão de obra por unidade (R$)"
          dica="O seu tempo ou o de quem ajuda a fazer cada peça."
          value={total}
          onChange={onTotal}
        />
      )}
      <BotaoDetalhar
        aberto={detalhado}
        onClick={detalhado ? fechar : abrir}
        painelId={painelId}
        rotulo="Calcular pelo tempo"
      />
      {detalhado && (
        <div
          id={painelId}
          className="mt-1 grid grid-cols-1 gap-4 rounded-lg border border-[var(--line)] bg-white p-3 sm:grid-cols-2"
        >
          <Campo
            label="Quanto tempo leva uma peça (min)"
            error={numInvalido(minutos) ? "Coloque um número." : undefined}
          >
            <input
              type="number"
              inputMode="decimal"
              value={minutos}
              onChange={(e) => onMinutos(e.target.value)}
              className={INPUT}
              placeholder="0"
            />
          </Campo>
          {campoValorHora}
          <p className="text-[12.5px] text-[var(--muted)] sm:col-span-2">
            {calculado > 0
              ? `${minutos} min a ${fmt(num(valorHora))} por hora = ${fmt(round2(calculado))} na peça.`
              : "Preencha o tempo e o valor da hora."}
          </p>
        </div>
      )}
    </div>
  );
}
