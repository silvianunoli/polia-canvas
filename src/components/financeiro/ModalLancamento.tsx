import { useId, useMemo, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { Modal } from "@/components/ui/Modal";
import { Campo } from "@/components/ui/Campo";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { categoriaParaSalvar, clicarCategoria, type SelecaoCategoria } from "./categoriaLancamento";
import { CATEGORIA_INSUMOS } from "@/lib/projecao.functions";
import { CATEGORIA_PRO_LABORE } from "@/lib/resumoContador.functions";
import { CATEGORIAS_DE_VENDA, dataNoMesDe, limitesDoMes } from "@/lib/numerosDoMes";

/**
 * Modal de registro de entrada/saída. Vive fora da rota /financeiro desde
 * 03/09/2026 (COPY-04) porque o Painel do plano Grátis também precisa dele: o
 * card do grátis promete "quanto já entrou e quanto falta pra fechar as contas
 * do mês", e sem poder registrar um lançamento esse painel mostrava R$ 0 pra
 * sempre. A AÇÃO de registrar é de todo plano; a TELA /financeiro (histórico
 * completo, filtros, período, os três números do mês, resumo pro contador)
 * continua sendo do Premium.
 *
 * Migrado pro <Modal> (Radix Dialog) em 28/09/2026: antes era um overlay
 * artesanal com framer-motion e listener de Escape na mão, sem role="dialog"
 * nem trava de foco. Segue o mesmo padrão já aplicado em ModalMeta
 * (src/routes/_authenticated/metas.tsx).
 */

export type RegistrarTipo = "entrada" | "saida";

export interface Lancamento {
  id: string;
  tipo: string;
  valor: number;
  data: string;
  descricao: string | null;
  categoria: string | null;
  created_at: string;
}

// Semente padrão pra usuárias novas; some assim que o histórico real tiver categorias.
// As duas de venda são as mesmas que o Painel conta em "Pedidos · mês".
const CATEGORIAS_ENTRADA = [...CATEGORIAS_DE_VENDA, "Outros"];
// Insumos e Pró-labore vêm das mesmas constantes que a Projeção usa pra tirar
// essas saídas dos custos fixos: renomear aqui sem renomear lá voltaria a
// contar insumo duas vezes no ponto de empate.
const CATEGORIAS_SAIDA = [
  CATEGORIA_INSUMOS,
  "Marketing",
  "Ferramentas e assinaturas",
  CATEGORIA_PRO_LABORE,
  "Outros",
];
const NOVA_CATEGORIA = "+ nova categoria";

export function ModalLancamento({
  userId,
  tipoInicial,
  dataPadrao,
  prefill,
  lancamentoEdit,
  historico,
  somenteMesCorrente = false,
  onClose,
  onSaved,
}: {
  userId: string;
  tipoInicial: RegistrarTipo;
  dataPadrao: string;
  prefill: { valor?: number; desc?: string; categoria?: string } | null;
  lancamentoEdit: Lancamento | null;
  historico: Lancamento[];
  /**
   * Plano Grátis (sem a tela /financeiro): a data fica presa ao mês de
   * `dataPadrao`. O Painel e o cartão "Entrou e saiu este mês" só mostram o
   * mês corrente, então um lançamento com data de outro mês sumia da tela
   * pra sempre, sem jeito de corrigir nem de excluir.
   */
  somenteMesCorrente?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const edit = !!lancamentoEdit;
  const tipoLabelId = useId();
  const categoriaLabelId = useId();
  const [tipo, setTipo] = useState<RegistrarTipo>(
    (lancamentoEdit?.tipo as RegistrarTipo) ?? tipoInicial,
  );
  // Campo de valor: os dígitos do texto digitado/colado/ditado viram centavos.
  const [cents, setCents] = useState(() => {
    const v = lancamentoEdit?.valor ?? prefill?.valor;
    return v ? Math.round(v * 100) : 0;
  });
  const [data, setData] = useState(lancamentoEdit?.data ?? dataPadrao);
  const [descricao, setDescricao] = useState(lancamentoEdit?.descricao ?? prefill?.desc ?? "");
  // Chip marcado e "+ nova categoria" num estado só: as duas escolhas se
  // excluem (regra em categoriaLancamento.ts, QA-28).
  // Entrada nova já vem como venda (ONE-102): sem categoria, a venda
  // registrada não contava em "Pedidos · mês" no Painel. Dá pra trocar.
  const categoriaPadrao = (t: RegistrarTipo) => (t === "entrada" ? CATEGORIAS_DE_VENDA[0] : "");
  const [selecao, setSelecao] = useState<SelecaoCategoria>(() => ({
    categoria:
      lancamentoEdit?.categoria ??
      prefill?.categoria ??
      (lancamentoEdit ? "" : categoriaPadrao(tipoInicial)),
    novaAberta: false,
    novaTexto: "",
  }));
  const { categoria, novaAberta: novaCategoriaAberta, novaTexto: novaCategoriaTexto } = selecao;
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const valorNum = cents / 100;

  // Categorias derivadas do histórico real da usuária, unidas com semente padrão pra quem é nova.
  const categorias = useMemo(() => {
    const semente = tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
    const doHistorico = [
      ...new Set(
        historico
          .filter((l) => l.tipo === tipo && l.categoria && l.categoria.trim())
          .map((l) => l.categoria!.trim()),
      ),
    ];
    const unidas = [...doHistorico];
    for (const s of semente) if (!unidas.includes(s)) unidas.push(s);
    return unidas;
  }, [historico, tipo]);

  const trocarTipo = (t: RegistrarTipo) => {
    setTipo(t);
    // categorias dependem do tipo; volta pro padrão do tipo ao trocar
    setSelecao({ categoria: edit ? "" : categoriaPadrao(t), novaAberta: false, novaTexto: "" });
  };

  const escolherCategoria = (c: string) => {
    setSelecao((atual) =>
      clicarCategoria(atual, c === NOVA_CATEGORIA ? { tipo: "nova" } : { tipo: "chip", valor: c }),
    );
  };

  const moedaFmt = (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Extrai os dígitos do texto atual do campo e usa como centavos — funciona
  // com dígito digitado, colar (Ctrl/Cmd+V), setas, seleção e ditado por voz,
  // ao contrário do bloqueio de tecla anterior no onKeyDown.
  const onValorChange = (e: ChangeEvent<HTMLInputElement>) => {
    const digitos = e.target.value.replace(/\D/g, "");
    setCents(digitos ? Number(digitos) : 0);
  };

  const categoriaFinal = categoriaParaSalvar(selecao);

  const limites = somenteMesCorrente && dataPadrao ? limitesDoMes(dataPadrao) : null;
  const dataForaDoMes = !!limites && !!data && !dataNoMesDe(data, dataPadrao);

  // Descrição e categoria são opcionais: dá pra registrar só o valor em 2 toques.
  // Data vazia (o campo nativo deixa apagar) caía no erro genérico do banco.
  const faltaMsg = !cents
    ? "Falta o valor"
    : !data
      ? "Falta a data"
      : dataForaDoMes
        ? "Escolha uma data deste mês"
        : "";

  const salvar = async () => {
    if (faltaMsg) return;
    setSalvando(true);
    setErro(null);
    const payload = {
      tipo,
      valor: valorNum,
      data,
      descricao: descricao.trim() || null,
      categoria: categoriaFinal,
    };
    const { error } =
      edit && lancamentoEdit
        ? await supabase.from("lancamentos").update(payload).eq("id", lancamentoEdit.id)
        : await supabase.from("lancamentos").insert({ user_id: userId, ...payload });
    setSalvando(false);
    if (error) {
      // O erro do banco vem em inglês técnico: fica no log, não na tela.
      console.error("lancamento_salvar", error);
      setErro("A Pólia One não conseguiu salvar o lançamento agora. Tenta de novo.");
      return;
    }
    track(edit ? "lancamento_editado" : "lancamento_criado", { tipo });
    if (!edit) {
      void registrar("feature_completed", {
        feature: "financeiro",
        propriedades: { acao: "lancamento", tipo },
      });
    }
    onSaved();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={edit ? "Editar lançamento" : "Novo lançamento"}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !!faltaMsg}
            className={BTN_ACAO}
          >
            {salvando ? "Salvando..." : edit ? "Salvar alterações" : "Salvar lançamento"}
          </button>
        </>
      }
    >
      {/* Tipo — grupo de botões, não um único controle, então a associação é
          por role="group" + aria-labelledby (Campo clona id num filho único). */}
      <div className="mb-4">
        <span id={tipoLabelId} className="mb-1 block text-[12px] text-[var(--muted)]">
          Tipo
        </span>
        <div role="group" aria-labelledby={tipoLabelId} className="flex gap-2">
          {(
            [
              { id: "entrada", label: "Entrada" },
              { id: "saida", label: "Saída" },
            ] as { id: RegistrarTipo; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => trocarTipo(t.id)}
              aria-pressed={tipo === t.id}
              className={`flex-1 rounded-lg border px-3 py-2 text-[14px] ${
                tipo === t.id
                  ? "border-[var(--secondary)] bg-[var(--secondary-light)] text-[var(--secondary-text)]"
                  : "border-[var(--line)] text-[var(--ink-soft)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Valor */}
      <div className="mb-4">
        <Campo label="Valor (R$)" required>
          <input
            type="text"
            inputMode="numeric"
            value={cents ? moedaFmt : ""}
            onChange={onValorChange}
            placeholder="R$ 0,00"
            autoFocus
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-right text-[22px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
          />
        </Campo>
      </div>

      {/* Data */}
      <div className="mb-4">
        <Campo
          label="Data"
          required
          hint={
            limites
              ? "No plano Grátis o registro é do mês corrente, que é o que o Painel mostra. Os outros meses ficam no Financeiro do Premium."
              : undefined
          }
        >
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            min={limites?.min}
            max={limites?.max}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
          />
        </Campo>
      </div>

      {/* Descrição */}
      <div className="mb-4">
        <Campo label="Descrição">
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            placeholder="ex: pagamento da Ana"
          />
        </Campo>
      </div>

      {/* Categoria — mesmo caso do Tipo: grupo de botões. */}
      <div>
        <span id={categoriaLabelId} className="mb-1 block text-[12px] text-[var(--muted)]">
          Categoria
        </span>
        <div role="group" aria-labelledby={categoriaLabelId} className="flex flex-wrap gap-2">
          {categorias.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => escolherCategoria(c)}
              aria-pressed={!novaCategoriaAberta && categoria === c}
              className={`${BTN_MIUDO} ${
                !novaCategoriaAberta && categoria === c ? "!bg-[var(--secondary)]" : "bg-white"
              }`}
            >
              {c}
            </button>
          ))}
          <button
            type="button"
            onClick={() => escolherCategoria(NOVA_CATEGORIA)}
            aria-pressed={novaCategoriaAberta}
            className={`${BTN_MIUDO} ${novaCategoriaAberta ? "!bg-[var(--secondary)]" : "bg-white"}`}
          >
            {NOVA_CATEGORIA}
          </button>
        </div>
        {novaCategoriaAberta && (
          <div className="mt-2">
            <Campo label="Nome da categoria">
              <input
                autoFocus
                value={novaCategoriaTexto}
                onChange={(e) => {
                  const novaTexto = e.target.value;
                  setSelecao((atual) => ({ ...atual, novaTexto }));
                }}
                placeholder="Nome da categoria"
                maxLength={40}
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
              />
            </Campo>
          </div>
        )}
      </div>

      {faltaMsg && <p className="mt-4 text-[13px] text-[var(--muted)]">{faltaMsg}</p>}
      {erro && (
        <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
          {erro}
        </p>
      )}
    </Modal>
  );
}
