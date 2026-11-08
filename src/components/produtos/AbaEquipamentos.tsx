// Aba "Equipamentos" de Produtos (ONE-193). Ação principal: adicionar um
// equipamento. Planejado é orçamento: não vira saída, só conta na reserva.
// Comprado vira saída no Financeiro, fora do lucro do mês e dos custos fixos.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Wrench } from "lucide-react";
import { Vazio } from "@/components/layout/Vazio";
import { SeloCadeado } from "@/components/layout/UpgradeGate";
import { BlockError } from "@/components/ui/BlockError";
import { Campo } from "@/components/ui/Campo";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { Modal } from "@/components/ui/Modal";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO_ACAO } from "@/lib/botoes";
import { hojeISO } from "@/lib/data.functions";
import {
  erroDoValor,
  erroDosMeses,
  MESES_USO_PADRAO,
  reservaDoEquipamento,
  resumoEquipamentos,
  type Equipamento,
} from "@/lib/equipamentos";
import { tiersPagos, tierDosNumeros } from "@/lib/planos";
import { lerQuantidade, qtdNoCampo } from "@/lib/producao";
import { CATEGORIA_EQUIPAMENTO } from "@/lib/projecao.functions";
import { toastErro, toastSucesso } from "@/lib/toast";
import {
  arquivarEquipamento,
  chaveEquipamentos,
  desfazerCompra,
  marcarEquipamentoComprado,
  salvarEquipamento,
  useEquipamentos,
} from "./equipamentosDados";
import { fmt, fmtData } from "./tipos";

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

export function AbaEquipamentos({ userId, bloqueado }: { userId: string; bloqueado: boolean }) {
  const qc = useQueryClient();
  const query = useEquipamentos(userId, !bloqueado);
  const [editar, setEditar] = useState<Equipamento | "novo" | null>(null);
  const [comprar, setComprar] = useState<Equipamento | null>(null);
  const [desfazer, setDesfazer] = useState<Equipamento | null>(null);

  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: chaveEquipamentos(userId) });
    void qc.invalidateQueries({ queryKey: ["financeiro", userId] });
  };

  if (bloqueado) {
    const tier = tierDosNumeros();
    return (
      <div className="rounded-xl border border-[var(--line)] bg-white p-6 md:p-8">
        <SeloCadeado />
        <p className="max-w-[52ch] text-[15px] leading-relaxed text-[var(--ink-soft)]">
          A aba Equipamentos soma o que a marca investiu em máquinas e mostra quanto reservar por
          mês. A compra fica fora do lucro do mês em que foi paga.
        </p>
        <Link to="/upgrade" search={{ rota: "/produtos", tier }} className={`${BTN_ACAO} mt-6`}>
          Conhecer o {tiersPagos()[tier].titulo}
        </Link>
      </div>
    );
  }
  if (query.isError) {
    return (
      <div role="alert">
        <BlockError
          message="A Pólia One não conseguiu ler os equipamentos agora. Nada foi perdido, é só a leitura que falhou."
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }
  if (query.isLoading) {
    return <p className="text-[14px] text-[var(--muted)]">Carregando os equipamentos…</p>;
  }

  const lista = query.data ?? [];
  const resumo = resumoEquipamentos(lista);

  const confirmarDesfazer = async () => {
    if (!desfazer?.lancamentoId) return;
    const { error } = await desfazerCompra(desfazer.lancamentoId);
    if (error) {
      console.error("equipamento_desfazer_compra", error);
      setDesfazer(null);
      toastErro("A Pólia One não conseguiu desfazer a compra. Tenta de novo.");
      return;
    }
    toastSucesso(`${desfazer.nome} voltou pra planejado.`);
    setDesfazer(null);
    recarregar();
  };

  return (
    <div>
      {lista.length === 0 ? (
        <Vazio
          icone={Wrench}
          titulo="Nenhum equipamento cadastrado."
          texto="Impressora, prensa, máquina de costura: o que a marca compra uma vez e usa por anos. Aqui o preço vira uma reserva por mês, e a compra não derruba o lucro do mês em que foi paga."
          acao={
            <button type="button" onClick={() => setEditar("novo")} className={BTN_ACAO}>
              Adicionar equipamento
            </button>
          }
        />
      ) : (
        <>
          <button type="button" onClick={() => setEditar("novo")} className={BTN_ACAO}>
            Adicionar equipamento
          </button>

          <dl className="mt-6 grid grid-cols-1 rounded-xl border border-[var(--line)] bg-white sm:grid-cols-3">
            <Numero rotulo="Investido até agora" valor={resumo.investido} />
            <Numero rotulo="Falta comprar" valor={resumo.faltaComprar} comLinha />
            <Numero rotulo="Reserva do mês" valor={resumo.reservaDoMes} comLinha />
          </dl>
          <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
            A reserva é o preço de cada equipamento dividido pelos meses de uso, somando os
            comprados e os planejados. Na Calculadora, esse número entra em Reserva de equipamento,
            nos custos fixos.
          </p>

          <ul className="mt-6 rounded-xl border border-[var(--line)] bg-white">
            {lista.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-3 border-t border-[var(--line)] p-4 first:border-t-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-[15px] font-medium text-[var(--ink)]">{e.nome}</p>
                  <p className="text-[13px] tabular-nums text-[var(--ink-soft)]">
                    {fmt(e.valor)} · {e.mesesUso} meses · reserva de {fmt(reservaDoEquipamento(e))}{" "}
                    por mês
                  </p>
                  <p className="text-[13px] text-[var(--muted)]">
                    {e.lancamentoId
                      ? `Comprado${e.compradoEm ? ` em ${fmtData(`${e.compradoEm}T12:00:00`)}` : ""}`
                      : "Planejado"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {e.lancamentoId ? (
                    <button
                      type="button"
                      onClick={() => setDesfazer(e)}
                      className={`${BTN_MIUDO_ACAO} bg-white`}
                    >
                      Desfazer compra
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setComprar(e)}
                      className={`${BTN_MIUDO_ACAO} bg-white`}
                    >
                      Marcar como comprado
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditar(e)}
                    className={`${BTN_MIUDO_ACAO} bg-white`}
                  >
                    Editar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {editar && (
        <ModalEquipamento
          equipamento={editar === "novo" ? null : editar}
          onClose={() => setEditar(null)}
          onSaved={() => {
            setEditar(null);
            recarregar();
          }}
        />
      )}
      {comprar && (
        <ModalCompra
          equipamento={comprar}
          onClose={() => setComprar(null)}
          onSaved={() => {
            setComprar(null);
            recarregar();
          }}
        />
      )}
      <ConfirmarAcao
        open={!!desfazer}
        onOpenChange={(aberto) => {
          if (!aberto) setDesfazer(null);
        }}
        titulo={`Desfazer a compra de ${desfazer?.nome ?? "equipamento"}?`}
        descricao={`A saída de ${fmt(desfazer?.valor ?? 0)} é excluída do Financeiro e o equipamento volta pra planejado.`}
        textoConfirmar="Desfazer compra"
        textoCarregando="Desfazendo…"
        destrutivo
        onConfirmar={confirmarDesfazer}
      />
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  comLinha = false,
}: {
  rotulo: string;
  valor: number;
  comLinha?: boolean;
}) {
  return (
    <div
      className={`p-4 ${comLinha ? "border-t border-[var(--line)] sm:border-l sm:border-t-0" : ""}`}
    >
      <dt className="font-accent text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
        {rotulo}
      </dt>
      <dd className="font-cabinet mt-1 text-[24px] font-semibold tabular-nums text-[var(--ink)]">
        {fmt(valor)}
      </dd>
    </div>
  );
}

function ModalEquipamento({
  equipamento,
  onClose,
  onSaved,
}: {
  equipamento: Equipamento | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(equipamento?.nome ?? "");
  const [valor, setValor] = useState(equipamento ? qtdNoCampo(equipamento.valor) : "");
  const [meses, setMeses] = useState(String(equipamento?.mesesUso ?? MESES_USO_PADRAO));
  const [mostrarErros, setMostrarErros] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [confirmarArquivar, setConfirmarArquivar] = useState(false);

  const valorNum = lerQuantidade(valor);
  const mesesNum = lerQuantidade(meses);
  const erroNome = !nome.trim() ? "Dê um nome pro equipamento." : undefined;
  const erroValor = erroDoValor(valorNum);
  const erroMeses = erroDosMeses(mesesNum);
  const temErro = !!(erroNome || erroValor || erroMeses);
  const comprado = !!equipamento?.lancamentoId;

  const salvar = async () => {
    if (temErro) {
      setMostrarErros(true);
      return;
    }
    setSalvando(true);
    setErroServidor(null);
    const { error } = await salvarEquipamento({
      id: equipamento?.id ?? null,
      nome: nome.trim(),
      valor: valorNum,
      meses: mesesNum,
    });
    setSalvando(false);
    if (error) {
      console.error("equipamento_salvar", error);
      setErroServidor("A Pólia One não conseguiu salvar o equipamento. Tenta de novo.");
      return;
    }
    toastSucesso(equipamento ? "Equipamento atualizado." : `${nome.trim()} entrou na lista.`);
    onSaved();
  };

  const arquivar = async () => {
    if (!equipamento) return;
    const { error } = await arquivarEquipamento(equipamento.id);
    if (error) {
      console.error("equipamento_arquivar", error);
      setConfirmarArquivar(false);
      setErroServidor("A Pólia One não conseguiu arquivar o equipamento. Tenta de novo.");
      return;
    }
    toastSucesso(`${equipamento.nome} saiu da lista.`);
    onSaved();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={equipamento ? "Editar equipamento" : "Novo equipamento"}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
            Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={salvando} className={BTN_ACAO}>
            {salvando ? "Salvando…" : "Salvar equipamento"}
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
              placeholder="ex: Impressora térmica"
            />
          </Campo>
        </div>
        <Campo
          label="Preço (R$)"
          required
          hint={comprado ? "A saída no Financeiro acompanha o preço novo." : undefined}
          error={mostrarErros ? erroValor : undefined}
        >
          <input
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className={INPUT}
            placeholder="1359,00"
          />
        </Campo>
        <Campo
          label="Meses de uso"
          required
          hint="Quanto tempo deve durar. 36 meses são 3 anos."
          error={mostrarErros ? erroMeses : undefined}
        >
          <input
            inputMode="numeric"
            value={meses}
            onChange={(e) => setMeses(e.target.value)}
            className={INPUT}
          />
        </Campo>
      </div>
      {/* Sempre montado: o leitor de tela só anuncia região viva que já existia. */}
      <p className="mt-4 min-h-[21px] text-[14px] text-[var(--ink-soft)]" aria-live="polite">
        {!erroValor && !erroMeses
          ? `Reserva de ${fmt(reservaDoEquipamento({ valor: valorNum, mesesUso: mesesNum }))} por mês.`
          : ""}
      </p>
      {equipamento && (
        <button
          type="button"
          onClick={() => setConfirmarArquivar(true)}
          className="mt-2 inline-flex min-h-11 items-center text-[13px] font-medium text-[var(--danger)] hover:underline"
        >
          Arquivar equipamento
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
        titulo={`Arquivar ${equipamento?.nome ?? "equipamento"}?`}
        descricao={
          comprado
            ? "Ele sai da lista e da reserva do mês. A saída no Financeiro continua lá."
            : "Ele sai da lista e da reserva do mês."
        }
        textoConfirmar="Arquivar"
        textoCarregando="Arquivando…"
        destrutivo
        onConfirmar={arquivar}
      />
    </Modal>
  );
}

function ModalCompra({
  equipamento,
  onClose,
  onSaved,
}: {
  equipamento: Equipamento;
  onClose: () => void;
  onSaved: () => void;
}) {
  const hoje = hojeISO();
  const [data, setData] = useState(hoje);
  const [valor, setValor] = useState(qtdNoCampo(equipamento.valor));
  const [mostrarErros, setMostrarErros] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | null>(null);

  const valorNum = lerQuantidade(valor);
  const erroValor = erroDoValor(valorNum);
  const erroData = !data || data > hoje ? "Coloque a data da compra, até hoje." : undefined;

  const salvar = async () => {
    if (erroValor || erroData) {
      setMostrarErros(true);
      return;
    }
    setSalvando(true);
    setErroServidor(null);
    const { error } = await marcarEquipamentoComprado({
      id: equipamento.id,
      data,
      valor: valorNum,
    });
    setSalvando(false);
    if (error?.code === "23505") {
      // Comprado em outra aba ou no celular: tentar de novo nunca passaria.
      toastSucesso(`${equipamento.nome} já está como comprado.`);
      onSaved();
      return;
    }
    if (error) {
      console.error("equipamento_comprar", error);
      setErroServidor("A Pólia One não conseguiu registrar a compra. Tenta de novo.");
      return;
    }
    toastSucesso(`Compra de ${equipamento.nome} registrada no Financeiro.`);
    onSaved();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={`Comprou ${equipamento.nome}?`}
      description={`A saída entra no Financeiro em "${CATEGORIA_EQUIPAMENTO}" e fica fora do lucro do mês e dos custos fixos.`}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
            Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={salvando} className={BTN_ACAO}>
            {salvando ? "Salvando…" : "Registrar compra"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Data da compra" required error={mostrarErros ? erroData : undefined}>
          <input
            type="date"
            value={data}
            max={hoje}
            onChange={(e) => setData(e.target.value)}
            className={INPUT}
          />
        </Campo>
        <Campo label="Quanto pagou (R$)" required error={mostrarErros ? erroValor : undefined}>
          <input
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className={INPUT}
          />
        </Campo>
      </div>
      {erroServidor && (
        <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
          {erroServidor}
        </p>
      )}
    </Modal>
  );
}
