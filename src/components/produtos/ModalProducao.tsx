// Registrar produção (ONE-133): "produzi N peças de X". Sai a receita x N de
// cada insumo e, com estoque ligado, entram N no estoque do produto. A prévia
// mostra com quanto cada insumo fica antes de gravar.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Campo } from "@/components/ui/Campo";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { Modal } from "@/components/ui/Modal";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO_ACAO } from "@/lib/botoes";
import { hojeISO } from "@/lib/data.functions";
import { toastErro, toastSucesso } from "@/lib/toast";
import { consumoDaProducao, fmtDia, fmtQtd, produzivel, type InsumoComSaldo } from "@/lib/producao";
import { chaveEstoque, useProdutosComEstoque } from "@/components/vendas/dados";
import {
  chaveInsumos,
  desfazerProducao,
  registrarProducao,
  useProducoesRecentes,
  useReceitas,
  type Producao,
} from "./insumosDados";

/** "1 peça", "1.500 peças". */
const pecasTexto = (n: number) => `${fmtQtd(n)} ${n === 1 ? "peça" : "peças"}`;

/** Teto do livro de insumo por movimento (check do banco). */
const TETO_CONSUMO = 1000000;

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

export function ModalProducao({
  userId,
  insumos,
  onClose,
}: {
  userId: string;
  insumos: InsumoComSaldo[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const produtosQuery = useProdutosComEstoque(userId);
  const receitasQuery = useReceitas(userId);
  // Gerado quando o modal abre: repetir o envio devolve a mesma produção.
  const [id] = useState(() => crypto.randomUUID());
  const [produtoId, setProdutoId] = useState("");
  const [skuId, setSkuId] = useState("");
  const [pecas, setPecas] = useState("");
  const [data, setData] = useState(hojeISO);
  const [observacao, setObservacao] = useState("");
  const [mostrarErros, setMostrarErros] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | null>(null);

  const receitas = receitasQuery.data;
  const opcoes = (produtosQuery.data ?? []).filter(
    (p) => produzivel(p) && (receitas?.get(p.id)?.length ?? 0) > 0,
  );
  const produto = opcoes.find((p) => p.id === produtoId);
  const variacoes = produto?.controlaEstoque ? produto.skus.filter((s) => s.variacao != null) : [];
  const variacao = variacoes.find((s) => s.id === skuId);
  const qtd = Number(pecas);
  const qtdValida = Number.isInteger(qtd) && qtd >= 1 && qtd <= 100000;
  const porId = new Map(insumos.map((i) => [i.id, i]));
  const consumo =
    produto && qtdValida ? consumoDaProducao(receitas?.get(produto.id) ?? [], qtd, porId) : [];
  const negativos = consumo.filter((c) => c.fica < 0).map((c) => c.nome);
  const passaDoTeto = consumo.some((c) => c.usa > TETO_CONSUMO);

  const erroProduto = !produto ? "Escolha o produto." : undefined;
  const erroVariacao = variacoes.length > 0 && !variacao ? "Escolha a variação." : undefined;
  const erroPecas = !qtdValida
    ? "Um número inteiro de peças, a partir de 1."
    : passaDoTeto
      ? "Com essa quantidade, um insumo passa de 1.000.000. Registre em partes."
      : undefined;
  const erroData = !data
    ? "Escolha a data."
    : data > hojeISO()
      ? "A data não pode ser depois de hoje."
      : undefined;

  const salvar = async () => {
    if (erroProduto || erroVariacao || erroPecas || erroData || !produto) {
      setMostrarErros(true);
      return;
    }
    setSalvando(true);
    setErroServidor(null);
    const { error } = await registrarProducao({
      id,
      produtoId: produto.id,
      skuId: variacao?.id ?? null,
      quantidade: qtd,
      data,
      observacao: observacao.trim() || null,
    });
    setSalvando(false);
    if (error) {
      console.error("producao_registrar", error);
      const msg = error.message ?? "";
      setErroServidor(
        msg.startsWith("Edite a receita") || msg.startsWith("Escolha a variação")
          ? `${msg}.`
          : msg.startsWith("O estoque de")
            ? `${msg}. Abra o produto no Catálogo e coloque quanto tem.`
            : msg.startsWith("Quantidade grande demais")
              ? "Com essa quantidade, um insumo passa do limite. Registre em partes."
              : msg.startsWith("Variação não encontrada") ||
                  msg.startsWith("Esse produto ainda não tem receita") ||
                  msg.startsWith("Kit não se produz") ||
                  msg.startsWith("Só produto físico") ||
                  msg.startsWith("Produto não encontrado")
                ? "O produto mudou desde que esta tela abriu. Feche e abra o Registrar produção de novo."
                : "A Pólia One não conseguiu registrar a produção. Tenta de novo: se ela já tiver entrado, não duplica.",
      );
      return;
    }
    void qc.invalidateQueries({ queryKey: chaveInsumos(userId) });
    void qc.invalidateQueries({ queryKey: ["insumo-movimentos"] });
    void qc.invalidateQueries({ queryKey: chaveEstoque(userId) });
    toastSucesso(`Produção registrada: ${pecasTexto(qtd)} de ${produto.nome}.`);
    onClose();
  };

  const carregando = produtosQuery.isLoading || receitasQuery.isLoading;
  const erroLeitura = produtosQuery.isError || receitasQuery.isError;
  const semOpcao = !carregando && !erroLeitura && opcoes.length === 0;

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Registrar produção"
      description="O que ficou pronto. A Pólia One baixa o material da receita."
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
            {semOpcao ? "Fechar" : "Cancelar"}
          </button>
          {!semOpcao && (
            <button
              type="button"
              onClick={salvar}
              disabled={salvando || carregando || erroLeitura}
              className={BTN_ACAO}
            >
              {salvando ? "Registrando…" : "Registrar produção"}
            </button>
          )}
        </>
      }
    >
      {erroLeitura ? (
        <p role="alert" className="text-[14px] text-[var(--danger)]">
          A Pólia One não conseguiu ler os produtos e as receitas agora. Fecha e abre de novo.
        </p>
      ) : carregando ? (
        <p className="text-[14px] text-[var(--muted)]">Carregando…</p>
      ) : semOpcao ? (
        <p className="text-[14px] text-[var(--ink-soft)]">
          Nenhum produto tem receita ainda. Monte a receita em Receitas, nesta mesma aba, e volte
          aqui.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Campo
                label="Produto"
                required
                hint="Só aparecem produtos com receita."
                error={mostrarErros ? erroProduto : undefined}
              >
                <select
                  value={produtoId}
                  onChange={(e) => {
                    setProdutoId(e.target.value);
                    setSkuId("");
                  }}
                  className={INPUT}
                >
                  <option value="">Escolher produto</option>
                  {opcoes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            {variacoes.length > 0 && (
              <div className="sm:col-span-2">
                <Campo label="Variação" required error={mostrarErros ? erroVariacao : undefined}>
                  <select
                    value={skuId}
                    onChange={(e) => setSkuId(e.target.value)}
                    className={INPUT}
                  >
                    <option value="">Escolher</option>
                    {variacoes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.variacao}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
            )}
            <Campo label="Peças prontas" required error={mostrarErros ? erroPecas : undefined}>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={pecas}
                onChange={(e) => setPecas(e.target.value)}
                className={INPUT}
              />
            </Campo>
            <Campo label="Data" required error={mostrarErros ? erroData : undefined}>
              <input
                type="date"
                value={data}
                max={hojeISO()}
                onChange={(e) => setData(e.target.value)}
                className={INPUT}
              />
            </Campo>
            <div className="sm:col-span-2">
              <Campo label="Observação" hint="opcional">
                <input
                  value={observacao}
                  maxLength={500}
                  onChange={(e) => setObservacao(e.target.value)}
                  className={INPUT}
                  placeholder="ex: lote da encomenda da Júlia"
                />
              </Campo>
            </div>
          </div>

          {/* Resumo curto na região viva (sempre montada): a lista inteira ali
              era relida pelo leitor de tela a cada tecla. */}
          <p className="sr-only" aria-live="polite">
            {produto && consumo.length > 0
              ? `Sai material de ${consumo.length} ${consumo.length === 1 ? "insumo" : "insumos"}${
                  negativos.length ? `, ${negativos.length} fica abaixo de zero` : ""
                }.`
              : ""}
          </p>
          <div className="mt-4 min-h-[21px] text-[14px]">
            {produto && consumo.length > 0 && (
              <>
                <ul className="space-y-1 text-[var(--ink-soft)]">
                  {consumo.map((c) => (
                    <li key={c.insumoId}>
                      {c.nome}: sai {fmtQtd(c.usa)} {c.unidade}, fica{" "}
                      <span className={c.fica < 0 ? "text-[var(--danger)]" : "text-[var(--ink)]"}>
                        {fmtQtd(c.fica)} {c.unidade}
                      </span>
                      .
                    </li>
                  ))}
                </ul>
                {negativos.length > 0 && (
                  <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
                    {negativos.join(" e ")} {negativos.length === 1 ? "fica" : "ficam"} abaixo de
                    zero. A produção entra mesmo assim: depois registre em Insumos a entrada do que
                    faltou.
                  </p>
                )}
                <p className="mt-2 text-[var(--ink-soft)]">
                  {produto.controlaEstoque
                    ? `Entram ${pecasTexto(qtd)} no estoque de ${produto.nome}${variacao ? ` ${variacao.variacao}` : ""}.`
                    : `${produto.nome} não tem estoque ligado: só os insumos baixam.`}
                </p>
              </>
            )}
          </div>
        </>
      )}
      {erroServidor && (
        <p role="alert" className="mt-2 text-[13px] text-[var(--danger)]">
          {erroServidor}
        </p>
      )}
    </Modal>
  );
}

/** As últimas produções, com "Desfazer" pra quem registrou errado. */
export function ProducoesRecentes({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const query = useProducoesRecentes(userId);
  const [desfazer, setDesfazer] = useState<Producao | null>(null);
  const [desfazendo, setDesfazendo] = useState(false);

  const confirmar = async () => {
    if (!desfazer) return;
    setDesfazendo(true);
    const { error } = await desfazerProducao(desfazer.id);
    setDesfazendo(false);
    if (error) {
      console.error("producao_desfazer", error);
      toastErro(
        error.message?.includes("já foi desfeita")
          ? "Essa produção já tinha sido desfeita."
          : "A Pólia One não conseguiu desfazer a produção. Nada mudou, tenta de novo.",
      );
      setDesfazer(null);
      void qc.invalidateQueries({ queryKey: chaveInsumos(userId) });
      return;
    }
    void qc.invalidateQueries({ queryKey: chaveInsumos(userId) });
    void qc.invalidateQueries({ queryKey: ["insumo-movimentos"] });
    void qc.invalidateQueries({ queryKey: chaveEstoque(userId) });
    toastSucesso("Produção desfeita. Os insumos voltaram pro estoque.");
    setDesfazer(null);
  };

  const lista = query.data ?? [];
  if (query.isLoading || (!query.isError && lista.length === 0)) return null;

  return (
    <section className="mt-8" aria-labelledby="producoes-titulo">
      <h2
        id="producoes-titulo"
        className="font-cabinet text-[18px] font-semibold text-[var(--ink)]"
      >
        Produções recentes
      </h2>
      {query.isError ? (
        <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
          A Pólia One não conseguiu ler as produções agora.{" "}
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="inline-flex min-h-11 items-center font-medium text-[var(--secondary-text)] hover:underline"
          >
            Tentar de novo
          </button>
        </p>
      ) : (
        <ul className="mt-3 overflow-hidden rounded-xl border border-[var(--line)] bg-white">
          {lista.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3 first:border-t-0"
            >
              <div className="min-w-0">
                <p
                  className={`text-[14px] ${p.desfeita ? "text-[var(--muted)] line-through" : "text-[var(--ink)]"}`}
                >
                  {p.produtoNome}
                  {p.variacao ? ` ${p.variacao}` : ""} · {pecasTexto(p.quantidade)}
                </p>
                <p className="text-[13px] text-[var(--muted)]">
                  {fmtDia(p.data)}
                  {p.observacao ? ` · ${p.observacao}` : ""}
                  {p.desfeita ? " · desfeita" : ""}
                </p>
              </div>
              {!p.desfeita && (
                <button
                  type="button"
                  onClick={() => setDesfazer(p)}
                  className={`${BTN_MIUDO_ACAO} bg-white`}
                >
                  Desfazer
                  <span className="sr-only">
                    {" "}
                    a produção de {pecasTexto(p.quantidade)} de {p.produtoNome}
                  </span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmarAcao
        open={!!desfazer}
        onOpenChange={(aberto) => {
          if (!aberto) setDesfazer(null);
        }}
        titulo={
          desfazer
            ? `Desfazer a produção de ${pecasTexto(desfazer.quantidade)} de ${desfazer.produtoNome}?`
            : ""
        }
        descricao="Os insumos voltam pro estoque e as peças saem do estoque do produto. O registro fica, marcado como desfeito."
        textoConfirmar="Desfazer produção"
        textoCarregando="Desfazendo…"
        carregando={desfazendo}
        destrutivo
        onConfirmar={confirmar}
      />
    </section>
  );
}
