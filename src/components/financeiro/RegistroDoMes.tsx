import { useMemo, useState } from "react";
import { Plus, Trash2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Vazio } from "@/components/layout/Vazio";
import { BTN_MIUDO } from "@/lib/botoes";
import { toastErro } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { hojeISO, ehMesAtual } from "@/lib/data.functions";
import { ModalLancamento, type Lancamento } from "@/components/financeiro/ModalLancamento";

/**
 * Registro mínimo de entradas e saídas, pra viver DENTRO do Painel.
 *
 * Existe por causa da decisão COPY-04 (03/09/2026). O card do plano Confere
 * promete "painel diário: quanto já entrou e quanto falta pra fechar as contas
 * do mês", mas a tela /financeiro é do Controle: sem nenhum lançamento
 * possível, o painel do plano grátis mostrava R$ 0 pra sempre e a promessa era
 * falsa. A decisão foi cumprir a promessa em vez de rebaixá-la.
 *
 * O corte: a AÇÃO de registrar (e corrigir) entrada e saída do mês corrente
 * abre pra todo plano. A TELA /financeiro continua no Controle e é ela que tem
 * o histórico de todos os meses, os filtros de período, a régua dos três
 * números do mês, o registro de venda ligado a produto e o resumo pro contador.
 *
 * Este cartão só aparece pra quem NÃO tem o Financeiro: quem tem o Controle vê
 * o cartão de métrica linkando pra tela completa, que faz tudo isso e mais.
 */

function fmtValor(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDataCurta(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return iso;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

// Quantas linhas o cartão mostra antes de parar. O Painel é um resumo do dia,
// não o extrato: sem teto, um mês movimentado empurrava o resto da tela pra
// baixo da dobra.
const LIMITE_LINHAS = 5;

export function RegistroDoMes({
  userId,
  lancamentos,
  onMudou,
}: {
  userId: string;
  /** Todos os lançamentos da usuária: o filtro do mês corrente é feito aqui. */
  lancamentos: Lancamento[];
  /** Chamado depois de salvar ou excluir, pra o Painel recarregar os números. */
  onMudou: () => void;
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [lancamentoEdit, setLancamentoEdit] = useState<Lancamento | null>(null);

  const doMes = useMemo(() => {
    return lancamentos
      .filter((l) => l.data && ehMesAtual(l.data))
      .sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
  }, [lancamentos]);

  const abrirCriar = () => {
    setLancamentoEdit(null);
    setModalAberto(true);
  };

  const abrirEditar = (l: Lancamento) => {
    setLancamentoEdit(l);
    setModalAberto(true);
  };

  const excluir = async (l: Lancamento) => {
    if (!window.confirm("Excluir este lançamento? Essa ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("lancamentos").delete().eq("id", l.id);
    if (error) {
      toastErro("Não conseguimos excluir o lançamento. Tenta de novo.");
      return;
    }
    track("lancamento_excluido", { tipo: l.tipo });
    onMudou();
  };

  return (
    <div className="rounded-xl border border-[var(--line)] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-white">
            <Wallet size={19} className="text-[var(--ink)]" aria-hidden="true" />
          </span>
          <div>
            <p className="font-cabinet text-[18px] leading-tight text-[var(--ink)]">
              Entrou e saiu este mês
            </p>
            <p className="text-[13px] text-[var(--muted)]">
              {doMes.length === 0
                ? "nenhum lançamento ainda"
                : `${doMes.length} ${doMes.length === 1 ? "lançamento" : "lançamentos"} no mês`}
            </p>
          </div>
        </div>
        <button type="button" onClick={abrirCriar} className={BTN_MIUDO}>
          <Plus size={14} aria-hidden="true" />
          Registrar
        </button>
      </div>

      {doMes.length === 0 ? (
        <div className="mt-4">
          <Vazio
            semBorda
            titulo="Nada registrado neste mês."
            texto="A primeira entrada já faz o painel dizer quanto entrou e quanto falta."
          />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--line)]">
          {doMes.slice(0, LIMITE_LINHAS).map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
              <button
                type="button"
                onClick={() => abrirEditar(l)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="w-[38px] shrink-0 text-[12px] text-[var(--muted)]">
                  {fmtDataCurta(l.data)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--ink-soft)]">
                  {l.descricao?.trim() || l.categoria?.trim() || "Sem descrição"}
                </span>
                <span
                  className={`shrink-0 text-[14px] tabular-nums ${
                    l.tipo === "entrada" ? "text-[var(--ink)]" : "text-[var(--muted)]"
                  }`}
                >
                  {l.tipo === "entrada" ? "+" : "-"} {fmtValor(Number(l.valor))}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void excluir(l)}
                aria-label={`Excluir lançamento de ${fmtValor(Number(l.valor))}`}
                title="Excluir"
                className="shrink-0 rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--danger)]"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {doMes.length > LIMITE_LINHAS && (
        <p className="mt-3 text-[12px] text-[var(--muted)]">
          Mostrando os {LIMITE_LINHAS} mais recentes de {doMes.length}.
        </p>
      )}

      {/* O que ainda é do Controle, dito sem rodeio: o registro abriu, a tela
          de gestão do dinheiro não. */}
      <p className="mt-4 border-t border-[var(--line)] pt-3 text-[12px] leading-relaxed text-[var(--muted)]">
        O Controle abre o Financeiro inteiro: todos os meses, filtro por período, a régua do mínimo
        pra fechar as contas e o resumo pro contador.{" "}
        <a
          href="/upgrade?rota=%2Ffinanceiro&tier=controle"
          className="text-[var(--secondary-text)] underline-offset-2 hover:underline"
        >
          Conhecer o Controle
        </a>
      </p>

      {modalAberto && (
        <ModalLancamento
          userId={userId}
          tipoInicial="entrada"
          dataPadrao={hojeISO()}
          prefill={null}
          lancamentoEdit={lancamentoEdit}
          historico={lancamentos}
          onClose={() => setModalAberto(false)}
          onSaved={() => {
            setModalAberto(false);
            onMudou();
          }}
        />
      )}
    </div>
  );
}
