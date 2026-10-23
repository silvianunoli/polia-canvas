// Aba Estoque de Produtos (VND-03): saldo e mínimo de cada variação, entrada
// e ajuste à mão, histórico de movimentos. Os saldos vêm da view
// estoque_saldos; nada aqui sobrescreve número, tudo vira movimento.

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Boxes } from "lucide-react";
import { Vazio } from "@/components/layout/Vazio";
import { BlockError } from "@/components/ui/BlockError";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { toastSucesso } from "@/lib/toast";
import { diferencaDoAjuste, estoqueBaixo } from "@/lib/vendas";
import { fmtData } from "./tipos";
import {
  chaveEstoque,
  movimentarEstoque,
  useMovimentos,
  useProdutosComEstoque,
  type MovimentoEstoque,
  type TipoMovimentoManual,
} from "@/components/vendas/dados";

interface LinhaEstoque {
  skuId: string;
  nome: string;
  variacao: string | null;
  saldo: number;
  minimo: number;
}

export function AbaEstoque({
  userId,
  onEditarProduto,
  onAbrirCatalogo,
}: {
  userId: string;
  onEditarProduto: (produtoId: string) => void;
  onAbrirCatalogo: () => void;
}) {
  const qc = useQueryClient();
  const query = useProdutosComEstoque(userId);
  const [soBaixo, setSoBaixo] = useState(false);
  const [movimentar, setMovimentar] = useState<LinhaEstoque | null>(null);
  const [historico, setHistorico] = useState<LinhaEstoque | null>(null);

  const produtos = useMemo(() => query.data ?? [], [query.data]);
  const comEstoque = produtos.filter((p) => p.controlaEstoque);
  const semEstoque = produtos.filter((p) => !p.controlaEstoque);

  const linhas: (LinhaEstoque & { produtoId: string })[] = useMemo(
    () =>
      comEstoque.flatMap((p) =>
        p.skus.map((s) => ({
          produtoId: p.id,
          skuId: s.id,
          nome: p.nome,
          variacao: s.variacao,
          saldo: s.saldo,
          minimo: s.estoqueMinimo,
        })),
      ),
    [comEstoque],
  );
  const visiveis = soBaixo
    ? linhas.filter((l) => estoqueBaixo({ saldo: l.saldo, estoqueMinimo: l.minimo }))
    : linhas;
  // Produto com estoque ligado e sem variação nenhuma (salvo pela metade).
  const semVariacao = comEstoque.filter((p) => p.skus.length === 0);

  if (query.isError) {
    return (
      <div role="alert">
        <BlockError
          message="A Pólia One não conseguiu ler o estoque agora. Nada foi perdido, é só a leitura que falhou."
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }
  if (query.isLoading) {
    return <p className="text-[14px] text-[var(--muted)]">Carregando o estoque…</p>;
  }
  if (comEstoque.length === 0) {
    return (
      <Vazio
        icone={Boxes}
        titulo="Nenhum produto com estoque ligado."
        texto="Abra um produto em Catálogo e marque “Controlar estoque deste produto”. Cada venda passa a baixar sozinha."
        acao={
          <button type="button" onClick={onAbrirCatalogo} className={BTN_ACAO}>
            Abrir o Catálogo
          </button>
        }
      />
    );
  }

  return (
    <div>
      <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-[14px] text-[var(--ink)]">
        <input
          type="checkbox"
          checked={soBaixo}
          onChange={(e) => setSoBaixo(e.target.checked)}
          className="h-4 w-4 accent-[var(--secondary-text)]"
        />
        Só estoque baixo
      </label>

      {visiveis.length === 0 ? (
        <p className="mt-3 rounded-xl border border-[var(--line)] bg-white p-6 text-[14px] text-[var(--ink-soft)]">
          Nada abaixo do mínimo agora.
        </p>
      ) : (
        <>
          {/* Celular: cartão empilhado, a ação principal sempre à vista. */}
          <ul className="mt-3 flex flex-col gap-3 sm:hidden">
            {visiveis.map((l) => (
              <li key={l.skuId} className="rounded-xl border border-[var(--line)] bg-white p-4">
                <NomeComHistorico linha={l} onAbrir={() => setHistorico(l)} />
                <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
                  <Saldo linha={l} /> no estoque · mínimo {l.minimo}
                </p>
                <button
                  type="button"
                  onClick={() => setMovimentar(l)}
                  className={`${BTN_MIUDO} mt-3 min-h-11 w-full bg-white`}
                >
                  Entrada ou ajuste
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 hidden overflow-hidden rounded-xl border border-[var(--line)] bg-white sm:block">
            <table className="w-full text-left text-[14px]">
              <caption className="sr-only">Estoque por produto e variação</caption>
              <thead>
                <tr className="font-accent text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                  <th scope="col" className="px-4 py-3">
                    Produto · variação
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Em estoque
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Mínimo
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((l) => (
                  <tr key={l.skuId} className="border-t border-[var(--line)]">
                    <td className="px-4 py-2">
                      <NomeComHistorico linha={l} onAbrir={() => setHistorico(l)} />
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <Saldo linha={l} />
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-[var(--ink-soft)]">
                      {l.minimo}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setMovimentar(l)}
                        className={`${BTN_MIUDO} min-h-11 bg-white`}
                      >
                        Entrada ou ajuste
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {semVariacao.length > 0 && (
        <p className="mt-3 text-[13px] text-[var(--ink-soft)]">
          {semVariacao.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ", "}
              <button
                type="button"
                onClick={() => onEditarProduto(p.id)}
                className="font-medium text-[var(--secondary-text)] underline-offset-2 hover:underline"
              >
                {p.nome}
              </button>
            </span>
          ))}{" "}
          {semVariacao.length === 1 ? "está" : "estão"} com o estoque ligado, mas sem quantidade
          cadastrada.
        </p>
      )}
      {semEstoque.length > 0 && (
        <p className="mt-3 text-[13px] text-[var(--muted)]">
          {semEstoque.length} {semEstoque.length === 1 ? "produto" : "produtos"} sem controle de
          estoque. Liga no cadastro do produto, em Catálogo.
        </p>
      )}

      {movimentar && (
        <ModalMovimento
          linha={movimentar}
          onClose={() => setMovimentar(null)}
          onSaved={() => {
            setMovimentar(null);
            void qc.invalidateQueries({ queryKey: chaveEstoque(userId) });
            void qc.invalidateQueries({ queryKey: ["estoque-movimentos"] });
          }}
        />
      )}
      {historico && <ModalHistorico linha={historico} onClose={() => setHistorico(null)} />}
    </div>
  );
}

const OPCOES: { id: TipoMovimentoManual; label: string; dica: string }[] = [
  { id: "entrada", label: "Chegou mercadoria", dica: "Quantas chegaram" },
  { id: "perda", label: "Perda ou quebra", dica: "Quantas saíram" },
  { id: "ajuste", label: "Contagem", dica: "Quantas tem agora na prateleira" },
];

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

function ModalMovimento({
  linha,
  onClose,
  onSaved,
}: {
  linha: LinhaEstoque;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tipo, setTipo] = useState<TipoMovimentoManual>("entrada");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroServidor, setErroServidor] = useState<string | null>(null);

  const valor = Number(quantidade);
  const valido = quantidade.trim() !== "" && Number.isInteger(valor) && valor >= 0;
  const delta = !valido
    ? 0
    : tipo === "entrada"
      ? valor
      : tipo === "perda"
        ? -valor
        : diferencaDoAjuste(linha.saldo, valor);
  const novoSaldo = linha.saldo + delta;
  const opcao = OPCOES.find((o) => o.id === tipo)!;
  const nome = linha.variacao ? `${linha.nome} · ${linha.variacao}` : linha.nome;

  const salvar = async () => {
    if (!valido) {
      setErro("Coloque um número inteiro.");
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
    const { data: saldoNovo, error } = await movimentarEstoque({
      skuId: linha.skuId,
      tipo,
      quantidade: valor,
      motivo: motivo.trim() || null,
    });
    setSalvando(false);
    if (error) {
      console.error("estoque_movimentar", error);
      setErroServidor("A Pólia One não conseguiu salvar. O estoque não mudou, tenta de novo.");
      return;
    }
    toastSucesso(`${nome}: agora tem ${saldoNovo ?? novoSaldo}.`);
    onSaved();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={nome}
      description={`Tem ${linha.saldo} agora.`}
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
            className={`${BTN_MIUDO} ${tipo === o.id ? "!bg-[var(--secondary)]" : "bg-white"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Campo label={opcao.dica} required error={erro ?? undefined}>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
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
              tipo === "entrada" ? "ex: fornecedor, lote de outubro" : "ex: caiu na entrega"
            }
          />
        </Campo>
      </div>
      {/* Sempre montado: o leitor de tela só anuncia região viva que já existia. */}
      <p className="mt-4 min-h-[21px] text-[14px] text-[var(--ink-soft)]" aria-live="polite">
        {valido && delta !== 0 ? `Fica com ${novoSaldo}.` : ""}
      </p>
      {erroServidor && (
        <p role="alert" className="mt-2 text-[13px] text-[var(--danger)]">
          {erroServidor}
        </p>
      )}
    </Modal>
  );
}

const TIPO_LABEL: Record<MovimentoEstoque["tipo"], string> = {
  entrada: "Entrada",
  venda: "Venda",
  devolucao: "Voltou (venda cancelada)",
  ajuste: "Contagem",
  perda: "Perda ou quebra",
};

function ModalHistorico({ linha, onClose }: { linha: LinhaEstoque; onClose: () => void }) {
  const query = useMovimentos(linha.skuId);
  const nome = linha.variacao ? `${linha.nome} · ${linha.variacao}` : linha.nome;
  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={nome}
      description={`Tem ${linha.saldo} agora. Cada entrada, venda e ajuste, do mais novo pro mais antigo.`}
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
                {m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function NomeComHistorico({ linha, onAbrir }: { linha: LinhaEstoque; onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="min-h-11 text-left text-[var(--ink)] underline-offset-2 hover:underline"
    >
      {linha.nome}
      {linha.variacao && <span className="text-[var(--ink-soft)]"> · {linha.variacao}</span>}
      <span className="sr-only">, ver histórico</span>
    </button>
  );
}

function Saldo({ linha }: { linha: LinhaEstoque }) {
  const baixo = estoqueBaixo({ saldo: linha.saldo, estoqueMinimo: linha.minimo });
  return (
    <>
      <span className={linha.saldo < 0 ? "text-[var(--danger)]" : "text-[var(--ink)]"}>
        {linha.saldo}
      </span>
      {baixo && <span className="ml-2 text-[12px] text-[var(--ink-soft)]">baixo</span>}
    </>
  );
}
