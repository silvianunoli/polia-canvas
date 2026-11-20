import { useMemo, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HandCoins } from "lucide-react";
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
import { dataCurta, rotuloDaParcela, rotuloDoVencimento, situacaoDaConta } from "@/lib/contasPagar";
import {
  fraseAReceber,
  fraseDiferencaRecebida,
  listaAReceber,
  resumoAReceber,
  valorQueDeveCair,
  type ContaReceber,
  type ItemAReceber,
  type VendaAReceber,
} from "@/lib/contasReceber";
import { FORMAS_RECEBIMENTO, ROTULO_TAXA, type FormaRecebimento } from "@/lib/taxas";
import { CANAL_LABEL, type CanalVenda } from "@/lib/vendas";
import { receberVenda } from "@/components/vendas/dados";
import { useTaxas } from "@/components/vendas/taxasDados";
import {
  chaveAReceber,
  desfazerRecebimento,
  excluirContaReceber,
  receberConta,
  useAReceber,
} from "./contasReceberDados";
import { ModalContaReceber } from "./ModalContaReceber";

const fmt = (v: number) => formatarReais(v, { sempreCentavos: true });

function trintaDiasAntes(hoje: string): string {
  const [a, m, d] = hoje.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d - 30)).toISOString().slice(0, 10);
}

const nomeDoCanal = (canal: string) => CANAL_LABEL[canal as CanalVenda] ?? canal;

/**
 * "A receber" no Financeiro (ONE-207 Fase 2): contas a receber avulsas e
 * vendas a receber de Vendas/Pedidos numa lista só, por data combinada.
 * "Recebi" vira entrada no histórico.
 */
export function SecaoAReceber({
  userId,
  hoje,
  categoriasDoHistorico,
  onLancamentosMudaram,
}: {
  userId: string;
  hoje: string;
  /** Categorias de entrada que ela já usa no Financeiro. */
  categoriasDoHistorico: string[];
  onLancamentosMudaram: () => void;
}) {
  const qc = useQueryClient();
  const query = useAReceber(userId, hoje ? trintaDiasAntes(hoje) : "");
  const [modal, setModal] = useState<{ aberto: boolean; conta: ContaReceber | null }>({
    aberto: false,
    conta: null,
  });
  const [receber, setReceber] = useState<ItemAReceber | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [excluir, setExcluir] = useState<ContaReceber | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [verRecebidas, setVerRecebidas] = useState(false);

  const contas = useMemo(() => query.data?.contas ?? [], [query.data?.contas]);
  const vendas = useMemo(() => query.data?.vendas ?? [], [query.data?.vendas]);
  const itens = useMemo(() => listaAReceber(contas, vendas), [contas, vendas]);
  const recebidas = useMemo(
    () =>
      contas
        .filter((c) => c.status === "recebida")
        .sort((a, b) => (b.recebidoEm ?? "").localeCompare(a.recebidoEm ?? "")),
    [contas],
  );
  const resumo = useMemo(() => resumoAReceber(itens, hoje), [itens, hoje]);
  const clientes = useMemo(
    () =>
      [
        ...new Set(
          [...contas.map((c) => c.cliente), ...vendas.map((v) => v.clienteNome)].filter(
            (c): c is string => !!c,
          ),
        ),
      ].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [contas, vendas],
  );

  const recarregar = (tambemVendas = false) => {
    if (tambemVendas) void qc.invalidateQueries();
    else qc.invalidateQueries({ queryKey: chaveAReceber(userId) });
    onLancamentosMudaram();
  };

  const desfazer = async (c: ContaReceber) => {
    setOcupada(c.id);
    const { error } = await desfazerRecebimento(c.id);
    setOcupada(null);
    if (error) {
      console.error("conta_receber_desfazer", error);
      toastErro("A Pólia One não conseguiu desfazer o recebimento. Tenta de novo.");
      return;
    }
    track("conta_receber_desfeita");
    recarregar();
    toastSucesso("Recebimento desfeito. A conta voltou pra lista e a entrada saiu do histórico.");
  };

  const confirmarRecebimento = async (
    item: ItemAReceber,
    data: string,
    valorRecebido?: number,
    forma?: FormaRecebimento | null,
  ) => {
    setOcupada(item.id);
    const { error } =
      item.tipo === "conta"
        ? await receberConta(item.id, data, valorRecebido, forma)
        : await receberVenda(item.id, data);
    setOcupada(null);
    if (error) {
      console.error("a_receber_receber", error);
      toastErro("A Pólia One não conseguiu marcar como recebido. Tenta de novo.");
      return false;
    }
    track(item.tipo === "conta" ? "conta_receber_recebida" : "venda_recebida_no_financeiro", {
      forma: forma ?? "nao_informada",
      data_diferente: data !== hoje,
      valor_diferente: valorRecebido !== undefined,
      parcelada: item.tipo === "conta" && !!item.conta.parcelas,
    });
    recarregar(item.tipo === "venda");
    if (item.tipo === "conta") {
      const conta = item.conta;
      toastSucesso(`Recebido: ${conta.descricao}. Entrou como entrada no histórico.`, {
        duracaoMs: 8000,
        action: { label: "Desfazer", onClick: () => void desfazer(conta) },
      });
    } else {
      toastSucesso("Venda recebida. Entrou como entrada no histórico.");
    }
    return true;
  };

  const confirmarExcluir = async () => {
    if (!excluir) return;
    setExcluindo(true);
    const { error } = await excluirContaReceber(excluir.id);
    setExcluindo(false);
    if (error) {
      console.error("conta_receber_excluir", error);
      toastErro("A Pólia One não conseguiu excluir a conta. Tenta de novo.");
      return;
    }
    track("conta_receber_excluida");
    setExcluir(null);
    qc.invalidateQueries({ queryKey: chaveAReceber(userId) });
  };

  const prazo = fraseAReceber(resumo);

  return (
    <section id="a-receber" className="mt-12 scroll-mt-24" aria-labelledby="titulo-a-receber">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-a-receber" className="text-[20px] leading-tight text-[var(--ink)]">
            A receber
          </h2>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            {prazo || "O que ainda vai entrar: fiado, resto de encomenda, parcela da cliente."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ aberto: true, conta: null })}
          className={BTN_ACAO_CONTORNO}
        >
          + Nova conta a receber
        </button>
      </div>

      <div className="mt-4">
        {query.isError ? (
          <div role="alert">
            <BlockError
              message="A Pólia One não conseguiu ler o que falta receber agora. Nada foi perdido, é só a leitura que falhou."
              onRetry={() => void query.refetch()}
            />
          </div>
        ) : query.isLoading || !hoje ? (
          <div
            className="h-16 animate-pulse rounded-xl border border-[var(--line)] bg-white motion-reduce:animate-none"
            aria-busy="true"
            aria-label="Carregando o que falta receber"
          />
        ) : itens.length === 0 ? (
          <Vazio
            icone={HandCoins}
            denso
            titulo="Nada esperando pagamento."
            texto="Venda marcada como a receber em Vendas aparece aqui sozinha. Fiado e parcela combinada por fora entram por “+ Nova conta a receber”."
          />
        ) : (
          <ul className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-white">
            {itens.map((item) => (
              <LinhaAReceber
                key={`${item.tipo}-${item.id}`}
                item={item}
                hoje={hoje}
                ocupada={ocupada === item.id}
                onReceber={() => setReceber(item)}
                onEditar={
                  item.tipo === "conta"
                    ? () => setModal({ aberto: true, conta: item.conta })
                    : undefined
                }
                onExcluir={item.tipo === "conta" ? () => setExcluir(item.conta) : undefined}
              />
            ))}
          </ul>
        )}

        {recebidas.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setVerRecebidas((v) => !v)}
              aria-expanded={verRecebidas}
              className="inline-flex min-h-11 items-center text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
            >
              {verRecebidas
                ? "Esconder as recebidas"
                : `Ver as recebidas nos últimos 30 dias (${recebidas.length})`}
            </button>
            {verRecebidas && (
              <ul className="mt-1 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
                {recebidas.map((c) => {
                  const diferenca = fraseDiferencaRecebida(c.valor, c.valorRecebido);
                  return (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[14px] text-[var(--ink-soft)]">
                          {c.descricao}
                          {c.cliente && <span className="text-[var(--muted)]"> · {c.cliente}</span>}
                        </p>
                        <p className="text-[12px] text-[var(--muted)]">
                          recebida em {c.recebidoEm ? dataCurta(c.recebidoEm, hoje) : ""}
                          {c.forma ? ` · ${ROTULO_TAXA[c.forma]}` : ""}
                          {c.parcelas ? ` · ${rotuloDaParcela(c)}` : ""}
                          {diferenca ? ` · ${diferenca}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <p className="font-cabinet text-[16px] tabular-nums text-[var(--ink-soft)]">
                          {fmt(c.valorRecebido ?? c.valor)}
                        </p>
                        <button
                          type="button"
                          onClick={() => void desfazer(c)}
                          disabled={ocupada === c.id}
                          aria-label={`Desfazer o recebimento de ${c.descricao}`}
                          className={BTN_MIUDO_ACAO}
                        >
                          {ocupada === c.id ? "Desfazendo..." : "Desfazer"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {modal.aberto && (
        <ModalContaReceber
          userId={userId}
          vencimentoPadrao={hoje}
          contaEdit={modal.conta}
          categoriasDoHistorico={categoriasDoHistorico}
          clientesConhecidos={clientes}
          onClose={() => setModal({ aberto: false, conta: null })}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: chaveAReceber(userId) });
            setModal({ aberto: false, conta: null });
          }}
        />
      )}

      {receber && (
        <ModalReceber
          userId={userId}
          item={receber}
          hoje={hoje}
          salvando={ocupada === receber.id}
          onClose={() => setReceber(null)}
          onConfirmar={async (data, valorRecebido, forma) => {
            if (await confirmarRecebimento(receber, data, valorRecebido, forma)) setReceber(null);
          }}
        />
      )}

      <ConfirmarAcao
        open={!!excluir}
        onOpenChange={(open) => !open && setExcluir(null)}
        titulo={`Excluir a conta "${excluir?.descricao ?? ""}"`}
        descricao="Essa ação não pode ser desfeita."
        textoConfirmar="Excluir"
        destrutivo
        carregando={excluindo}
        textoCarregando="Excluindo…"
        onConfirmar={confirmarExcluir}
      />
    </section>
  );
}

function LinhaAReceber({
  item,
  hoje,
  ocupada,
  onReceber,
  onEditar,
  onExcluir,
}: {
  item: ItemAReceber;
  hoje: string;
  ocupada: boolean;
  onReceber: () => void;
  onEditar?: () => void;
  onExcluir?: () => void;
}) {
  const situacao = situacaoDaConta(item.vencimento, hoje);
  const corDoPrazo =
    situacao === "atrasada"
      ? "text-[var(--danger)]"
      : situacao === "hoje"
        ? "font-semibold text-[var(--ink)]"
        : "text-[var(--muted)]";
  const titulo =
    item.tipo === "conta" ? item.conta.descricao : `Venda · ${nomeDoCanal(item.venda.canal)}`;
  const quem = item.tipo === "conta" ? item.conta.cliente : item.venda.clienteNome;

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] text-[var(--ink-soft)]">
          {titulo}
          {quem && <span className="text-[var(--muted)]"> · {quem}</span>}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px]">
          <span className={corDoPrazo}>{rotuloDoVencimento(item.vencimento, hoje)}</span>
          {item.tipo === "venda" && <MetaVenda venda={item.venda} hoje={hoje} />}
          {item.tipo === "conta" && item.conta.parcelas && (
            <span className="text-[var(--muted)]">{rotuloDaParcela(item.conta)}</span>
          )}
          {item.tipo === "conta" && item.conta.documento && (
            <span
              className="max-w-[220px] truncate text-[var(--muted)]"
              title={item.conta.documento}
            >
              doc. {item.conta.documento}
            </span>
          )}
          {item.tipo === "conta" && item.conta.categoria && (
            <span className="rounded-md border border-[var(--line)] bg-white px-2 py-0.5 text-[11px] text-[var(--ink-soft)]">
              {item.conta.categoria}
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <p className="font-cabinet text-[19px] tabular-nums text-[var(--ink)]">{fmt(item.valor)}</p>
        <button
          type="button"
          onClick={onReceber}
          disabled={ocupada}
          aria-label={`Recebi ${titulo}`}
          className={BTN_MIUDO_ACAO}
        >
          {ocupada ? "Marcando..." : "Recebi"}
        </button>
        {onEditar && onExcluir && (
          <MenuOpcoes
            align="end"
            ariaLabel={`Opções da conta ${titulo}`}
            itens={[
              { label: "Editar", onClick: onEditar },
              { label: "Excluir", onClick: onExcluir, destrutivo: true },
            ]}
          />
        )}
      </div>
    </li>
  );
}

function MetaVenda({ venda, hoje }: { venda: VendaAReceber; hoje: string }) {
  return (
    <span className="rounded-md border border-[var(--line)] bg-white px-2 py-0.5 text-[11px] text-[var(--ink-soft)]">
      de Vendas · vendida em {dataCurta(venda.data, hoje)}
    </span>
  );
}

/**
 * "Recebi": data sempre; forma e valor que caiu só na conta avulsa. A venda
 * entra pelo líquido que Vendas já calculou (total - taxa - frete pago por ela).
 */
function ModalReceber({
  userId,
  item,
  hoje,
  salvando,
  onClose,
  onConfirmar,
}: {
  userId: string;
  item: ItemAReceber;
  hoje: string;
  salvando: boolean;
  onClose: () => void;
  /** `valorRecebido` vem undefined quando bate com o combinado. */
  onConfirmar: (data: string, valorRecebido?: number, forma?: FormaRecebimento | null) => void;
}) {
  const ehConta = item.tipo === "conta";
  const original = item.valor;
  const taxas = useTaxas(ehConta ? userId : undefined);
  const [data, setData] = useState(hoje);
  const [forma, setForma] = useState<FormaRecebimento | "">("");
  const [cents, setCents] = useState(() => Math.round(original * 100));
  // Valor digitado por ela não é sobrescrito pela taxa da forma.
  const [valorDigitado, setValorDigitado] = useState(false);
  const valorRecebido = cents / 100;
  const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(data) && data <= hoje;
  const valorValido = cents > 0 && valorRecebido <= 99_999_999;
  const diferenca = ehConta ? fraseDiferencaRecebida(original, valorRecebido) : "";

  const escolherForma = (nova: FormaRecebimento | "") => {
    setForma(nova);
    if (valorDigitado) return;
    const regra = nova ? taxas.data?.[nova] : undefined;
    setCents(Math.round(valorQueDeveCair(original, regra) * 100));
  };

  const onValorChange = (e: ChangeEvent<HTMLInputElement>) => {
    const digitos = e.target.value.replace(/\D/g, "");
    setCents(digitos ? Number(digitos.slice(0, 11)) : 0);
    setValorDigitado(true);
  };

  const titulo = item.tipo === "conta" ? item.conta.descricao : `venda de ${fmt(original)}`;

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={`Recebi: ${titulo}`}
      description={
        ehConta
          ? `O combinado é ${fmt(original)}. O que caiu de fato entra como entrada no mês da data escolhida.`
          : `${fmt(original)} entram como entrada no mês da data escolhida, já sem a taxa e o frete da venda.`
      }
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirmar(
                data,
                ehConta && Math.round(original * 100) !== cents ? valorRecebido : undefined,
                ehConta && forma ? forma : null,
              )
            }
            disabled={salvando || !dataValida || (ehConta && !valorValido)}
            className={BTN_ACAO}
          >
            {salvando ? "Marcando..." : "Marcar como recebido"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Recebi em"
          required
          error={data > hoje ? "A data do recebimento não pode ser depois de hoje" : undefined}
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
        {ehConta && (
          <Campo label="Forma de recebimento" hint="opcional, puxa a taxa cadastrada em Vendas">
            <select
              value={forma}
              onChange={(e) => escolherForma(e.target.value as FormaRecebimento | "")}
              className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            >
              <option value="">Não informar</option>
              {FORMAS_RECEBIMENTO.map((f) => (
                <option key={f} value={f}>
                  {ROTULO_TAXA[f]}
                </option>
              ))}
            </select>
          </Campo>
        )}
      </div>
      {ehConta && (
        <div className="mt-4 sm:max-w-[50%] sm:pr-2">
          <Campo
            label="Valor que caiu (R$)"
            required
            error={cents === 0 ? "Falta o valor recebido" : undefined}
            hint={diferenca || "igual ao combinado"}
          >
            <input
              type="text"
              inputMode="numeric"
              value={
                cents
                  ? valorRecebido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : ""
              }
              onChange={onValorChange}
              placeholder="R$ 0,00"
              className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-right text-[18px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            />
          </Campo>
        </div>
      )}
    </Modal>
  );
}
