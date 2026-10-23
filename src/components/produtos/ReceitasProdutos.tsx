// Receitas (ONE-133): quanto de cada insumo vai numa peça de cada produto. É
// o que a produção baixa. Kit não tem receita (é montado com os itens).

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO_ACAO } from "@/lib/botoes";
import { toastSucesso } from "@/lib/toast";
import {
  custoDaReceita,
  fmtQtd,
  lerQuantidade,
  pecasQueDaPraProduzir,
  qtdNoCampo,
  produzivel,
  sugestaoDaCalculadora,
  validarReceita,
  type InsumoComSaldo,
  type LinhaReceita,
} from "@/lib/producao";
import { useProdutosComEstoque, type ProdutoVendavel } from "@/components/vendas/dados";
import { fmt } from "./tipos";
import { chaveInsumos, salvarInsumo, salvarReceita, useReceitas } from "./insumosDados";
import { ModalInsumo } from "./ModalInsumo";

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

export function ReceitasProdutos({
  userId,
  insumos,
  onAbrirCatalogo,
}: {
  userId: string;
  insumos: InsumoComSaldo[];
  onAbrirCatalogo: () => void;
}) {
  const produtosQuery = useProdutosComEstoque(userId);
  const receitasQuery = useReceitas(userId);
  const [editar, setEditar] = useState<ProdutoVendavel | null>(null);
  const porId = new Map(insumos.map((i) => [i.id, i]));
  const produtos = (produtosQuery.data ?? []).filter(produzivel);

  return (
    <section className="mt-8" aria-labelledby="receitas-titulo">
      <h2 id="receitas-titulo" className="font-cabinet text-[18px] font-semibold text-[var(--ink)]">
        Receitas
      </h2>
      <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
        Quanto de cada insumo vai numa peça. É isso que sai do estoque a cada produção.
      </p>

      {produtosQuery.isError || receitasQuery.isError ? (
        <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
          A Pólia One não conseguiu ler as receitas agora.{" "}
          <button
            type="button"
            onClick={() => {
              void produtosQuery.refetch();
              void receitasQuery.refetch();
            }}
            className="inline-flex min-h-11 items-center font-medium text-[var(--secondary-text)] hover:underline"
          >
            Tentar de novo
          </button>
        </p>
      ) : produtosQuery.isLoading || receitasQuery.isLoading ? (
        <p className="mt-3 text-[14px] text-[var(--muted)]">Carregando as receitas…</p>
      ) : produtos.length === 0 ? (
        <div className="mt-3 text-[14px] text-[var(--ink-soft)]">
          <p>Receita é de produto físico. Cadastre um no Catálogo pra montar a receita dele.</p>
          <button
            type="button"
            onClick={onAbrirCatalogo}
            className={`${BTN_MIUDO_ACAO} mt-2 bg-white`}
          >
            Abrir o Catálogo
          </button>
        </div>
      ) : (
        <ul className="mt-3 overflow-hidden rounded-xl border border-[var(--line)] bg-white">
          {produtos.map((p) => {
            const receita = receitasQuery.data?.get(p.id) ?? [];
            const custo = custoDaReceita(receita, porId);
            const pecas = pecasQueDaPraProduzir(receita, porId);
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3 first:border-t-0"
              >
                <div className="min-w-0">
                  <p className="text-[14px] text-[var(--ink)]">{p.nome}</p>
                  <p className="text-[13px] text-[var(--muted)]">
                    {receita.length === 0
                      ? "sem receita"
                      : [
                          `${receita.length} ${receita.length === 1 ? "insumo" : "insumos"}`,
                          custo != null ? `material ${fmt(custo)} por peça` : null,
                          pecas != null
                            ? pecas === 0
                              ? "o material acabou"
                              : `dá pra produzir ${fmtQtd(pecas)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditar(p)}
                  className={`${BTN_MIUDO_ACAO} bg-white`}
                >
                  {receita.length === 0 ? "Montar receita" : "Editar receita"}
                  <span className="sr-only"> de {p.nome}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editar && (
        <ModalReceita
          userId={userId}
          produto={editar}
          receita={receitasQuery.data?.get(editar.id) ?? []}
          insumos={insumos}
          onClose={() => setEditar(null)}
        />
      )}
    </section>
  );
}

interface LinhaForm {
  chave: number;
  insumoId: string;
  quantidade: string;
}

function ModalReceita({
  userId,
  produto,
  receita,
  insumos,
  onClose,
}: {
  userId: string;
  produto: ProdutoVendavel;
  receita: LinhaReceita[];
  insumos: InsumoComSaldo[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const proximaChave = useRef(receita.length + 1);
  const botaoAdicionar = useRef<HTMLButtonElement>(null);
  const [linhas, setLinhas] = useState<LinhaForm[]>(() =>
    receita.length
      ? receita.map((l, i) => ({
          chave: i,
          insumoId: l.insumoId,
          quantidade: qtdNoCampo(l.quantidade),
        }))
      : [{ chave: 0, insumoId: "", quantidade: "" }],
  );
  const [mostrarErros, setMostrarErros] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [novoInsumo, setNovoInsumo] = useState(false);
  const [trazendo, setTrazendo] = useState(false);
  const [avisoCalculadora, setAvisoCalculadora] = useState<string | null>(null);

  // Materiais que ela já preencheu "pelo pacote" na Calculadora deste produto.
  const calculadora = useQuery({
    queryKey: ["produto-breakdown", produto.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("calculadora_breakdown")
        .eq("id", produto.id)
        .single();
      if (error) throw error;
      return sugestaoDaCalculadora(
        data?.calculadora_breakdown as { valores?: Record<string, unknown> } | null,
      );
    },
  });
  const sugestoes = calculadora.data ?? [];

  const porId = new Map(insumos.map((i) => [i.id, i]));
  const preenchidas = linhas.filter((l) => l.insumoId || l.quantidade.trim());
  const receitaNova: LinhaReceita[] = preenchidas.map((l) => ({
    insumoId: l.insumoId,
    quantidade: lerQuantidade(l.quantidade),
  }));
  const problema = validarReceita(receitaNova);
  const erro =
    problema === "sem_insumo"
      ? "Escolha o insumo de cada linha, ou tire a linha."
      : problema === "quantidade"
        ? "Coloque quanto vai numa peça em cada linha, de 0,001 a 100.000."
        : problema === "repetido"
          ? "O mesmo insumo apareceu duas vezes. Junte numa linha só."
          : null;
  const custo = problema ? null : custoDaReceita(receitaNova, porId);
  const pecas = problema ? null : pecasQueDaPraProduzir(receitaNova, porId);
  const semCusto = receitaNova.filter((l) => porId.get(l.insumoId)?.custoUnitario == null).length;

  const mudar = (chave: number, m: Partial<LinhaForm>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...m } : l)));
  const adicionar = (insumoId = "", quantidade = "") =>
    setLinhas((ls) => [
      ...ls.filter((l) => l.insumoId || l.quantidade.trim()),
      { chave: proximaChave.current++, insumoId, quantidade },
    ]);

  // O insumo cadastrado aqui dentro entra direto numa linha.
  const [entrouAgora, setEntrouAgora] = useState<string | null>(null);
  useEffect(() => {
    if (entrouAgora && porId.has(entrouAgora)) {
      adicionar(entrouAgora);
      setEntrouAgora(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrouAgora, insumos]);

  const usarCalculadora = async () => {
    setTrazendo(true);
    setAvisoCalculadora(null);
    const porNome = new Map(insumos.map((i) => [i.nome.toLowerCase(), i.id]));
    const novas: { insumoId: string; quantidade: string }[] = [];
    let criados = 0;
    for (const s of sugestoes) {
      let id = porNome.get(s.nome.toLowerCase());
      if (!id) {
        const { data, error } = await salvarInsumo({
          id: null,
          nome: s.nome,
          unidade: s.unidade,
          custo: s.custoUnitario,
          minimo: 0,
          inicial: 0,
        });
        if (error || !data) {
          console.error("insumo_da_calculadora", error);
          setTrazendo(false);
          setAvisoCalculadora(
            `A Pólia One não conseguiu cadastrar ${s.nome}. Tenta de novo: o que já entrou não duplica.`,
          );
          void qc.invalidateQueries({ queryKey: chaveInsumos(userId) });
          return;
        }
        id = data;
        criados++;
      }
      novas.push({ insumoId: id, quantidade: qtdNoCampo(s.quantidade) });
    }
    await qc.invalidateQueries({ queryKey: chaveInsumos(userId) });
    setLinhas((ls) => {
      const atuais = ls.filter((l) => l.insumoId || l.quantidade.trim());
      const ja = new Set(atuais.map((l) => l.insumoId));
      return [
        ...atuais,
        ...novas
          .filter((n) => !ja.has(n.insumoId))
          .map((n) => ({ chave: proximaChave.current++, ...n })),
      ];
    });
    setTrazendo(false);
    setAvisoCalculadora(
      criados > 0
        ? `${criados} ${criados === 1 ? "insumo novo entrou" : "insumos novos entraram"} na lista com estoque zerado. Depois de salvar a receita, registre a entrada de cada um.`
        : "Os materiais da Calculadora entraram na receita. Confira as quantidades e salve.",
    );
  };

  const salvar = async () => {
    if (problema) {
      setMostrarErros(true);
      return;
    }
    setSalvando(true);
    setErroServidor(null);
    const { error } = await salvarReceita(produto.id, receitaNova);
    setSalvando(false);
    if (error) {
      console.error("receita_salvar", error);
      const msg = error.message ?? "";
      setErroServidor(
        msg.startsWith("Insumo não encontrado")
          ? "Um insumo desta receita saiu da lista. Feche, abra a receita de novo e confira as linhas."
          : msg.startsWith("Kit não tem receita") || msg.startsWith("Receita é só")
            ? "Este produto virou kit ou deixou de ser físico, então não tem receita."
            : "A Pólia One não conseguiu salvar a receita. Tenta de novo.",
      );
      return;
    }
    void qc.invalidateQueries({ queryKey: chaveInsumos(userId) });
    toastSucesso(
      receitaNova.length
        ? `Receita de ${produto.nome} salva.`
        : `${produto.nome} ficou sem receita.`,
    );
    onClose();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={`Receita de ${produto.nome}`}
      description="Quanto de cada insumo vai numa peça."
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
            Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={salvando} className={BTN_ACAO}>
            {salvando ? "Salvando…" : "Salvar receita"}
          </button>
        </>
      }
    >
      {sugestoes.length > 0 && (
        <div className="mb-4 rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink-soft)]">
          <p>
            A Calculadora deste produto tem {sugestoes.length}{" "}
            {sugestoes.length === 1 ? "material" : "materiais"}:{" "}
            {sugestoes.map((s) => s.nome).join(", ")}. Os que ainda não estão em Insumos entram na
            lista na hora, com estoque zerado.
          </p>
          <button
            type="button"
            onClick={() => void usarCalculadora()}
            disabled={trazendo}
            className="inline-flex min-h-11 items-center font-medium text-[var(--secondary-text)] hover:underline disabled:opacity-60"
          >
            {trazendo ? "Trazendo…" : "Usar na receita"}
          </button>
        </div>
      )}
      {avisoCalculadora && (
        <p className="mb-4 text-[13px] text-[var(--ink-soft)]" role="status">
          {avisoCalculadora}
        </p>
      )}

      {insumos.length === 0 && sugestoes.length === 0 ? (
        <p className="text-[14px] text-[var(--ink-soft)]">
          Ainda não tem insumo na lista. Cadastre o primeiro pra montar a receita.
        </p>
      ) : (
        <ul className="flex flex-col">
          {linhas.map((l, idx) => {
            const i = porId.get(l.insumoId);
            const qtd = lerQuantidade(l.quantidade);
            // Linha vazia é descartada no salvar: não ganha erro.
            const vazia = !l.insumoId && !l.quantidade.trim();
            return (
              <li
                key={l.chave}
                className="grid grid-cols-[minmax(0,1fr)_96px_44px] items-start gap-2 border-t border-[var(--line)] py-3 first:border-t-0 first:pt-0"
              >
                <Campo
                  label={`Insumo ${idx + 1}`}
                  error={mostrarErros && !vazia && !l.insumoId ? "Escolha o insumo." : undefined}
                >
                  <select
                    value={l.insumoId}
                    onChange={(e) => mudar(l.chave, { insumoId: e.target.value })}
                    className={INPUT}
                  >
                    <option value="">Escolher insumo</option>
                    {insumos.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nome}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo
                  label={`Por peça${i ? ` (${i.unidade})` : ""}`}
                  error={
                    mostrarErros && !vazia && !(qtd >= 0.001 && qtd <= 100000)
                      ? "Coloque a quantidade."
                      : undefined
                  }
                >
                  <input
                    inputMode="decimal"
                    value={l.quantidade}
                    onChange={(e) => mudar(l.chave, { quantidade: e.target.value })}
                    className={INPUT}
                    placeholder="0"
                  />
                </Campo>
                <button
                  type="button"
                  onClick={() => {
                    setLinhas((ls) => ls.filter((x) => x.chave !== l.chave));
                    botaoAdicionar.current?.focus();
                  }}
                  aria-label={`Tirar o insumo ${idx + 1} da receita`}
                  className="mt-6 inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {insumos.length > 0 && (
          <button
            ref={botaoAdicionar}
            type="button"
            onClick={() => adicionar()}
            className={`${BTN_MIUDO_ACAO} bg-white`}
          >
            + Adicionar insumo
          </button>
        )}
        <button
          type="button"
          onClick={() => setNovoInsumo(true)}
          className={`${BTN_MIUDO_ACAO} bg-white`}
        >
          Cadastrar insumo novo
        </button>
      </div>

      <div className="mt-3 space-y-1 text-[13px]" aria-live="polite">
        {mostrarErros && erro ? (
          <p className="text-[var(--danger)]">{erro}</p>
        ) : !problema && receitaNova.length > 0 ? (
          <>
            {custo == null && semCusto > 0 && (
              <p className="text-[var(--ink-soft)]">
                {semCusto} {semCusto === 1 ? "insumo está" : "insumos estão"} sem custo: o material
                da peça fica sem valor. O custo entra no cadastro de cada insumo.
              </p>
            )}
            {custo != null && (
              <p className="text-[var(--ink-soft)]">
                Material de uma peça: {fmt(custo)}.
                {produto.precoCusto != null &&
                  ` O custo cadastrado no produto é ${fmt(produto.precoCusto)}.`}
              </p>
            )}
            {pecas != null && (
              <p className="text-[var(--ink-soft)]">
                {pecas === 0
                  ? "Com o material de hoje, não dá pra produzir nenhuma peça."
                  : `Com o material de hoje dá pra produzir ${fmtQtd(pecas)} ${pecas === 1 ? "peça" : "peças"}.`}
              </p>
            )}
          </>
        ) : null}
      </div>
      {erroServidor && (
        <p role="alert" className="mt-2 text-[13px] text-[var(--danger)]">
          {erroServidor}
        </p>
      )}

      {novoInsumo && (
        <ModalInsumo
          insumo={null}
          onClose={() => setNovoInsumo(false)}
          onSaved={(id) => {
            setNovoInsumo(false);
            setEntrouAgora(id);
            void qc.invalidateQueries({ queryKey: chaveInsumos(userId) });
          }}
        />
      )}
    </Modal>
  );
}
