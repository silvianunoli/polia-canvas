// Importar extrato OFX, planilha CSV ou XML de NF-e (ONE-124). Três passos no
// mesmo modal: escolher o arquivo, (só no CSV sem títulos reconhecíveis)
// apontar as colunas, e revisar linha a linha antes de gravar. O arquivo é
// lido aqui no navegador; só as linhas marcadas vão pro banco.

import { useId, useMemo, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { toastErro, toastSucesso } from "@/lib/toast";
import { Modal } from "@/components/ui/Modal";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA } from "@/lib/categoriasLancamento";
import {
  criarSugestorDeCategoria,
  decodificarArquivo,
  lerArquivo,
  linhasDoCsv,
  marcarRepetidos,
  MAX_BYTES_ARQUIVO,
  MAX_LINHAS_IMPORTACAO,
  type ColunasCsv,
  type LinhaImportada,
  type TipoLancamento,
} from "@/lib/importarExtrato";
import type { Lancamento } from "./ModalLancamento";

interface Item {
  linha: LinhaImportada;
  marcada: boolean;
  repetida: boolean;
  tipo: TipoLancamento;
  categoria: string;
}

type Etapa =
  | { nome: "arquivo" }
  | { nome: "mapear"; matriz: string[][]; arquivo: string }
  | { nome: "revisar" }
  | { nome: "pronto"; importadas: number; jaExistiam: number; importacaoId: string };

const LOTE = 500;

function fmtReais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function ModalImportar({
  userId,
  lancamentos,
  cnpj,
  onClose,
  onMudou,
}: {
  userId: string;
  /** Tudo o que já está no Financeiro: marca repetidos e ensina a categoria. */
  lancamentos: Lancamento[];
  cnpj: string | null;
  onClose: () => void;
  /** Importou ou desfez: o Financeiro recarrega. */
  onMudou: () => void;
}) {
  const inputId = useId();
  const [etapa, setEtapa] = useState<Etapa>({ nome: "arquivo" });
  const [lendo, setLendo] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [formatos, setFormatos] = useState<string[]>([]);
  const [importando, setImportando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);

  const sugerir = useMemo(() => criarSugestorDeCategoria(lancamentos), [lancamentos]);

  // Categorias da revisão: a semente do Financeiro + as que ela já criou.
  const categoriasPorTipo = useMemo(() => {
    const extras = (tipo: TipoLancamento) =>
      lancamentos.filter((l) => l.tipo === tipo && l.categoria).map((l) => l.categoria as string);
    const juntar = (base: string[], tipo: TipoLancamento) =>
      Array.from(new Set([...base, ...extras(tipo)]));
    return {
      entrada: juntar(CATEGORIAS_ENTRADA, "entrada"),
      saida: juntar(CATEGORIAS_SAIDA, "saida"),
    };
  }, [lancamentos]);

  const montarRevisao = (linhas: LinhaImportada[]) => {
    const ordenadas = [...linhas].sort((a, b) => a.data.localeCompare(b.data));
    const repetidas = marcarRepetidos(ordenadas, lancamentos);
    setItens(
      ordenadas.map((linha, i) => ({
        linha,
        repetida: repetidas[i],
        marcada: !repetidas[i],
        tipo: linha.tipo,
        categoria: linha.categoria ?? sugerir(linha.descricao, linha.tipo) ?? "",
      })),
    );
    setEtapa({ nome: "revisar" });
  };

  const escolherArquivos = async (e: ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (arquivos.length === 0) return;
    setLendo(true);
    const novosErros: string[] = [];
    const novosAvisos: string[] = [];
    const linhas: LinhaImportada[] = [];
    const tipos = new Set<string>();
    for (const arquivo of arquivos) {
      if (arquivo.size > MAX_BYTES_ARQUIVO) {
        novosErros.push(`${arquivo.name}: passa de 5 MB. Exporte um período menor.`);
        continue;
      }
      const texto = decodificarArquivo(await arquivo.arrayBuffer());
      const leitura = lerArquivo(arquivo.name, texto, cnpj);
      if (leitura.tipo === "erro") {
        novosErros.push(leitura.erro);
      } else if (leitura.tipo === "mapear") {
        if (arquivos.length > 1) {
          novosErros.push(
            `${arquivo.name}: a Pólia não reconheceu as colunas. Importe essa planilha sozinha pra apontar qual é qual.`,
          );
        } else {
          setLendo(false);
          setErros([]);
          setAvisos([]);
          setFormatos(["csv"]);
          setEtapa({ nome: "mapear", matriz: leitura.matriz, arquivo: arquivo.name });
          return;
        }
      } else {
        linhas.push(...leitura.linhas);
        novosAvisos.push(...leitura.avisos);
        tipos.add(arquivo.name.toLowerCase().split(".").pop() ?? "");
      }
    }
    setLendo(false);
    if (linhas.length > MAX_LINHAS_IMPORTACAO) {
      novosErros.push(
        `São ${linhas.length} linhas; a importação vai até ${MAX_LINHAS_IMPORTACAO} de uma vez. Exporte um período menor.`,
      );
    }
    setErros(novosErros);
    // Aviso repetido (várias notas sem CNPJ) aparece uma vez só.
    setAvisos(Array.from(new Set(novosAvisos)));
    setFormatos(Array.from(tipos));
    if (linhas.length > 0 && linhas.length <= MAX_LINHAS_IMPORTACAO) montarRevisao(linhas);
  };

  const confirmarMapeamento = (colunas: ColunasCsv, primeiraEhTitulo: boolean) => {
    if (etapa.nome !== "mapear") return;
    const r = linhasDoCsv(etapa.matriz, colunas, primeiraEhTitulo ? 0 : -1);
    if ("erro" in r) {
      setErros([r.erro]);
      return;
    }
    if (r.linhas.length > MAX_LINHAS_IMPORTACAO) {
      setErros([
        `São ${r.linhas.length} linhas; a importação vai até ${MAX_LINHAS_IMPORTACAO} de uma vez. Exporte um período menor.`,
      ]);
      return;
    }
    setErros([]);
    setAvisos(r.avisos);
    montarRevisao(r.linhas);
  };

  const marcadas = itens.filter((i) => i.marcada);
  const repetidas = itens.filter((i) => i.repetida).length;

  const atualizar = (indice: number, mudanca: Partial<Item>) =>
    setItens((lista) => lista.map((it, i) => (i === indice ? { ...it, ...mudanca } : it)));

  const trocarTipo = (indice: number) => {
    const it = itens[indice];
    const tipo: TipoLancamento = it.tipo === "entrada" ? "saida" : "entrada";
    // A categoria de um lado não serve no outro: sugere de novo.
    atualizar(indice, { tipo, categoria: sugerir(it.linha.descricao, tipo) ?? "" });
  };

  const importar = async () => {
    if (marcadas.length === 0) return;
    setImportando(true);
    const importacaoId = crypto.randomUUID();
    const linhas = marcadas.map((it) => ({
      user_id: userId,
      tipo: it.tipo,
      valor: it.linha.valor,
      data: it.linha.data,
      descricao: it.linha.descricao.slice(0, 200),
      categoria: it.categoria || null,
      id_externo: it.linha.idExterno,
      importacao_id: importacaoId,
    }));
    let importadas = 0;
    for (let i = 0; i < linhas.length; i += LOTE) {
      // Id externo já gravado (extrato importado de novo) é pulado pelo banco.
      const { data, error } = await supabase
        .from("lancamentos")
        .upsert(linhas.slice(i, i + LOTE), {
          onConflict: "user_id,id_externo",
          ignoreDuplicates: true,
        })
        .select("id");
      if (error) {
        console.error("importar_lancamentos", error);
        // Tudo ou nada: o que entrou dos lotes anteriores sai.
        await supabase
          .from("lancamentos")
          .delete()
          .eq("user_id", userId)
          .eq("importacao_id", importacaoId);
        setImportando(false);
        toastErro("A Pólia One não conseguiu importar. Nada foi gravado, tenta de novo.");
        return;
      }
      importadas += data?.length ?? 0;
    }
    setImportando(false);
    track("lancamentos_importados", { total: importadas, formatos: formatos.join(",") });
    void registrar("feature_completed", {
      feature: "financeiro",
      propriedades: { acao: "importar", total: importadas },
    });
    onMudou();
    setEtapa({
      nome: "pronto",
      importadas,
      jaExistiam: linhas.length - importadas,
      importacaoId,
    });
  };

  const desfazer = async () => {
    if (etapa.nome !== "pronto") return;
    setDesfazendo(true);
    const { error } = await supabase
      .from("lancamentos")
      .delete()
      .eq("user_id", userId)
      .eq("importacao_id", etapa.importacaoId);
    setDesfazendo(false);
    if (error) {
      toastErro("A Pólia One não conseguiu desfazer. Tenta de novo.");
      return;
    }
    track("importacao_desfeita", { total: etapa.importadas });
    onMudou();
    toastSucesso("Importação desfeita.");
    onClose();
  };

  // ── Rodapé por etapa ──
  const footer =
    etapa.nome === "revisar" ? (
      <>
        <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={importar}
          disabled={importando || marcadas.length === 0}
          className={BTN_ACAO}
        >
          {importando
            ? "Importando…"
            : `Importar ${marcadas.length} ${marcadas.length === 1 ? "lançamento" : "lançamentos"}`}
        </button>
      </>
    ) : etapa.nome === "pronto" ? (
      <>
        {etapa.importadas > 0 && (
          <button
            type="button"
            onClick={desfazer}
            disabled={desfazendo}
            className={BTN_ACAO_CONTORNO}
          >
            {desfazendo ? "Desfazendo…" : "Desfazer importação"}
          </button>
        )}
        <button type="button" onClick={onClose} className={BTN_ACAO}>
          Fechar
        </button>
      </>
    ) : (
      <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
        Cancelar
      </button>
    );

  return (
    <Modal
      open
      onOpenChange={(aberto) => {
        if (!aberto && !importando) onClose();
      }}
      title="Importar extrato"
      description={
        etapa.nome === "arquivo"
          ? "Extrato do banco em OFX, planilha em CSV ou nota fiscal em XML. Nada entra antes da revisão."
          : undefined
      }
      largura={etapa.nome === "revisar" ? "larga" : "padrao"}
      footer={footer}
    >
      {erros.length > 0 && (
        <div role="alert" className="mb-4 space-y-1 rounded-lg bg-[var(--danger-soft)] px-3 py-2">
          {erros.map((e) => (
            <p key={e} className="text-[13px] text-[var(--danger)]">
              {e}
            </p>
          ))}
        </div>
      )}

      {etapa.nome === "arquivo" && (
        <div>
          {/* Input antes do label: o foco do teclado aparece no "botão" via peer. */}
          <input
            id={inputId}
            type="file"
            accept=".ofx,.qfx,.csv,.txt,.xml"
            multiple
            onChange={escolherArquivos}
            className="peer sr-only"
          />
          <label
            htmlFor={inputId}
            className={`${BTN_ACAO} w-full cursor-pointer peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ink)] ${lendo ? "pointer-events-none opacity-60" : ""}`}
          >
            {lendo ? "Lendo o arquivo…" : "Escolher arquivo"}
          </label>
          <ul className="mt-4 space-y-2 text-[13px] text-[var(--ink-soft)]">
            <li>
              <strong className="text-[var(--ink)]">Extrato (.ofx):</strong> no app ou site do
              banco, em extrato, procure "exportar" ou "Money/OFX".
            </li>
            <li>
              <strong className="text-[var(--ink)]">Planilha (.csv):</strong> no Excel ou no Google
              Planilhas, salve ou baixe como CSV.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Nota fiscal (.xml):</strong> dá pra escolher
              várias de uma vez. Nota com o CNPJ de Configurações entra como venda; as outras, como
              compra.
            </li>
          </ul>
        </div>
      )}

      {etapa.nome === "mapear" && (
        <MapearColunas
          matriz={etapa.matriz}
          arquivo={etapa.arquivo}
          onVoltar={() => {
            setErros([]);
            setEtapa({ nome: "arquivo" });
          }}
          onConfirmar={confirmarMapeamento}
        />
      )}

      {etapa.nome === "revisar" && (
        <div>
          <p className="text-[14px] text-[var(--ink-soft)]">
            {itens.length} {itens.length === 1 ? "linha" : "linhas"}
            {repetidas > 0 &&
              ` · ${repetidas} ${repetidas === 1 ? "já está" : "já estão"} no Financeiro e ${repetidas === 1 ? "ficou desmarcada" : "ficaram desmarcadas"}`}
            . Confira o tipo e a categoria antes de importar.
          </p>
          {avisos.length > 0 && (
            <ul className="mt-2 space-y-1">
              {avisos.map((a) => (
                <li key={a} className="text-[13px] text-[var(--muted)]">
                  {a}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setItens((l) => l.map((it) => ({ ...it, marcada: true })))}
              className={BTN_MIUDO}
            >
              Marcar todas
            </button>
            <button
              type="button"
              onClick={() => setItens((l) => l.map((it) => ({ ...it, marcada: false })))}
              className={BTN_MIUDO}
            >
              Desmarcar todas
            </button>
          </div>
          <ul className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {itens.map((it, i) => (
              <LinhaRevisao
                key={`${it.linha.data}-${it.linha.idExterno ?? ""}-${i}`}
                item={it}
                categorias={categoriasPorTipo[it.tipo]}
                onMarcar={(marcada) => atualizar(i, { marcada })}
                onTrocarTipo={() => trocarTipo(i)}
                onCategoria={(categoria) => atualizar(i, { categoria })}
              />
            ))}
          </ul>
        </div>
      )}

      {etapa.nome === "pronto" && (
        <div role="status" className="text-[14px] text-[var(--ink-soft)]">
          <p className="text-[15px] text-[var(--ink)]">
            {etapa.importadas === 0
              ? "Nenhum lançamento novo entrou."
              : `${etapa.importadas} ${etapa.importadas === 1 ? "lançamento entrou" : "lançamentos entraram"} no Financeiro.`}
          </p>
          {etapa.jaExistiam > 0 && (
            <p className="mt-1">
              {etapa.jaExistiam}{" "}
              {etapa.jaExistiam === 1
                ? "já tinha sido importado antes e ficou de fora"
                : "já tinham sido importados antes e ficaram de fora"}
              .
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

function LinhaRevisao({
  item,
  categorias,
  onMarcar,
  onTrocarTipo,
  onCategoria,
}: {
  item: Item;
  categorias: string[];
  onMarcar: (marcada: boolean) => void;
  onTrocarTipo: () => void;
  onCategoria: (categoria: string) => void;
}) {
  const id = useId();
  const entrada = item.tipo === "entrada";
  return (
    <li
      className={`grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 py-3 sm:grid-cols-[auto_56px_1fr_auto_auto_200px] ${item.marcada ? "" : "opacity-60"}`}
    >
      <input
        id={`${id}-marcar`}
        type="checkbox"
        checked={item.marcada}
        onChange={(e) => onMarcar(e.target.checked)}
        aria-label={`Importar ${item.linha.descricao}, ${fmtDataCurta(item.linha.data)}`}
        className="h-[18px] w-[18px] accent-[var(--secondary)]"
      />
      <span className="hidden text-[13px] text-[var(--muted)] sm:block">
        {fmtDataCurta(item.linha.data)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[14px] text-[var(--ink)]" title={item.linha.descricao}>
          {item.linha.descricao}
        </p>
        <p className="text-[12px] text-[var(--muted)]">
          <span className="sm:hidden">{fmtDataCurta(item.linha.data)}</span>
          {item.repetida && <span className="sm:ml-0"> · já lançada</span>}
        </p>
      </div>
      <span
        className={`text-right text-[14px] font-medium tabular-nums ${entrada ? "text-[var(--secondary-text)]" : "text-[var(--ink)]"}`}
      >
        {entrada ? "+" : "-"} {fmtReais(item.linha.valor)}
      </span>
      <button
        type="button"
        onClick={onTrocarTipo}
        aria-label={`Tipo: ${entrada ? "entrada" : "saída"}. Trocar.`}
        className={`${BTN_MIUDO} col-start-2 justify-self-start sm:col-start-auto`}
      >
        {entrada ? "Entrada" : "Saída"}
      </button>
      <select
        value={item.categoria}
        onChange={(e) => onCategoria(e.target.value)}
        aria-label={`Categoria de ${item.linha.descricao}`}
        className="col-span-2 col-start-2 w-full rounded-lg border border-[var(--line)] bg-white px-2 py-1.5 text-[13px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none sm:col-span-1 sm:col-start-auto"
      >
        <option value="">Sem categoria</option>
        {categorias.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </li>
  );
}

function MapearColunas({
  matriz,
  arquivo,
  onVoltar,
  onConfirmar,
}: {
  matriz: string[][];
  arquivo: string;
  onVoltar: () => void;
  onConfirmar: (colunas: ColunasCsv, primeiraEhTitulo: boolean) => void;
}) {
  const id = useId();
  const largura = Math.max(...matriz.slice(0, 20).map((l) => l.length));
  const exemplo = matriz.find((l) => l.length === largura) ?? matriz[0];
  const opcoes = Array.from({ length: largura }, (_, i) => ({
    valor: String(i),
    rotulo: `Coluna ${i + 1}${exemplo[i] ? ` (${exemplo[i].slice(0, 24)})` : ""}`,
  }));
  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [primeiraEhTitulo, setPrimeiraEhTitulo] = useState(false);
  const pronto = data !== "" && descricao !== "" && valor !== "";

  const seletor = (rotulo: string, v: string, set: (s: string) => void, sufixo: string) => (
    <div>
      <label htmlFor={`${id}-${sufixo}`} className="mb-1 block text-[12px] text-[var(--muted)]">
        {rotulo}
      </label>
      <select
        id={`${id}-${sufixo}`}
        value={v}
        onChange={(e) => set(e.target.value)}
        className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
      >
        <option value="">Escolha a coluna</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div>
      <p className="text-[14px] text-[var(--ink-soft)]">
        A Pólia não reconheceu os títulos de{" "}
        <strong className="text-[var(--ink)]">{arquivo}</strong>. Aponte qual coluna é qual:
      </p>
      <div className="mt-4 space-y-3">
        {seletor("Data", data, setData, "data")}
        {seletor("Descrição", descricao, setDescricao, "descricao")}
        {seletor("Valor (saída com sinal de menos)", valor, setValor, "valor")}
        <label className="flex items-center gap-2 text-[14px] text-[var(--ink-soft)]">
          <input
            type="checkbox"
            checked={primeiraEhTitulo}
            onChange={(e) => setPrimeiraEhTitulo(e.target.checked)}
            className="h-[18px] w-[18px] accent-[var(--secondary)]"
          />
          A primeira linha é de títulos
        </label>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <button type="button" onClick={onVoltar} className={BTN_MIUDO}>
          Escolher outro arquivo
        </button>
        <button
          type="button"
          disabled={!pronto}
          onClick={() =>
            onConfirmar(
              { data: Number(data), descricao: Number(descricao), valor: Number(valor) },
              primeiraEhTitulo,
            )
          }
          className={BTN_ACAO}
        >
          Ver as linhas
        </button>
      </div>
    </div>
  );
}
