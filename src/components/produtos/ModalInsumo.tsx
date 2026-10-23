// Cadastro e edição de insumo (ONE-133). Usado na aba Insumos e na receita
// do produto ("Cadastrar insumo novo" sem sair da receita).

import { useState } from "react";
import { Campo } from "@/components/ui/Campo";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { Modal } from "@/components/ui/Modal";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { toastSucesso } from "@/lib/toast";
import { arred3, lerQuantidade, qtdNoCampo, type InsumoComSaldo } from "@/lib/producao";
import { arquivarInsumo, salvarInsumo } from "./insumosDados";

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

const UNIDADES = ["un", "g", "kg", "ml", "l", "m", "cm", "folhas", "pacotes"];

export function ModalInsumo({
  insumo,
  nomeInicial = "",
  onClose,
  onSaved,
}: {
  insumo: InsumoComSaldo | null;
  nomeInicial?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [nome, setNome] = useState(insumo?.nome ?? nomeInicial);
  const [unidade, setUnidade] = useState(insumo?.unidade ?? "");
  const [custo, setCusto] = useState(
    insumo?.custoUnitario != null ? qtdNoCampo(insumo.custoUnitario) : "",
  );
  const [minimo, setMinimo] = useState(insumo?.minimo ? qtdNoCampo(insumo.minimo) : "");
  const [inicial, setInicial] = useState("");
  const [mostrarErros, setMostrarErros] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [confirmarArquivar, setConfirmarArquivar] = useState(false);

  const custoNum = custo.trim() ? lerQuantidade(custo) : null;
  const minimoNum = minimo.trim() ? lerQuantidade(minimo) : 0;
  const inicialNum = inicial.trim() ? lerQuantidade(inicial) : 0;
  const erroNome = !nome.trim() ? "Dê um nome pro insumo." : undefined;
  const erroUnidade = !unidade.trim() ? "Diga em que unidade ele é contado." : undefined;
  const erroCusto =
    custoNum != null && !(custoNum >= 0)
      ? "Só o número, como 0,05, ou deixe em branco."
      : undefined;
  const erroMinimo = !(minimoNum >= 0) ? "Coloque um número, ou deixe em branco." : undefined;
  const erroInicial = !(inicialNum >= 0) ? "Coloque um número, ou deixe em branco." : undefined;
  const u = unidade.trim();
  // Trocar a unidade não converte nada: 2 kg viram 2 g. Melhor avisar.
  const mudouUnidade = !!insumo && !!u && u !== insumo.unidade;
  const temErro = !!(erroNome || erroUnidade || erroCusto || erroMinimo || erroInicial);

  const salvar = async () => {
    if (temErro) {
      setMostrarErros(true);
      return;
    }
    setSalvando(true);
    setErroServidor(null);
    const { data, error } = await salvarInsumo({
      id: insumo?.id ?? null,
      nome: nome.trim(),
      unidade: unidade.trim(),
      custo: custoNum,
      minimo: arred3(minimoNum),
      inicial: insumo ? 0 : arred3(inicialNum),
    });
    setSalvando(false);
    if (error || !data) {
      console.error("insumo_salvar", error);
      setErroServidor(
        error?.message?.includes("Já existe")
          ? "Já existe um insumo com esse nome. Use outro nome ou edite o que já existe."
          : "A Pólia One não conseguiu salvar o insumo. Tenta de novo.",
      );
      return;
    }
    toastSucesso(insumo ? "Insumo atualizado." : `${nome.trim()} entrou na lista de insumos.`);
    onSaved(data);
  };

  const arquivar = async () => {
    if (!insumo) return;
    const { error } = await arquivarInsumo(insumo.id);
    if (error) {
      console.error("insumo_arquivar", error);
      setConfirmarArquivar(false);
      setErroServidor(
        error.message?.startsWith("Esse insumo está na receita")
          ? `${error.message}. Tire ele da receita antes de arquivar.`
          : "A Pólia One não conseguiu arquivar o insumo. Tenta de novo.",
      );
      return;
    }
    toastSucesso(`${insumo.nome} saiu da lista. O histórico continua guardado.`);
    onSaved(insumo.id);
  };

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={insumo ? "Editar insumo" : "Novo insumo"}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
            Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={salvando} className={BTN_ACAO}>
            {salvando ? "Salvando…" : "Salvar insumo"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo label="Nome" required error={mostrarErros ? erroNome : undefined}>
            <input
              value={nome}
              maxLength={80}
              onChange={(e) => setNome(e.target.value)}
              className={INPUT}
              placeholder="ex: Cera de soja"
            />
          </Campo>
        </div>
        <Campo
          label="Contado em"
          required
          hint={
            mudouUnidade
              ? "O saldo e as receitas continuam com os mesmos números, só a unidade muda."
              : "un, g, m, folhas…"
          }
          error={mostrarErros ? erroUnidade : undefined}
        >
          <input
            value={unidade}
            maxLength={20}
            list="insumo-unidades"
            onChange={(e) => setUnidade(e.target.value)}
            className={INPUT}
            placeholder="ex: g"
          />
        </Campo>
        <datalist id="insumo-unidades">
          {UNIDADES.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <Campo
          label={`Custo por ${u || "unidade"} (R$)`}
          hint="Pacote de 1.000 g por R$ 50 dá 0,05 por g. Opcional."
          error={mostrarErros ? erroCusto : undefined}
        >
          <input
            inputMode="decimal"
            value={custo}
            onChange={(e) => setCusto(e.target.value)}
            className={INPUT}
            placeholder="0,05"
          />
        </Campo>
        <Campo
          label={`Avisar quando chegar a${u ? ` (${u})` : ""}`}
          hint="Opcional."
          error={mostrarErros ? erroMinimo : undefined}
        >
          <input
            inputMode="decimal"
            value={minimo}
            onChange={(e) => setMinimo(e.target.value)}
            className={INPUT}
            placeholder="0"
          />
        </Campo>
        {!insumo && (
          <Campo
            label={`Quanto tem hoje${u ? ` (${u})` : ""}`}
            hint="Entra como estoque inicial."
            error={mostrarErros ? erroInicial : undefined}
          >
            <input
              inputMode="decimal"
              value={inicial}
              onChange={(e) => setInicial(e.target.value)}
              className={INPUT}
              placeholder="0"
            />
          </Campo>
        )}
      </div>
      {insumo && (
        <button
          type="button"
          onClick={() => setConfirmarArquivar(true)}
          className="mt-4 inline-flex min-h-11 items-center text-[13px] font-medium text-[var(--danger)] hover:underline"
        >
          Arquivar insumo
        </button>
      )}
      {erroServidor && (
        <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
          {erroServidor}
        </p>
      )}
      <ConfirmarAcao
        open={confirmarArquivar}
        onOpenChange={setConfirmarArquivar}
        titulo={`Arquivar ${insumo?.nome ?? "insumo"}?`}
        descricao="Ele sai da lista e não entra em receita nova. O histórico de entradas e produções continua guardado."
        textoConfirmar="Arquivar"
        textoCarregando="Arquivando…"
        destrutivo
        onConfirmar={arquivar}
      />
    </Modal>
  );
}
