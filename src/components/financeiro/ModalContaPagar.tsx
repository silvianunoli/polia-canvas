import { useId, useMemo, useState, type ChangeEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Campo } from "@/components/ui/Campo";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { CATEGORIAS_SAIDA } from "@/lib/categoriasLancamento";
import { track } from "@/lib/analytics";
import { formatarReais } from "@/lib/formatarReais";
import { FORMAS_SAIDA, ROTULO_FORMA_LANCAMENTO, type FormaLancamento } from "@/lib/formas";
import {
  dividirEmParcelas,
  MAX_PARCELAS,
  rotuloDaParcela,
  validarConta,
  type ContaPagar,
  type ErroConta,
} from "@/lib/contasPagar";
import { categoriaParaSalvar, clicarCategoria, type SelecaoCategoria } from "./categoriaLancamento";
import { salvarConta } from "./contasPagarDados";

const MENSAGEM_ERRO: Record<ErroConta, string> = {
  sem_descricao: "Falta dizer que conta é essa",
  sem_valor: "Falta o valor",
  sem_vencimento: "Falta o vencimento",
  valor_alto: "Esse valor passou do limite. Confere os zeros.",
  parcelas_fora: `Parcelas: de 2 a ${MAX_PARCELAS}`,
  parcela_sem_valor: "O valor não dá um centavo por parcela",
};

const CLASSE_INPUT =
  "w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

const fmt = (v: number) => formatarReais(v, { sempreCentavos: true });
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

// Mesmo botão e mesma regra de seleção do ModalLancamento (categoriaLancamento.ts).
const NOVA_CATEGORIA = "+ nova categoria";

/**
 * Nova conta a pagar ou edição de uma a pagar (ONE-127). Conta paga não abre
 * aqui: o valor já virou saída no Financeiro, corrige desfazendo o pagamento.
 */
export function ModalContaPagar({
  userId,
  vencimentoPadrao,
  contaEdit,
  categoriasDoHistorico,
  fornecedoresConhecidos,
  onClose,
  onSaved,
}: {
  userId: string;
  vencimentoPadrao: string;
  contaEdit: ContaPagar | null;
  /**
   * Categorias de saída que ela já usa no Financeiro. Com só a lista padrão,
   * quem lança aluguel em "Ateliê" não achava a categoria aqui, e a saída do
   * "Paguei" caía em outra categoria no histórico.
   */
  categoriasDoHistorico: string[];
  /** Fornecedores das contas já cadastradas, pra sugerir sem redigitar. */
  fornecedoresConhecidos: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const edit = !!contaEdit;
  const categoriaLabelId = useId();
  const faltaId = useId();
  const listaFornecedoresId = useId();
  const [descricao, setDescricao] = useState(contaEdit?.descricao ?? "");
  const [cents, setCents] = useState(() => (contaEdit ? Math.round(contaEdit.valor * 100) : 0));
  const [vencimento, setVencimento] = useState(contaEdit?.vencimento ?? vencimentoPadrao);
  const [selecao, setSelecao] = useState<SelecaoCategoria>({
    categoria: contaEdit?.categoria ?? "",
    novaAberta: false,
    novaTexto: "",
  });
  const [fornecedor, setFornecedor] = useState(contaEdit?.fornecedor ?? "");
  const [documento, setDocumento] = useState(contaEdit?.documento ?? "");
  const [forma, setForma] = useState<FormaLancamento | "">(contaEdit?.forma ?? "");
  const [mensal, setMensal] = useState(contaEdit?.recorrencia === "mensal");
  // Parcelar só na criação: editar uma parcela não refaz o parcelamento.
  const [parcelado, setParcelado] = useState(false);
  const [numParcelas, setNumParcelas] = useState("2");
  const ehParcela = !!contaEdit?.parcelas;
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const categorias = useMemo(() => {
    const unidas = [...categoriasDoHistorico];
    for (const s of CATEGORIAS_SAIDA) if (!unidas.includes(s)) unidas.push(s);
    // Categoria da conta editada que não está em nenhuma das listas continua visível.
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
    const resultado = await salvarConta(
      userId,
      {
        descricao,
        valor,
        vencimento,
        categoria: categoriaParaSalvar(selecao),
        recorrencia: mensal && !parcelado && !ehParcela ? "mensal" : "nenhuma",
        fornecedor,
        documento,
        forma: forma || null,
        parcelas,
      },
      contaEdit?.id,
    );
    setSalvando(false);
    if (resultado === "ja_paga") {
      setErro("Essa conta já foi marcada como paga. Pra mudar, desfaz o pagamento antes.");
      return;
    }
    if (resultado === "erro") {
      setErro("A Pólia One não conseguiu salvar a conta agora. Tenta de novo.");
      return;
    }
    track(edit ? "conta_pagar_editada" : "conta_pagar_criada", {
      mensal,
      parcelas: parcelas ?? 0,
      com_fornecedor: !!fornecedor.trim(),
      com_documento: !!documento.trim(),
      forma: forma || "nao_informada",
    });
    onSaved();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={edit ? "Editar conta a pagar" : "Nova conta a pagar"}
      description="A conta só vira saída no Financeiro quando você marca como paga."
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
        <Campo label="Que conta é essa" required>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            maxLength={120}
            autoFocus
            placeholder="ex: aluguel do ateliê"
            className={CLASSE_INPUT}
          />
        </Campo>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Campo label="Fornecedor" hint="opcional, quem recebe">
          <input
            value={fornecedor}
            onChange={(e) => setFornecedor(e.target.value)}
            maxLength={80}
            list={listaFornecedoresId}
            autoComplete="off"
            placeholder="ex: atacado da esquina"
            className={CLASSE_INPUT}
          />
        </Campo>
        <datalist id={listaFornecedoresId}>
          {fornecedoresConhecidos.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        <Campo label="Documento" hint="opcional, nota, boleto ou ID do Pix">
          <input
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            maxLength={80}
            placeholder="ex: NF-e 95308"
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
        <Campo label={parcelado ? "Primeira parcela vence em" : "Vence em"} required>
          <input
            type="date"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
            className={CLASSE_INPUT}
          />
        </Campo>
      </div>

      <div className="mb-4 sm:max-w-[50%] sm:pr-2">
        <Campo label="Forma de pagamento" hint="opcional, como você costuma pagar essa conta">
          <select
            value={forma}
            onChange={(e) => setForma(e.target.value as FormaLancamento | "")}
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
          >
            <option value="">Não informar</option>
            {FORMAS_SAIDA.map((f) => (
              <option key={f} value={f}>
                {ROTULO_FORMA_LANCAMENTO[f]}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {ehParcela && contaEdit ? (
        <p className="mb-4 text-[13px] text-[var(--muted)]">
          Esta é a {rotuloDaParcela(contaEdit)}. Mudar aqui muda só esta parcela.
        </p>
      ) : (
        <>
          <label className="mb-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink-soft)]">
            <input
              type="checkbox"
              checked={mensal}
              onChange={(e) => {
                setMensal(e.target.checked);
                if (e.target.checked) setParcelado(false);
              }}
              className="h-4 w-4 accent-[var(--secondary-text)]"
            />
            <span>
              Repete todo mês
              <span className="block text-[12px] text-[var(--muted)]">
                Ao pagar, a Pólia One já deixa a do mês seguinte agendada.
              </span>
            </span>
          </label>

          {!edit && (
            <div className="mb-4 rounded-lg border border-[var(--line)] bg-white px-3 py-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] text-[var(--ink-soft)]">
                <input
                  type="checkbox"
                  checked={parcelado}
                  onChange={(e) => {
                    setParcelado(e.target.checked);
                    if (e.target.checked) setMensal(false);
                  }}
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
          )}
        </>
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
