import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { Vazio } from "@/components/layout/Vazio";
import { BlockError } from "@/components/ui/BlockError";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { MenuOpcoes } from "@/components/ui/MenuOpcoes";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO_ACAO } from "@/lib/botoes";
import { formatarReais } from "@/lib/formatarReais";
import { toastErro, toastSucesso } from "@/lib/toast";
import { track } from "@/lib/analytics";
import {
  dataCurta,
  frasePrazo,
  ordenarContas,
  proximoVencimento,
  resumoContas,
  rotuloDoVencimento,
  situacaoDaConta,
  type ContaPagar,
} from "@/lib/contasPagar";
import {
  chaveContas,
  desfazerPagamento,
  ehMesSeguintePago,
  excluirConta,
  pagarConta,
  useContasPagar,
} from "./contasPagarDados";
import { ModalContaPagar } from "./ModalContaPagar";

const fmt = (v: number) => formatarReais(v, { sempreCentavos: true });

/** 30 dias antes de hoje, pra lista de pagas recentes. */
function trintaDiasAntes(hoje: string): string {
  const [a, m, d] = hoje.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d - 30)).toISOString().slice(0, 10);
}

/**
 * Contas a pagar dentro do Financeiro (ONE-127). Lista o que vence, por ordem
 * de vencimento, com "Paguei" em cada linha. Pagar vira saída no histórico e,
 * se a conta repete, agenda a do mês seguinte.
 */
export function SecaoContasPagar({
  userId,
  hoje,
  categoriasDoHistorico,
  onLancamentosMudaram,
}: {
  userId: string;
  hoje: string;
  categoriasDoHistorico: string[];
  onLancamentosMudaram: () => void;
}) {
  const qc = useQueryClient();
  const query = useContasPagar(userId, hoje ? trintaDiasAntes(hoje) : "");
  const [modal, setModal] = useState<{ aberto: boolean; conta: ContaPagar | null }>({
    aberto: false,
    conta: null,
  });
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [pagarEmData, setPagarEmData] = useState<ContaPagar | null>(null);
  const [excluir, setExcluir] = useState<ContaPagar | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [verPagas, setVerPagas] = useState(false);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  const contas = useMemo(() => query.data ?? [], [query.data]);
  const aPagar = useMemo(
    () => ordenarContas(contas.filter((c) => c.status === "a_pagar")),
    [contas],
  );
  const pagas = useMemo(
    () =>
      contas
        .filter((c) => c.status === "paga")
        .sort((a, b) => (b.pagoEm ?? "").localeCompare(a.pagoEm ?? "")),
    [contas],
  );
  const resumo = useMemo(() => resumoContas(aPagar, hoje), [aPagar, hoje]);

  // "Ver contas" do Painel chega com #contas-a-pagar, mas a seção só existe
  // depois que o Financeiro carrega: o navegador não acha a âncora sozinho.
  useEffect(() => {
    if (!query.isSuccess || typeof window === "undefined") return;
    if (window.location.hash !== "#contas-a-pagar") return;
    tituloRef.current?.scrollIntoView({ block: "start" });
    tituloRef.current?.focus({ preventScroll: true });
  }, [query.isSuccess]);

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: chaveContas(userId) });
    onLancamentosMudaram();
  };

  const desfazer = async (c: ContaPagar) => {
    setOcupada(c.id);
    const { error } = await desfazerPagamento(c.id);
    setOcupada(null);
    if (error) {
      console.error("conta_pagar_desfazer", error);
      toastErro(
        ehMesSeguintePago(error)
          ? "A conta do mês seguinte já está paga. Desfaz aquela primeiro."
          : "A Pólia One não conseguiu desfazer o pagamento. Tenta de novo.",
      );
      return;
    }
    track("conta_pagar_desfeita");
    recarregar();
    toastSucesso("Pagamento desfeito. A conta voltou pra lista e a saída saiu do histórico.");
  };

  const pagar = async (c: ContaPagar, data: string) => {
    setOcupada(c.id);
    const { error } = await pagarConta(c.id, data);
    setOcupada(null);
    if (error) {
      console.error("conta_pagar_pagar", error);
      toastErro("A Pólia One não conseguiu marcar a conta como paga. Tenta de novo.");
      return false;
    }
    track("conta_pagar_paga", {
      mensal: c.recorrencia === "mensal",
      data_diferente: data !== hoje,
    });
    recarregar();
    const proxima =
      c.recorrencia === "mensal"
        ? ` A de ${dataCurta(proximoVencimento(c.vencimento, c.diaRecorrencia ?? undefined), hoje)} já está agendada.`
        : "";
    toastSucesso(`Conta paga: ${c.descricao}. Entrou como saída no histórico.${proxima}`, {
      duracaoMs: 8000,
      action: { label: "Desfazer", onClick: () => void desfazer(c) },
    });
    return true;
  };

  // Atrasada pergunta a data: paga em 30/09 e marcada em 02/10 entraria como
  // saída de outubro, e o número dos dois meses ficaria errado.
  const clicarPaguei = (c: ContaPagar) => {
    if (situacaoDaConta(c.vencimento, hoje) === "atrasada") setPagarEmData(c);
    else void pagar(c, hoje);
  };

  const confirmarExcluir = async () => {
    if (!excluir) return;
    setExcluindo(true);
    const { error } = await excluirConta(excluir.id);
    setExcluindo(false);
    if (error) {
      console.error("conta_pagar_excluir", error);
      toastErro("A Pólia One não conseguiu excluir a conta. Tenta de novo.");
      return;
    }
    track("conta_pagar_excluida");
    setExcluir(null);
    qc.invalidateQueries({ queryKey: chaveContas(userId) });
  };

  const prazo = frasePrazo(resumo);

  return (
    <section
      id="contas-a-pagar"
      className="mt-12 scroll-mt-24"
      aria-labelledby="titulo-contas-pagar"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            ref={tituloRef}
            tabIndex={-1}
            id="titulo-contas-pagar"
            className="text-[20px] leading-tight text-[var(--ink)] focus:outline-none"
          >
            Contas a pagar
          </h2>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            {prazo || "O que ainda vai sair: aluguel, fornecedor, assinatura."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ aberto: true, conta: null })}
          className={BTN_ACAO_CONTORNO}
        >
          + Nova conta a pagar
        </button>
      </div>

      <div className="mt-4">
        {query.isError ? (
          <div role="alert">
            <BlockError
              message="A Pólia One não conseguiu ler as contas a pagar agora. Nada foi perdido, é só a leitura que falhou."
              onRetry={() => void query.refetch()}
            />
          </div>
        ) : query.isLoading || !hoje ? (
          <div
            className="h-16 animate-pulse rounded-xl border border-[var(--line)] bg-white motion-reduce:animate-none"
            aria-busy="true"
            aria-label="Carregando contas a pagar"
          />
        ) : aPagar.length === 0 ? (
          <Vazio
            icone={CalendarClock}
            denso
            titulo="Nenhuma conta esperando pagamento."
            texto="Cadastra o que tem data pra sair e a Pólia One avisa no Painel o que vence na semana."
          />
        ) : (
          <ul className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-white">
            {aPagar.map((c) => (
              <LinhaConta
                key={c.id}
                c={c}
                hoje={hoje}
                ocupada={ocupada === c.id}
                onPagar={() => clicarPaguei(c)}
                onPagarEmOutraData={() => setPagarEmData(c)}
                onEditar={() => setModal({ aberto: true, conta: c })}
                onExcluir={() => setExcluir(c)}
              />
            ))}
          </ul>
        )}

        {pagas.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setVerPagas((v) => !v)}
              aria-expanded={verPagas}
              className="inline-flex min-h-11 items-center text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
            >
              {verPagas
                ? "Esconder as pagas"
                : `Ver as pagas nos últimos 30 dias (${pagas.length})`}
            </button>
            {verPagas && (
              <ul className="mt-1 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
                {pagas.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] text-[var(--ink-soft)]">{c.descricao}</p>
                      <p className="text-[12px] text-[var(--muted)]">
                        paga em {c.pagoEm ? dataCurta(c.pagoEm, hoje) : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <p className="font-cabinet text-[16px] tabular-nums text-[var(--ink-soft)]">
                        {fmt(c.valor)}
                      </p>
                      <button
                        type="button"
                        onClick={() => void desfazer(c)}
                        disabled={ocupada === c.id}
                        aria-label={`Desfazer o pagamento de ${c.descricao}`}
                        className={BTN_MIUDO_ACAO}
                      >
                        {ocupada === c.id ? "Desfazendo..." : "Desfazer"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {modal.aberto && (
        <ModalContaPagar
          userId={userId}
          vencimentoPadrao={hoje}
          contaEdit={modal.conta}
          categoriasDoHistorico={categoriasDoHistorico}
          onClose={() => setModal({ aberto: false, conta: null })}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: chaveContas(userId) });
            setModal({ aberto: false, conta: null });
          }}
        />
      )}

      {pagarEmData && (
        <ModalPagarEmData
          conta={pagarEmData}
          hoje={hoje}
          onClose={() => setPagarEmData(null)}
          onConfirmar={async (data) => {
            if (await pagar(pagarEmData, data)) setPagarEmData(null);
          }}
          salvando={ocupada === pagarEmData.id}
        />
      )}

      <ConfirmarAcao
        open={!!excluir}
        onOpenChange={(open) => !open && setExcluir(null)}
        titulo={`Excluir a conta "${excluir?.descricao ?? ""}"`}
        descricao={
          excluir?.recorrencia === "mensal"
            ? "A repetição para aqui. Saídas que já foram pagas continuam no histórico."
            : "Essa ação não pode ser desfeita."
        }
        textoConfirmar="Excluir"
        destrutivo
        carregando={excluindo}
        textoCarregando="Excluindo…"
        onConfirmar={confirmarExcluir}
      />
    </section>
  );
}

function LinhaConta({
  c,
  hoje,
  ocupada,
  onPagar,
  onPagarEmOutraData,
  onEditar,
  onExcluir,
}: {
  c: ContaPagar;
  hoje: string;
  ocupada: boolean;
  onPagar: () => void;
  onPagarEmOutraData: () => void;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const situacao = situacaoDaConta(c.vencimento, hoje);
  const corDoPrazo =
    situacao === "atrasada"
      ? "text-[var(--danger)]"
      : situacao === "hoje"
        ? "font-semibold text-[var(--ink)]"
        : "text-[var(--muted)]";

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] text-[var(--ink-soft)]">{c.descricao}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px]">
          <span className={corDoPrazo}>{rotuloDoVencimento(c.vencimento, hoje)}</span>
          {c.recorrencia === "mensal" && <span className="text-[var(--muted)]">todo mês</span>}
          {c.categoria && (
            <span className="rounded-md border border-[var(--line)] bg-white px-2 py-0.5 text-[11px] text-[var(--ink-soft)]">
              {c.categoria}
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <p className="font-cabinet text-[19px] tabular-nums text-[var(--ink)]">{fmt(c.valor)}</p>
        <button
          type="button"
          onClick={onPagar}
          disabled={ocupada}
          aria-label={`Paguei ${c.descricao}`}
          className={BTN_MIUDO_ACAO}
        >
          {ocupada ? "Marcando..." : "Paguei"}
        </button>
        <MenuOpcoes
          align="end"
          ariaLabel={`Opções da conta ${c.descricao}`}
          itens={[
            { label: "Paguei em outra data", onClick: onPagarEmOutraData },
            { label: "Editar", onClick: onEditar },
            { label: "Excluir", onClick: onExcluir, destrutivo: true },
          ]}
        />
      </div>
    </li>
  );
}

function ModalPagarEmData({
  conta,
  hoje,
  salvando,
  onClose,
  onConfirmar,
}: {
  conta: ContaPagar;
  hoje: string;
  salvando: boolean;
  onClose: () => void;
  onConfirmar: (data: string) => void;
}) {
  const [data, setData] = useState(hoje);
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(data) && data <= hoje;

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={`Quando você pagou: ${conta.descricao}`}
      description={`${fmt(conta.valor)} entram como saída no mês da data escolhida.`}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmar(data)}
            disabled={salvando || !valida}
            className={BTN_ACAO}
          >
            {salvando ? "Marcando..." : "Marcar como paga"}
          </button>
        </>
      }
    >
      <Campo
        label="Paguei em"
        required
        error={data > hoje ? "A data do pagamento não pode ser depois de hoje" : undefined}
      >
        <input
          type="date"
          value={data}
          max={hoje}
          autoFocus
          onChange={(e) => setData(e.target.value)}
          className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
        />
      </Campo>
    </Modal>
  );
}
