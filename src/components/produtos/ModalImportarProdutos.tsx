// Importar produtos de planilha CSV (ONE-121). Mesmo desenho da importação
// do Financeiro (ModalImportar): arquivo, colunas quando a Pólia não
// reconhece os títulos, e revisão antes de gravar. Lido no navegador.

import { useId, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { toastErro, toastSucesso } from "@/lib/toast";
import { baixarCsv, gerarCsv } from "@/lib/csv";
import { COTAS_CONFERE } from "@/lib/planos";
import { Modal } from "@/components/ui/Modal";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { decodificarArquivo, MAX_BYTES_ARQUIVO } from "@/lib/importarExtrato";
import {
  EXEMPLO_MODELO,
  lerPlanilhaProdutos,
  marcarJaCadastrados,
  produtosDaPlanilha,
  TITULOS_MODELO,
  type ColunasProduto,
  type ProdutoImportado,
} from "@/lib/importarProdutos";
import { fmt, TIPO_LABEL, type ProdutoTipo } from "./tipos";

interface Item {
  produto: ProdutoImportado;
  marcado: boolean;
  jaExiste: boolean;
  tipo: ProdutoTipo;
}

type Etapa =
  | { nome: "arquivo" }
  | { nome: "mapear"; matriz: string[][]; arquivo: string }
  | { nome: "revisar" }
  | { nome: "pronto"; ids: string[] };

const MAX_PRODUTOS = 1000;
const LOTE = 200;
const TIPOS: ProdutoTipo[] = ["fisico", "digital", "servico"];

export function ModalImportarProdutos({
  userId,
  nomesExistentes,
  restanteCota,
  onClose,
  onMudou,
}: {
  userId: string;
  nomesExistentes: string[];
  /** Quantos ainda cabem no plano Grátis; null quando não há teto. */
  restanteCota: number | null;
  onClose: () => void;
  onMudou: () => void;
}) {
  const inputId = useId();
  const [etapa, setEtapa] = useState<Etapa>({ nome: "arquivo" });
  const [erro, setErro] = useState<string | null>(null);
  const [recusadas, setRecusadas] = useState<{ linha: number; motivo: string }[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [importando, setImportando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);

  const montarRevisao = (matriz: string[][], colunas: ColunasProduto, linhaTitulos: number) => {
    const { produtos, recusadas: fora } = produtosDaPlanilha(matriz, colunas, linhaTitulos);
    if (produtos.length === 0) {
      setErro("A Pólia não achou nenhum produto com nome e preço de venda nessas colunas.");
      setRecusadas(fora);
      return;
    }
    if (produtos.length > MAX_PRODUTOS) {
      setErro(`São ${produtos.length} produtos; a importação vai até ${MAX_PRODUTOS} de uma vez.`);
      return;
    }
    const repetidos = marcarJaCadastrados(produtos, nomesExistentes);
    let cabem = restanteCota ?? Infinity;
    setItens(
      produtos.map((produto, i) => {
        // No Grátis, marca só o que cabe; o resto ela escolhe se troca.
        const marcado = !repetidos[i] && cabem > 0;
        if (marcado) cabem--;
        return { produto, jaExiste: repetidos[i], marcado, tipo: produto.tipo };
      }),
    );
    setRecusadas(fora);
    setErro(null);
    setEtapa({ nome: "revisar" });
  };

  const escolherArquivo = async (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    if (!/\.(csv|txt)$/i.test(arquivo.name)) {
      setErro(
        "A Pólia lê planilha em .csv. No Excel ou no Google Planilhas, salve ou baixe como CSV.",
      );
      return;
    }
    if (arquivo.size > MAX_BYTES_ARQUIVO) {
      setErro("A planilha passa de 5 MB.");
      return;
    }
    const leitura = lerPlanilhaProdutos(decodificarArquivo(await arquivo.arrayBuffer()));
    if (leitura.tipo === "erro") {
      setErro(leitura.erro);
      return;
    }
    if (leitura.tipo === "mapear") {
      setErro(null);
      setEtapa({ nome: "mapear", matriz: leitura.matriz, arquivo: arquivo.name });
      return;
    }
    montarRevisao(leitura.matriz, leitura.colunas, leitura.linhaTitulos);
  };

  const baixarModelo = () => {
    baixarCsv("modelo-produtos-polia.csv", gerarCsv(TITULOS_MODELO, [EXEMPLO_MODELO]));
    track("modelo_produtos_baixado");
  };

  const marcados = itens.filter((i) => i.marcado);
  const jaExistem = itens.filter((i) => i.jaExiste).length;
  const passouDaCota = restanteCota !== null && marcados.length > restanteCota;

  const atualizar = (indice: number, mudanca: Partial<Item>) =>
    setItens((lista) => lista.map((it, i) => (i === indice ? { ...it, ...mudanca } : it)));

  const importar = async () => {
    if (marcados.length === 0 || passouDaCota) return;
    setImportando(true);
    const linhas = marcados.map(({ produto, tipo }) => ({
      user_id: userId,
      nome: produto.nome,
      tipo,
      preco_venda: produto.precoVenda,
      preco_custo: produto.precoCusto,
      canal: produto.canal,
      descricao: produto.descricao,
      observacao_interna: produto.observacaoInterna,
    }));
    const ids: string[] = [];
    for (let i = 0; i < linhas.length; i += LOTE) {
      const { data, error } = await supabase
        .from("produtos")
        .insert(linhas.slice(i, i + LOTE))
        .select("id");
      if (error) {
        console.error("importar_produtos", error);
        // Tudo ou nada: o que entrou dos lotes anteriores sai.
        if (ids.length > 0) await supabase.from("produtos").delete().in("id", ids);
        setImportando(false);
        toastErro(
          /cota|limite/i.test(error.message ?? "")
            ? `O plano Grátis guarda até ${COTAS_CONFERE.produtos} produtos. Nada foi gravado.`
            : "A Pólia One não conseguiu importar. Nada foi gravado, tenta de novo.",
        );
        return;
      }
      ids.push(...(data ?? []).map((r) => r.id));
    }
    setImportando(false);
    track("produtos_importados", { total: ids.length });
    void registrar("feature_completed", {
      feature: "produtos",
      propriedades: { acao: "importar", total: ids.length },
    });
    onMudou();
    setEtapa({ nome: "pronto", ids });
  };

  const desfazer = async () => {
    if (etapa.nome !== "pronto") return;
    setDesfazendo(true);
    const { error } = await supabase.from("produtos").delete().in("id", etapa.ids);
    setDesfazendo(false);
    if (error) {
      toastErro("A Pólia One não conseguiu desfazer. Tenta de novo.");
      return;
    }
    track("importacao_produtos_desfeita", { total: etapa.ids.length });
    onMudou();
    toastSucesso("Importação desfeita.");
    onClose();
  };

  const footer =
    etapa.nome === "revisar" ? (
      <>
        <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={importar}
          disabled={importando || marcados.length === 0 || passouDaCota}
          className={BTN_ACAO}
        >
          {importando
            ? "Importando…"
            : `Importar ${marcados.length} ${marcados.length === 1 ? "produto" : "produtos"}`}
        </button>
      </>
    ) : etapa.nome === "pronto" ? (
      <>
        <button
          type="button"
          onClick={desfazer}
          disabled={desfazendo}
          className={BTN_ACAO_CONTORNO}
        >
          {desfazendo ? "Desfazendo…" : "Desfazer importação"}
        </button>
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
      title="Importar produtos"
      description={
        etapa.nome === "arquivo"
          ? "De uma planilha em CSV. Nada entra antes da revisão."
          : undefined
      }
      largura={etapa.nome === "revisar" ? "larga" : "padrao"}
      footer={footer}
    >
      {erro && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]"
        >
          {erro}
        </p>
      )}

      {etapa.nome === "arquivo" && (
        <div>
          <input
            id={inputId}
            type="file"
            accept=".csv,.txt"
            onChange={escolherArquivo}
            className="peer sr-only"
          />
          <label
            htmlFor={inputId}
            className={`${BTN_ACAO} w-full cursor-pointer peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ink)]`}
          >
            Escolher planilha
          </label>
          <p className="mt-4 text-[13px] text-[var(--ink-soft)]">
            Precisa de nome e preço de venda. Tipo, custo, onde vende, descrição e observação
            interna são opcionais; coluna de código, SKU ou fornecedor vai pra observação interna.
            No Excel ou no Google Planilhas, salve ou baixe como CSV.
          </p>
          <button
            type="button"
            onClick={baixarModelo}
            className="mt-2 inline-flex min-h-11 items-center text-[14px] font-medium text-[var(--secondary-text)] hover:underline"
          >
            Baixar a planilha modelo
          </button>
          {restanteCota !== null && (
            <p className="mt-2 text-[13px] text-[var(--muted)]">
              No plano Grátis{" "}
              {restanteCota === 1 ? "cabe mais 1 produto" : `cabem mais ${restanteCota} produtos`}.
            </p>
          )}
        </div>
      )}

      {etapa.nome === "mapear" && (
        <MapearColunasProduto
          matriz={etapa.matriz}
          arquivo={etapa.arquivo}
          onVoltar={() => {
            setErro(null);
            setEtapa({ nome: "arquivo" });
          }}
          onConfirmar={(colunas, primeiraEhTitulo) =>
            montarRevisao(etapa.matriz, colunas, primeiraEhTitulo ? 0 : -1)
          }
        />
      )}

      {etapa.nome === "revisar" && (
        <div>
          <p className="text-[14px] text-[var(--ink-soft)]">
            {itens.length} {itens.length === 1 ? "produto" : "produtos"}
            {jaExistem > 0 &&
              ` · ${jaExistem} com nome que já está no catálogo ${jaExistem === 1 ? "ficou desmarcado" : "ficaram desmarcados"}`}
            . Confira o tipo antes de importar.
          </p>
          {recusadas.length > 0 && (
            <p className="mt-2 text-[13px] text-[var(--muted)]">
              Ficaram de fora:{" "}
              {recusadas
                .slice(0, 5)
                .map((r) => `linha ${r.linha} (${r.motivo})`)
                .join(", ")}
              {recusadas.length > 5 ? ` e mais ${recusadas.length - 5}` : ""}.
            </p>
          )}
          {passouDaCota && (
            <p role="alert" className="mt-2 text-[13px] text-[var(--danger)]">
              No plano Grátis cabem mais {restanteCota}. Desmarque{" "}
              {marcados.length - (restanteCota ?? 0)} pra importar.
            </p>
          )}
          <ul className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {itens.map((it, i) => (
              <LinhaProduto
                key={`${it.produto.linha}`}
                item={it}
                onMarcar={(marcado) => atualizar(i, { marcado })}
                onTipo={(tipo) => atualizar(i, { tipo })}
              />
            ))}
          </ul>
        </div>
      )}

      {etapa.nome === "pronto" && (
        <p role="status" className="text-[15px] text-[var(--ink)]">
          {etapa.ids.length} {etapa.ids.length === 1 ? "produto entrou" : "produtos entraram"} no
          catálogo.
        </p>
      )}
    </Modal>
  );
}

function LinhaProduto({
  item,
  onMarcar,
  onTipo,
}: {
  item: Item;
  onMarcar: (marcado: boolean) => void;
  onTipo: (tipo: ProdutoTipo) => void;
}) {
  const { produto } = item;
  return (
    <li
      className={`grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 py-3 sm:grid-cols-[auto_1fr_auto_160px] ${item.marcado ? "" : "opacity-60"}`}
    >
      <input
        type="checkbox"
        checked={item.marcado}
        onChange={(e) => onMarcar(e.target.checked)}
        aria-label={`Importar ${produto.nome}`}
        className="h-[18px] w-[18px] accent-[var(--secondary)]"
      />
      <div className="min-w-0">
        <p className="truncate text-[14px] text-[var(--ink)]" title={produto.nome}>
          {produto.nome}
        </p>
        <p className="truncate text-[12px] text-[var(--muted)]">
          {item.jaExiste ? "já está no catálogo" : `linha ${produto.linha}`}
          {produto.observacaoInterna ? ` · ${produto.observacaoInterna}` : ""}
        </p>
      </div>
      <p className="text-right text-[14px] tabular-nums text-[var(--ink)]">
        {fmt(produto.precoVenda)}
        {produto.precoCusto !== null && (
          <span className="block text-[12px] text-[var(--muted)]">
            custo {fmt(produto.precoCusto)}
          </span>
        )}
      </p>
      <select
        value={item.tipo}
        onChange={(e) => onTipo(e.target.value as ProdutoTipo)}
        aria-label={`Tipo de ${produto.nome}`}
        className="col-span-2 col-start-2 w-full rounded-lg border border-[var(--line)] bg-white px-2 py-1.5 text-[13px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none sm:col-span-1 sm:col-start-auto"
      >
        {TIPOS.map((t) => (
          <option key={t} value={t}>
            {TIPO_LABEL[t]}
          </option>
        ))}
      </select>
    </li>
  );
}

function MapearColunasProduto({
  matriz,
  arquivo,
  onVoltar,
  onConfirmar,
}: {
  matriz: string[][];
  arquivo: string;
  onVoltar: () => void;
  onConfirmar: (colunas: ColunasProduto, primeiraEhTitulo: boolean) => void;
}) {
  const id = useId();
  const largura = Math.max(...matriz.slice(0, 20).map((l) => l.length));
  const exemplo = matriz.find((l) => l.length === largura) ?? matriz[0];
  const opcoes = Array.from({ length: largura }, (_, i) => ({
    valor: String(i),
    rotulo: `Coluna ${i + 1}${exemplo[i] ? ` (${exemplo[i].slice(0, 24)})` : ""}`,
  }));
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [custo, setCusto] = useState("");
  const [primeiraEhTitulo, setPrimeiraEhTitulo] = useState(false);

  const seletor = (
    rotulo: string,
    v: string,
    set: (s: string) => void,
    sufixo: string,
    opcional = false,
  ) => (
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
        <option value="">{opcional ? "Não tem" : "Escolha a coluna"}</option>
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
        {seletor("Nome do produto", nome, setNome, "nome")}
        {seletor("Preço de venda", preco, setPreco, "preco")}
        {seletor("Custo (opcional)", custo, setCusto, "custo", true)}
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
          Escolher outra planilha
        </button>
        <button
          type="button"
          disabled={nome === "" || preco === ""}
          onClick={() =>
            onConfirmar(
              {
                nome: Number(nome),
                precoVenda: Number(preco),
                custo: custo === "" ? undefined : Number(custo),
              },
              primeiraEhTitulo,
            )
          }
          className={BTN_ACAO}
        >
          Ver os produtos
        </button>
      </div>
    </div>
  );
}
