import { useId, useMemo, useState, type ChangeEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Campo } from "@/components/ui/Campo";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { CATEGORIAS_SAIDA } from "@/lib/categoriasLancamento";
import { track } from "@/lib/analytics";
import { validarConta, type ContaPagar, type ErroConta } from "@/lib/contasPagar";
import { categoriaParaSalvar, clicarCategoria, type SelecaoCategoria } from "./categoriaLancamento";
import { salvarConta } from "./contasPagarDados";

const MENSAGEM_ERRO: Record<ErroConta, string> = {
  sem_descricao: "Falta dizer que conta é essa",
  sem_valor: "Falta o valor",
  sem_vencimento: "Falta o vencimento",
  valor_alto: "Esse valor passou do limite. Confere os zeros.",
};

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
  onClose: () => void;
  onSaved: () => void;
}) {
  const edit = !!contaEdit;
  const categoriaLabelId = useId();
  const faltaId = useId();
  const [descricao, setDescricao] = useState(contaEdit?.descricao ?? "");
  const [cents, setCents] = useState(() => (contaEdit ? Math.round(contaEdit.valor * 100) : 0));
  const [vencimento, setVencimento] = useState(contaEdit?.vencimento ?? vencimentoPadrao);
  const [selecao, setSelecao] = useState<SelecaoCategoria>({
    categoria: contaEdit?.categoria ?? "",
    novaAberta: false,
    novaTexto: "",
  });
  const [mensal, setMensal] = useState(contaEdit?.recorrencia === "mensal");
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
  const problema = validarConta({ descricao, valor, vencimento });
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
        recorrencia: mensal ? "mensal" : "nenhuma",
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
    track(edit ? "conta_pagar_editada" : "conta_pagar_criada", { mensal });
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
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
          />
        </Campo>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Campo label="Valor (R$)" required>
          <input
            type="text"
            inputMode="numeric"
            value={cents ? moedaFmt : ""}
            onChange={onValorChange}
            placeholder="R$ 0,00"
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-right text-[18px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
          />
        </Campo>
        <Campo label="Vence em" required>
          <input
            type="date"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
          />
        </Campo>
      </div>

      <label className="mb-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink-soft)]">
        <input
          type="checkbox"
          checked={mensal}
          onChange={(e) => setMensal(e.target.checked)}
          className="h-4 w-4 accent-[var(--secondary-text)]"
        />
        <span>
          Repete todo mês
          <span className="block text-[12px] text-[var(--muted)]">
            Ao pagar, a Pólia One já deixa a do mês seguinte agendada.
          </span>
        </span>
      </label>

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
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
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
