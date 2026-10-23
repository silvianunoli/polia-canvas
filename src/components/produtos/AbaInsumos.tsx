// Aba "Insumos e produção" de Produtos (ONE-133): o material com estoque, a
// receita de cada produto e o botão de registrar produção. Mesmo desenho da
// aba Estoque: saldo é soma de movimentos, nada aqui sobrescreve número.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { Vazio } from "@/components/layout/Vazio";
import { BlockError } from "@/components/ui/BlockError";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO_ACAO } from "@/lib/botoes";
import { toastSucesso } from "@/lib/toast";
import {
  arred3,
  fmtCustoUnitario,
  fmtQtd,
  insumoBaixo,
  lerQuantidade,
  type InsumoComSaldo,
} from "@/lib/producao";
import { fmtData } from "./tipos";
import {
  chaveInsumos,
  movimentarInsumo,
  useInsumos,
  useMovimentosInsumo,
  type MovimentoInsumo,
  type TipoMovimentoInsumo,
} from "./insumosDados";
import { ModalInsumo } from "./ModalInsumo";
import { ReceitasProdutos } from "./ReceitasProdutos";
import { ModalProducao, ProducoesRecentes } from "./ModalProducao";

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

export function AbaInsumos({
  userId,
  onAbrirCatalogo,
}: {
  userId: string;
  onAbrirCatalogo: () => void;
}) {
  const qc = useQueryClient();
  const query = useInsumos(userId);
  const [editar, setEditar] = useState<InsumoComSaldo | "novo" | null>(null);
  const [movimentar, setMovimentar] = useState<InsumoComSaldo | null>(null);
  const [historico, setHistorico] = useState<InsumoComSaldo | null>(null);
  const [produzir, setProduzir] = useState(false);

  const insumos = query.data ?? [];
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: chaveInsumos(userId) });
    void qc.invalidateQueries({ queryKey: ["insumo-movimentos"] });
  };

  if (query.isError) {
    return (
      <div role="alert">
        <BlockError
          message="A Pólia One não conseguiu ler os insumos agora. Nada foi perdido, é só a leitura que falhou."
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }
  if (query.isLoading) {
    return <p className="text-[14px] text-[var(--muted)]">Carregando os insumos…</p>;
  }

  return (
    <div>
      {insumos.length === 0 ? (
        <>
          <Vazio
            icone={Package}
            titulo="Nenhum insumo cadastrado."
            texto="Insumo é o material que vai em cada peça: cera, tecido, papel, embalagem. Com a receita de cada produto, a Pólia One baixa o que sai a cada produção e mostra quantas peças o material de hoje ainda dá. Se a Calculadora do produto já tem os materiais, monte a receita aqui embaixo e eles entram de lá."
            acao={
              <button type="button" onClick={() => setEditar("novo")} className={BTN_ACAO}>
                Cadastrar o primeiro insumo
              </button>
            }
          />
          <ReceitasProdutos userId={userId} insumos={insumos} onAbrirCatalogo={onAbrirCatalogo} />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setProduzir(true)} className={BTN_ACAO}>
              Registrar produção
            </button>
            <button type="button" onClick={() => setEditar("novo")} className={BTN_ACAO_CONTORNO}>
              + Novo insumo
            </button>
          </div>

          <h2 className="font-cabinet mt-6 text-[18px] font-semibold text-[var(--ink)]">Insumos</h2>
          {/* Celular: cartão empilhado, a ação principal sempre à vista. */}
          <ul className="mt-3 flex flex-col gap-3 sm:hidden">
            {insumos.map((i) => (
              <li key={i.id} className="rounded-xl border border-[var(--line)] bg-white p-4">
                <NomeComHistorico insumo={i} onAbrir={() => setHistorico(i)} />
                <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
                  <Saldo insumo={i} /> no estoque
                  {i.minimo > 0 && ` · mínimo ${fmtQtd(i.minimo)} ${i.unidade}`}
                </p>
                {i.custoUnitario != null && (
                  <p className="text-[13px] text-[var(--muted)]">
                    {fmtCustoUnitario(i.custoUnitario)} por {i.unidade}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMovimentar(i)}
                    className={`${BTN_MIUDO_ACAO} flex-1 bg-white`}
                  >
                    Entrada ou ajuste
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditar(i)}
                    className={`${BTN_MIUDO_ACAO} bg-white`}
                  >
                    Editar
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 hidden overflow-hidden rounded-xl border border-[var(--line)] bg-white sm:block">
            <table className="w-full text-left text-[14px]">
              <caption className="sr-only">Insumos e quanto tem de cada um</caption>
              <thead>
                <tr className="font-accent text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                  <th scope="col" className="px-4 py-3">
                    Insumo
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Em estoque
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Mínimo
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Custo
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {insumos.map((i) => (
                  <tr key={i.id} className="border-t border-[var(--line)]">
                    <td className="px-4 py-2">
                      <NomeComHistorico insumo={i} onAbrir={() => setHistorico(i)} />
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <Saldo insumo={i} />
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-[var(--ink-soft)]">
                      {i.minimo > 0 ? fmtQtd(i.minimo) : "não definido"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-[var(--ink-soft)]">
                      {i.custoUnitario != null
                        ? `${fmtCustoUnitario(i.custoUnitario)} / ${i.unidade}`
                        : "sem custo"}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setMovimentar(i)}
                        className={`${BTN_MIUDO_ACAO} bg-white`}
                      >
                        Entrada ou ajuste
                      </button>{" "}
                      <button
                        type="button"
                        onClick={() => setEditar(i)}
                        className={`${BTN_MIUDO_ACAO} bg-white`}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ReceitasProdutos userId={userId} insumos={insumos} onAbrirCatalogo={onAbrirCatalogo} />
          <ProducoesRecentes userId={userId} />
        </>
      )}

      {editar && (
        <ModalInsumo
          insumo={editar === "novo" ? null : editar}
          onClose={() => setEditar(null)}
          onSaved={() => {
            setEditar(null);
            recarregar();
          }}
        />
      )}
      {movimentar && (
        <ModalMovimentoInsumo
          insumo={movimentar}
          onClose={() => setMovimentar(null)}
          onSaved={() => {
            setMovimentar(null);
            recarregar();
          }}
        />
      )}
      {historico && <ModalHistoricoInsumo insumo={historico} onClose={() => setHistorico(null)} />}
      {produzir && (
        <ModalProducao userId={userId} insumos={insumos} onClose={() => setProduzir(false)} />
      )}
    </div>
  );
}

const OPCOES: { id: TipoMovimentoInsumo; label: string; dica: string }[] = [
  { id: "entrada", label: "Chegou material", dica: "Quanto chegou" },
  { id: "perda", label: "Perda", dica: "Quanto se perdeu" },
  { id: "ajuste", label: "Contagem", dica: "Quanto tem agora" },
];

function ModalMovimentoInsumo({
  insumo,
  onClose,
  onSaved,
}: {
  insumo: InsumoComSaldo;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tipo, setTipo] = useState<TipoMovimentoInsumo>("entrada");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroServidor, setErroServidor] = useState<string | null>(null);

  const valor = lerQuantidade(quantidade);
  const valido = valor >= 0;
  const delta = !valido
    ? 0
    : tipo === "entrada"
      ? valor
      : tipo === "perda"
        ? -valor
        : arred3(valor - insumo.saldo);
  const novoSaldo = arred3(insumo.saldo + delta);
  const opcao = OPCOES.find((o) => o.id === tipo)!;
  const u = insumo.unidade;

  const salvar = async () => {
    if (!valido) {
      setErro("Coloque um número.");
      return;
    }
    if (delta === 0) {
      setErro(
        tipo === "ajuste"
          ? "Já é o que está no estoque, nada a corrigir."
          : "A quantidade precisa ser maior que zero.",
      );
      return;
    }
    setSalvando(true);
    setErro(null);
    setErroServidor(null);
    const { data, error } = await movimentarInsumo({
      insumoId: insumo.id,
      tipo,
      quantidade: arred3(valor),
      motivo: motivo.trim() || null,
    });
    setSalvando(false);
    if (error) {
      console.error("insumo_movimentar", error);
      setErroServidor(
        error.message?.startsWith("Nada a mudar")
          ? "Já é o que está no estoque, nada a corrigir."
          : "A Pólia One não conseguiu salvar. O estoque não mudou, tenta de novo.",
      );
      return;
    }
    toastSucesso(`${insumo.nome}: agora tem ${fmtQtd(Number(data ?? novoSaldo))} ${u}.`);
    onSaved();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={insumo.nome}
      description={`Tem ${fmtQtd(insumo.saldo)} ${u} agora.`}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
            Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={salvando} className={BTN_ACAO}>
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </>
      }
    >
      <div role="group" aria-label="O que aconteceu" className="flex flex-wrap gap-2">
        {OPCOES.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={tipo === o.id}
            onClick={() => {
              setTipo(o.id);
              setErro(null);
            }}
            className={`${BTN_MIUDO_ACAO} ${tipo === o.id ? "!bg-[var(--secondary)]" : "bg-white"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Campo label={`${opcao.dica} (${u})`} required error={erro ?? undefined}>
          <input
            inputMode="decimal"
            value={quantidade}
            onChange={(e) => {
              setQuantidade(e.target.value);
              setErro(null);
            }}
            className={INPUT}
          />
        </Campo>
      </div>
      <div className="mt-4">
        <Campo label="Motivo" hint="opcional">
          <input
            value={motivo}
            maxLength={200}
            onChange={(e) => setMotivo(e.target.value)}
            className={INPUT}
            placeholder={
              tipo === "entrada"
                ? "ex: fornecedor, nota 123"
                : tipo === "perda"
                  ? "ex: derreteu no calor"
                  : "ex: contagem do fim do mês"
            }
          />
        </Campo>
      </div>
      {/* Sempre montado: o leitor de tela só anuncia região viva que já existia. */}
      <p className="mt-4 min-h-[21px] text-[14px] text-[var(--ink-soft)]" aria-live="polite">
        {valido && delta !== 0
          ? `Fica com ${fmtQtd(novoSaldo)} ${u}.${novoSaldo < 0 ? " Fica abaixo de zero: confira a quantidade." : ""}`
          : ""}
      </p>
      {erroServidor && (
        <p role="alert" className="mt-2 text-[13px] text-[var(--danger)]">
          {erroServidor}
        </p>
      )}
    </Modal>
  );
}

const TIPO_LABEL: Record<MovimentoInsumo["tipo"], string> = {
  entrada: "Entrada",
  producao: "Produção",
  perda: "Perda",
  ajuste: "Contagem",
  estorno: "Produção desfeita",
};

function ModalHistoricoInsumo({
  insumo,
  onClose,
}: {
  insumo: InsumoComSaldo;
  onClose: () => void;
}) {
  const query = useMovimentosInsumo(insumo.id);
  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={insumo.nome}
      description={`Tem ${fmtQtd(insumo.saldo)} ${insumo.unidade} agora. Os últimos 200 movimentos, do mais novo pro mais antigo.`}
    >
      {query.isLoading ? (
        <p className="text-[14px] text-[var(--muted)]">Carregando…</p>
      ) : query.isError ? (
        <p role="alert" className="text-[14px] text-[var(--danger)]">
          A Pólia One não conseguiu ler o histórico. Fecha e abre de novo.
        </p>
      ) : (query.data ?? []).length === 0 ? (
        <p className="text-[14px] text-[var(--ink-soft)]">Nenhum movimento ainda.</p>
      ) : (
        <ul className="text-[14px]">
          {(query.data ?? []).map((m) => (
            <li
              key={m.id}
              className="flex justify-between gap-3 border-t border-[var(--line)] py-2 first:border-t-0"
            >
              <span>
                <span className="text-[var(--ink)]">{TIPO_LABEL[m.tipo]}</span>
                <span className="block text-[12px] text-[var(--muted)]">
                  {fmtData(m.createdAt)}
                  {m.motivo ? ` · ${m.motivo}` : ""}
                </span>
              </span>
              <span className="tabular-nums text-[var(--ink)]">
                {m.quantidade > 0 ? `+${fmtQtd(m.quantidade)}` : fmtQtd(m.quantidade)}{" "}
                {insumo.unidade}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function NomeComHistorico({ insumo, onAbrir }: { insumo: InsumoComSaldo; onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="min-h-11 text-left text-[var(--ink)] underline-offset-2 hover:underline"
    >
      {insumo.nome}
      <span className="sr-only">, ver histórico</span>
    </button>
  );
}

function Saldo({ insumo }: { insumo: InsumoComSaldo }) {
  return (
    <>
      <span className={insumo.saldo < 0 ? "text-[var(--danger)]" : "text-[var(--ink)]"}>
        {fmtQtd(insumo.saldo)} {insumo.unidade}
      </span>
      {insumoBaixo(insumo) && (
        <span className="ml-2 text-[12px] text-[var(--ink-soft)]">baixo</span>
      )}
    </>
  );
}
