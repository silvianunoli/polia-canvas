import { useId, useMemo, useState, type ChangeEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Campo } from "@/components/ui/Campo";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { CATEGORIAS_ENTRADA } from "@/lib/categoriasLancamento";
import { track } from "@/lib/analytics";
import { formatarReais } from "@/lib/formatarReais";
import {
  dividirEmParcelas,
  MAX_PARCELAS,
  rotuloDaParcela,
  validarConta,
  type ErroConta,
} from "@/lib/contasPagar";
import type { ContaReceber } from "@/lib/contasReceber";
import { categoriaParaSalvar, clicarCategoria, type SelecaoCategoria } from "./categoriaLancamento";
import { salvarContaReceber } from "./contasReceberDados";

const MENSAGEM_ERRO: Record<ErroConta, string> = {
  sem_descricao: "Falta dizer o que vai receber",
  sem_valor: "Falta o valor",
  sem_vencimento: "Falta a data combinada",
  valor_alto: "Esse valor passou do limite. Confere os zeros.",
  parcelas_fora: `Parcelas: de 2 a ${MAX_PARCELAS}`,
  parcela_sem_valor: "O valor não dá um centavo por parcela",
};

const CLASSE_INPUT =
  "w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

const NOVA_CATEGORIA = "+ nova categoria";
const fmt = (v: number) => formatarReais(v, { sempreCentavos: true });
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Nova conta a receber ou edição de uma em aberto (ONE-207 Fase 2). Conta
 * recebida não abre aqui: o valor já virou entrada, corrige desfazendo.
 */
export function ModalContaReceber({
  userId,
  vencimentoPadrao,
  contaEdit,
  categoriasDoHistorico,
  clientesConhecidos,
  onClose,
  onSaved,
}: {
  userId: string;
  vencimentoPadrao: string;
  contaEdit: ContaReceber | null;
  /** Categorias de entrada que ela já usa no Financeiro. */
  categoriasDoHistorico: string[];
  /** Nomes de clientes já usados, pra sugerir sem redigitar. */
  clientesConhecidos: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const edit = !!contaEdit;
  const categoriaLabelId = useId();
  const faltaId = useId();
  const listaClientesId = useId();
  const [descricao, setDescricao] = useState(contaEdit?.descricao ?? "");
  const [cliente, setCliente] = useState(contaEdit?.cliente ?? "");
  const [documento, setDocumento] = useState(contaEdit?.documento ?? "");
  const [cents, setCents] = useState(() => (contaEdit ? Math.round(contaEdit.valor * 100) : 0));
  const [vencimento, setVencimento] = useState(contaEdit?.vencimento ?? vencimentoPadrao);
  const [selecao, setSelecao] = useState<SelecaoCategoria>({
    categoria: contaEdit?.categoria ?? "",
    novaAberta: false,
    novaTexto: "",
  });
  const [parcelado, setParcelado] = useState(false);
  const [numParcelas, setNumParcelas] = useState("2");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const categorias = useMemo(() => {
    const unidas = [...categoriasDoHistorico];
    for (const s of CATEGORIAS_ENTRADA) if (!unidas.includes(s)) unidas.push(s);
    if (contaEdit?.categoria && !unidas.includes(contaEdit.categoria))
      unidas.unshift(contaEdit.categoria);
    return unidas;
  }, [categoriasDoHistorico, contaEdit?.categoria]);

  const valor = cents / 100;
  const parcelas = parcelado ? Number(numParcelas) : undefined;
  const problema = validarConta({ descricao, valor, vencimento, parcelas });
  const previa =
    parcelado && !problema && parcelas ? dividirEmParcelas(valor, parcelas, vencimento) : null;
  const moedaFmt = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const onValorChange = (e: ChangeEvent<HTMLInputElement>) => {
    const digitos = e.target.value.replace(/\D/g, "");
    setCents(digitos ? Number(digitos.slice(0, 11)) : 0);
  };

  const salvar = async () => {
    if (problema) return;
    setSalvando(true);
    setErro(null);
    const resultado = await salvarContaReceber(
      userId,
      {
        descricao,
        valor,
        vencimento,
        categoria: categoriaParaSalvar(selecao),
        cliente,
        documento,
        parcelas,
      },
      contaEdit?.id,
    );
    setSalvando(false);
    if (resultado === "ja_recebida") {
      setErro("Essa conta já foi marcada como recebida. Pra mudar, desfaz o recebimento antes.");
      return;
    }
    if (resultado === "erro") {
      setErro("A Pólia One não conseguiu salvar a conta agora. Tenta de novo.");
      return;
    }
    track(edit ? "conta_receber_editada" : "conta_receber_criada", {
      parcelas: parcelas ?? 0,
      com_cliente: !!cliente.trim(),
      com_documento: !!documento.trim(),
    });
    onSaved();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={edit ? "Editar conta a receber" : "Nova conta a receber"}
      description="A conta só vira entrada no Financeiro quando você marca como recebida."
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !!problema}
            aria-describedby={problema ? faltaId : undefined}
            className={BTN_ACAO}
          >
            {salvando ? "Salvando..." : edit ? "Salvar alterações" : "Salvar conta"}
          </button>
        </>
      }
    >
      <div className="mb-4">
        <Campo label="O que vai receber" required>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            maxLength={120}
            autoFocus
            placeholder="ex: resto da encomenda do bolo"
            className={CLASSE_INPUT}
          />
        </Campo>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Campo label="Cliente" hint="opcional, quem vai pagar">
          <input
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            maxLength={80}
            list={listaClientesId}
            autoComplete="off"
            placeholder="ex: Ana"
            className={CLASSE_INPUT}
          />
        </Campo>
        <datalist id={listaClientesId}>
          {clientesConhecidos.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Campo label="Documento" hint="opcional, nota, recibo ou número do pedido">
          <input
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            maxLength={80}
            placeholder="ex: pedido 128"
            className={CLASSE_INPUT}
          />
        </Campo>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Campo label={parcelado ? "Valor total (R$)" : "Valor (R$)"} required>
          <input
            type="text"
            inputMode="numeric"
            value={cents ? moedaFmt : ""}
            onChange={onValorChange}
            placeholder="R$ 0,00"
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-right text-[18px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
          />
        </Campo>
        <Campo label={parcelado ? "Primeira parcela vence em" : "Combinado pra"} required>
          <input
            type="date"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
            className={CLASSE_INPUT}
          />
        </Campo>
      </div>

      {contaEdit?.parcelas ? (
        <p className="mb-4 text-[13px] text-[var(--muted)]">
          Esta é a {rotuloDaParcela(contaEdit)}. Mudar aqui muda só esta parcela.
        </p>
      ) : (
        !edit && (
          <div className="mb-4 rounded-lg border border-[var(--line)] bg-white px-3 py-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] text-[var(--ink-soft)]">
              <input
                type="checkbox"
                checked={parcelado}
                onChange={(e) => setParcelado(e.target.checked)}
                className="h-4 w-4 accent-[var(--secondary-text)]"
              />
              <span>
                Dividir em parcelas
                <span className="block text-[12px] text-[var(--muted)]">
                  Uma conta por mês, no mesmo dia, até a última parcela.
                </span>
              </span>
            </label>
            {parcelado && (
              <div className="mt-2 pb-2">
                <Campo label="Quantas parcelas" required>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={2}
                    max={MAX_PARCELAS}
                    step={1}
                    value={numParcelas}
                    onChange={(e) => setNumParcelas(e.target.value)}
                    className={`${CLASSE_INPUT} max-w-[120px]`}
                  />
                </Campo>
                {previa && (
                  <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
                    {previa.length} parcelas de {fmt(previa[previa.length - 1].valor)}
                    {previa[0].valor !== previa[previa.length - 1].valor &&
                      ` (a primeira de ${fmt(previa[0].valor)})`}
                    , a última vence em {dataBr(previa[previa.length - 1].vencimento)}.
                  </p>
                )}
              </div>
            )}
          </div>
        )
      )}

      <div>
        <span id={categoriaLabelId} className="mb-1 block text-[12px] text-[var(--muted)]">
          Categoria
        </span>
        <div role="group" aria-labelledby={categoriaLabelId} className="flex flex-wrap gap-2">
          {categorias.map((c) => {
            const marcada = !selecao.novaAberta && selecao.categoria === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setSelecao((a) => clicarCategoria(a, { tipo: "chip", valor: c }))}
                aria-pressed={marcada}
                className={`${BTN_MIUDO} ${marcada ? "!bg-[var(--secondary)]" : "bg-white"}`}
              >
                {c}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSelecao((a) => clicarCategoria(a, { tipo: "nova" }))}
            aria-pressed={selecao.novaAberta}
            className={`${BTN_MIUDO} ${selecao.novaAberta ? "!bg-[var(--secondary)]" : "bg-white"}`}
          >
            {NOVA_CATEGORIA}
          </button>
        </div>
        {selecao.novaAberta && (
          <div className="mt-2">
            <Campo label="Nome da categoria">
              <input
                autoFocus
                value={selecao.novaTexto}
                onChange={(e) => {
                  const novaTexto = e.target.value;
                  setSelecao((a) => ({ ...a, novaTexto }));
                }}
                placeholder="Nome da categoria"
                maxLength={40}
                className={CLASSE_INPUT}
              />
            </Campo>
          </div>
        )}
      </div>

      <p id={faltaId} aria-live="polite" className="mt-4 text-[13px] text-[var(--muted)]">
        {problema ? MENSAGEM_ERRO[problema] : ""}
      </p>
      {erro && (
        <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
          {erro}
        </p>
      )}
    </Modal>
  );
}
