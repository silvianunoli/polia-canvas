import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Abas from "@radix-ui/react-tabs";
import {
  ArrowDown,
  ArrowUp,
  Calculator,
  ChevronDown,
  Lock,
  Package,
  Pencil,
  RefreshCw,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { BTN_ACAO, BTN_MIUDO } from "@/lib/botoes";
import { COTAS_CONFERE, temNumerosDoMes, temVitrine } from "@/lib/planos";
import { ehPlanoGratis } from "@/lib/planoGratis";
import { toastErro, toastSucesso } from "@/lib/toast";
import { BlockError } from "@/components/ui/BlockError";
import { sobraDoProduto } from "@/lib/precificacao.functions";
import { MenuOpcoes } from "@/components/ui/MenuOpcoes";
import { Switch } from "@/components/ui/switch";
import { ModalProduto } from "@/components/produtos/ModalProduto";
import { ModalImportarProdutos } from "@/components/produtos/ModalImportarProdutos";
import { CHAVE_PRODUTOS_CATALOGO } from "@/components/catalogo/dados";
import { fmt, nomeBate, TIPO_LABEL, type Produto } from "@/components/produtos/tipos";
import { AbaEstoque } from "@/components/produtos/AbaEstoque";
import { AbaEquipamentos } from "@/components/produtos/AbaEquipamentos";
import { AbaInsumos } from "@/components/produtos/AbaInsumos";
import { useProdutosComEstoque, type SkuProduto } from "@/components/vendas/dados";
import { useInsumos } from "@/components/produtos/insumosDados";
import { useEquipamentos } from "@/components/produtos/equipamentosDados";
import { estoqueBaixo } from "@/lib/vendas";
import {
  contagemDoCatalogo,
  direcaoInicial,
  filtrarCatalogo,
  FILTROS_CATALOGO,
  lerOrdemDigitada,
  mostraTipoNoCard,
  ordenarCatalogo,
  reposicionar,
  ROTULO_FILTRO,
  type ColunaCatalogo,
  type DirecaoOrdem,
  type FiltroCatalogo,
} from "@/lib/catalogoProdutos";

const SELECT_PRODUTO =
  "id, user_id, nome, tipo, foto_url, preco_venda, preco_custo, descricao, observacao_interna, canal, controla_estoque, no_catalogo, usa_paleta, cor_da_foto, max_cores, preco_sob_consulta, cor_sob_consulta, tamanho_sob_consulta, pronta_entrega, catalogo_ordem, categoria_id, preco_de, arquivado, preco_atualizado_em, historico_precos, calculadora_breakdown, created_at, updated_at";

const CLASSE_ABA =
  "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 border-transparent px-3 text-[14px] text-[var(--muted)] transition-colors duration-150 hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--secondary-text)] data-[state=active]:border-[var(--ink)] data-[state=active]:text-[var(--ink)]";

function Contador({ n }: { n: number | null | undefined }) {
  if (n == null) return null;
  return (
    <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[12px] tabular-nums text-[var(--ink-soft)]">
      {n}
    </span>
  );
}

/** Lucro em % do produto, ou null sem custo. Mesma conta do card. */
function lucroPctDoProduto(p: Produto): number | null {
  const sobra = sobraDoProduto({
    precoVenda: Number(p.preco_venda),
    precoCusto: p.preco_custo != null ? Number(p.preco_custo) : null,
    breakdown: p.calculadora_breakdown,
  });
  return sobra ? sobra.pct : null;
}

type AbaProdutos = "catalogo" | "estoque" | "insumos" | "equipamentos";

interface ProdutosSearch {
  aba?: AbaProdutos;
}

export const Route = createFileRoute("/_authenticated/produtos")({
  validateSearch: (search: Record<string, unknown>): ProdutosSearch => ({
    aba:
      search.aba === "estoque" || search.aba === "insumos" || search.aba === "equipamentos"
        ? search.aba
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Produtos · Pólia One" },
      {
        name: "description",
        content: "Seu catálogo de produtos e a calculadora de preço.",
      },
    ],
  }),
  component: ProdutosPage,
});

function ProdutosPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const meta = useUserMeta();
  // Grátis do jeito que a trava de rota entende (cancelada conta) e só depois
  // de o perfil carregar: antes o cadeado de cota piscava pra quem paga.
  const ehConfere = ehPlanoGratis(meta);
  const { aba: abaDaUrl } = Route.useSearch();
  const aba: AbaProdutos = abaDaUrl ?? "catalogo";
  const trocarAba = (nova: AbaProdutos) =>
    void navigate({
      to: "/produtos",
      search: nova === "catalogo" ? {} : { aba: nova },
      replace: true,
    });
  const estoqueQuery = useProdutosComEstoque(userId);
  const skusPorProduto = useMemo(
    () => new Map((estoqueQuery.data ?? []).map((p) => [p.id, p.skus])),
    [estoqueQuery.data],
  );

  // ── Modal ──
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoEdit, setProdutoEdit] = useState<Produto | null>(null);
  const [importarAberto, setImportarAberto] = useState(false);
  // Vitrine online (Premium e Pro): a ordem é a coluna Ordem da lista (ONE-237).
  const ehPro = temVitrine(meta.plano);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroCatalogo>("ativos");
  const [ordem, setOrdem] = useState<{ coluna: ColunaCatalogo; direcao: DirecaoOrdem }>({
    coluna: "ordem",
    direcao: "asc",
  });
  // Produto com chave mexendo agora: a chave dele espera a gravação.
  const [mudandoId, setMudandoId] = useState<string | null>(null);
  // Contagem das abas: mesmas leituras (e o mesmo cache) das próprias abas.
  const insumosQuery = useInsumos(userId);
  const equipamentosQuery = useEquipamentos(userId);

  const produtosQuery = useQuery({
    queryKey: ["produtos", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select(SELECT_PRODUTO)
        .eq("user_id", userId!)
        .eq("arquivado", false)
        .order("created_at", { ascending: false });
      // Leitura que falha não pode virar "Nenhum produto ainda" (e zerar a
      // conta da cota, liberando o botão de adicionar).
      if (error) throw error;
      return (data ?? []) as unknown as Produto[];
    },
  });

  const produtos = useMemo(() => produtosQuery.data ?? [], [produtosQuery.data]);

  // Arquivados (23/11/2026): antes não apareciam em lugar nenhum e não tinham
  // como voltar, então arquivar funcionava como apagar. Agora têm filtro e
  // "Reativar".
  const arquivadosQuery = useQuery({
    queryKey: ["produtos-arquivados", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select(SELECT_PRODUTO)
        .eq("user_id", userId!)
        .eq("arquivado", true)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Produto[];
    },
  });
  const arquivados = useMemo(() => arquivadosQuery.data ?? [], [arquivadosQuery.data]);

  const contagem = useMemo(
    () => contagemDoCatalogo(produtos, arquivados.length),
    [produtos, arquivados.length],
  );
  const mostrarTipo = useMemo(() => mostraTipoNoCard(produtos), [produtos]);
  const listaDoFiltro = useMemo(
    () =>
      ordenarCatalogo(
        filtrarCatalogo(produtos, arquivados, filtro).filter((p) => nomeBate(p.nome, busca)),
        ordem.coluna,
        ordem.direcao,
        lucroPctDoProduto,
      ),
    [filtro, arquivados, produtos, busca, ordem],
  );
  const ordenarPor = (coluna: ColunaCatalogo) =>
    setOrdem((atual) =>
      atual.coluna === coluna
        ? { coluna, direcao: atual.direcao === "asc" ? "desc" : "asc" }
        : { coluna, direcao: direcaoInicial(coluna) },
    );

  // Cota do plano Grátis: 5 produtos ativos. Os mais antigos por created_at ficam
  // dentro da cota; o excedente (de um downgrade, por ex.) vira somente
  // leitura — mesma regra imposta pela trigger do banco (20260727130000).
  const idsExcedentes = useMemo(() => {
    if (!ehConfere) return new Set<string>();
    const porCriacao = [...produtos].sort((a, b) => a.created_at.localeCompare(b.created_at));
    return new Set(porCriacao.slice(COTAS_CONFERE.produtos).map((p) => p.id));
  }, [ehConfere, produtos]);
  const cotaAtingida = ehConfere && produtos.length >= COTAS_CONFERE.produtos;

  const abrirAdicionar = () => {
    setProdutoEdit(null);
    setModalAberto(true);
  };

  const abrirEditar = (p: Produto) => {
    setProdutoEdit(p);
    setModalAberto(true);
  };

  // A calculadora é ferramenta própria (/calculadora): recalcular leva pra lá
  // já com o produto carregado, e ela devolve pra cá ao salvar.
  const abrirRecalcular = (p: Produto) => {
    void navigate({ to: "/calculadora", search: { produto: p.id } });
  };

  const recarregarCatalogo = () => {
    qc.invalidateQueries({ queryKey: ["produtos", userId] });
    qc.invalidateQueries({ queryKey: ["produtos-arquivados", userId] });
    qc.invalidateQueries({ queryKey: ["painel-produtos-inativos", userId] });
    qc.invalidateQueries({ queryKey: ["estoque", userId] });
  };

  /**
   * Chaves da lista (23/11/2026, pedido da Sil): "Ativo" arquiva ou reativa,
   * "Vitrine" liga ou desliga o produto na Vitrine online. A chave espera a
   * gravação (desabilitada) e a lista relê no fim; se falhar, nada muda e um
   * aviso diz por quê.
   */
  const mudarProduto = async (
    p: Produto,
    mudanca: { arquivado: boolean } | { no_catalogo: boolean },
  ) => {
    if (mudandoId) return;
    setMudandoId(p.id);
    const { error } = await supabase.from("produtos").update(mudanca).eq("id", p.id);
    setMudandoId(null);
    if (error) {
      console.error("produto_chave", error);
      const reativando = "arquivado" in mudanca && !mudanca.arquivado;
      toastErro(
        reativando && cotaAtingida
          ? `No plano Grátis cabem ${COTAS_CONFERE.produtos} produtos ativos. Desative um pra ativar este.`
          : "A Pólia One não conseguiu salvar a mudança. Tenta de novo.",
      );
      return;
    }
    if ("arquivado" in mudanca && filtro !== "todos") {
      toastSucesso(
        mudanca.arquivado
          ? `"${p.nome}" ficou inativo. Ele está no filtro "Inativos".`
          : `"${p.nome}" voltou a ficar ativo.`,
      );
    }
    recarregarCatalogo();
  };

  /**
   * Coluna "Ordem" (23/11/2026, pedido da Sil): o número digitado põe o
   * produto naquela posição da lista e da loja; vazio tira o número. Quem já
   * tinha o número desce um (regra em reposicionar). A tela muda na hora e
   * volta atrás se a gravação falhar.
   */
  const mudarOrdem = async (p: Produto, texto: string): Promise<boolean> => {
    const nova = lerOrdemDigitada(texto);
    if (nova === "invalido") {
      toastErro(
        "A ordem aceita só número inteiro, a partir de 1. Pra tirar o número, deixe o campo vazio.",
      );
      return false;
    }
    if (nova === (p.catalogo_ordem ?? null)) return true;
    if (mudandoId) return false;
    const todos = [...produtos, ...arquivados];
    const mudancas = reposicionar(
      todos.map((x) => ({ id: x.id, ordem: x.catalogo_ordem ?? null })),
      p.id,
      nova,
    );
    const novaOrdem = new Map(mudancas.map((m) => [m.id, m.ordem]));
    const aplicar = (lista: Produto[] | undefined) =>
      lista?.map((x) => (novaOrdem.has(x.id) ? { ...x, catalogo_ordem: novaOrdem.get(x.id) } : x));
    const chaveAtivos = ["produtos", userId];
    const chaveInativos = ["produtos-arquivados", userId];
    const antesAtivos = qc.getQueryData<Produto[]>(chaveAtivos);
    const antesInativos = qc.getQueryData<Produto[]>(chaveInativos);
    qc.setQueryData<Produto[]>(chaveAtivos, aplicar);
    qc.setQueryData<Produto[]>(chaveInativos, aplicar);
    setMudandoId(p.id);
    const resultados = await Promise.all(
      mudancas.map((m) =>
        supabase
          .from("produtos")
          .update({ catalogo_ordem: m.ordem } as never)
          .eq("id", m.id),
      ),
    );
    setMudandoId(null);
    const falhou = resultados.find((r) => r.error);
    if (falhou) {
      console.error("produto_ordem", falhou.error);
      qc.setQueryData(chaveAtivos, antesAtivos);
      qc.setQueryData(chaveInativos, antesInativos);
      toastErro("A Pólia One não conseguiu salvar a ordem. Tenta de novo.");
      return false;
    }
    recarregarCatalogo();
    qc.invalidateQueries({ queryKey: [CHAVE_PRODUTOS_CATALOGO, userId] });
    return true;
  };

  if (produtosQuery.isError) {
    return (
      <PaginaLogada largura="larga" eyebrow="Produtos" titulo="Seus produtos.">
        <div role="alert">
          <BlockError
            message="A Pólia One não conseguiu ler os seus produtos agora. Nada foi perdido, é só a leitura que falhou."
            onRetry={() => void produtosQuery.refetch()}
          />
        </div>
      </PaginaLogada>
    );
  }

  // isPending, não isLoading: com a sessão ainda chegando a leitura fica
  // desligada, isLoading é false e a tela mostrava "Nenhum produto ainda."
  // por um instante, como se tudo tivesse sumido.
  if (produtosQuery.isPending) {
    return (
      <PaginaLogada largura="larga" eyebrow="Produtos" titulo="Seus produtos.">
        <p className="text-[14px] text-[var(--muted)]">Carregando seus produtos…</p>
      </PaginaLogada>
    );
  }

  return (
    <PaginaLogada
      largura="larga"
      eyebrow="Produtos"
      titulo="Seus produtos."
      subtitulo="O que você vende, quanto custa e quanto lucra em cada venda."
      acao={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={abrirAdicionar}
            disabled={cotaAtingida}
            className={BTN_ACAO}
          >
            + Produto
          </button>
          <MenuOpcoes
            align="end"
            ariaLabel="Mais ações de Produtos"
            trigger={
              <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)]">
                Mais
                <ChevronDown size={14} aria-hidden="true" />
              </span>
            }
            itens={[
              {
                label: "Importar planilha",
                icone: Upload,
                onClick: () => setImportarAberto(true),
                desabilitado: cotaAtingida,
              },
              {
                label: "Calcular um preço",
                icone: Calculator,
                onClick: () => void navigate({ to: "/calculadora" }),
              },
            ]}
          />
        </div>
      }
    >
      <Abas.Root value={aba} onValueChange={(v) => trocarAba(v as AbaProdutos)}>
        <Abas.List
          aria-label="Partes de Produtos"
          className="flex flex-wrap gap-1 border-b border-[var(--line)]"
        >
          <Abas.Trigger value="catalogo" className={CLASSE_ABA}>
            Catálogo <Contador n={produtos.length} />
          </Abas.Trigger>
          <Abas.Trigger value="insumos" className={CLASSE_ABA}>
            Materiais e receitas <Contador n={insumosQuery.data?.length} />
          </Abas.Trigger>
          <Abas.Trigger value="estoque" className={CLASSE_ABA}>
            Estoque <Contador n={produtos.filter((p) => p.controla_estoque).length} />
          </Abas.Trigger>
          <Abas.Trigger value="equipamentos" className={CLASSE_ABA}>
            Equipamentos <Contador n={equipamentosQuery.data?.length} />
          </Abas.Trigger>
        </Abas.List>

        <Abas.Content value="equipamentos" className="mt-6 focus-visible:outline-none">
          {userId && (
            <AbaEquipamentos
              userId={userId}
              bloqueado={!meta.carregando && !temNumerosDoMes(meta.plano)}
            />
          )}
        </Abas.Content>

        <Abas.Content value="insumos" className="mt-6 focus-visible:outline-none">
          {userId && <AbaInsumos userId={userId} onAbrirCatalogo={() => trocarAba("catalogo")} />}
        </Abas.Content>

        <Abas.Content value="estoque" className="mt-6 focus-visible:outline-none">
          {userId && (
            <AbaEstoque
              userId={userId}
              onEditarProduto={(id) => {
                const p = produtos.find((x) => x.id === id);
                if (p) abrirEditar(p);
              }}
              onAbrirCatalogo={() => trocarAba("catalogo")}
            />
          )}
        </Abas.Content>

        <Abas.Content value="catalogo" className="mt-6 focus-visible:outline-none">
          {cotaAtingida && (
            <div className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[13px] text-[var(--ink-soft)]">
              No plano Grátis você cria até {COTAS_CONFERE.produtos} produtos. Suba pro Premium pra
              deixar ilimitado.{" "}
              {/* Botão de assinar leva ao checkout, não a outra tela de bloqueio. */}
              <Link
                to="/assinar"
                search={{ plano: "controle" }}
                className="font-medium text-[var(--secondary-text)] no-underline hover:underline"
              >
                Assinar o Premium
              </Link>
            </div>
          )}

          {produtos.length === 0 && arquivados.length === 0 ? (
            <Vazio
              icone={Package}
              titulo="Nenhum produto ainda."
              texto="Adicione um aqui. O preço calculado na Calculadora também entra aqui sozinho."
              acao={
                // A ação do vazio é a da própria tela. O atalho pro Módulo 3 do
                // Planejamento saiu com ele em 31/10/2026.
                <button
                  type="button"
                  onClick={abrirAdicionar}
                  disabled={cotaAtingida}
                  className={BTN_ACAO}
                >
                  + Adicionar produto
                </button>
              }
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-full sm:w-64">
                  <label htmlFor="busca-produto" className="sr-only">
                    Buscar produto pelo nome
                  </label>
                  <input
                    id="busca-produto"
                    type="search"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar pelo nome"
                    className="min-h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
                  />
                </div>
                <div role="group" aria-label="Filtrar produtos" className="flex flex-wrap gap-2">
                  {FILTROS_CATALOGO.map((f) =>
                    f !== "ativos" && f !== "todos" && contagem[f] === 0 ? null : (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={filtro === f}
                        onClick={() => setFiltro(f)}
                        className={`${BTN_MIUDO} min-h-11 gap-1.5 ${
                          filtro === f ? "!bg-[var(--secondary)]" : "bg-white"
                        }`}
                      >
                        {ROTULO_FILTRO[f]}
                        <span className="tabular-nums text-[var(--ink-soft)]">{contagem[f]}</span>
                      </button>
                    ),
                  )}
                </div>
              </div>

              {filtro === "inativos" && (
                <p className="mt-3 text-[13px] text-[var(--muted)]">
                  Inativo sai da Vitrine e das telas de venda, com tudo guardado. A chave "Ativo"
                  traz de volta.
                </p>
              )}

              {listaDoFiltro.length === 0 ? (
                <p className="mt-4 text-[14px] text-[var(--muted)]" role="status">
                  {busca.trim()
                    ? `Nenhum produto com "${busca.trim()}" no nome neste filtro.`
                    : "Nenhum produto neste filtro."}
                </p>
              ) : (
                <ListaDeProdutos
                  produtos={listaDoFiltro}
                  ordem={ordem}
                  onOrdenar={ordenarPor}
                  mostrarTipo={mostrarTipo}
                  mostrarVitrine={ehPro}
                  idsSomenteLeitura={idsExcedentes}
                  mudandoId={mudandoId}
                  skusPorProduto={skusPorProduto}
                  onEditar={abrirEditar}
                  onRecalcular={abrirRecalcular}
                  onAtivo={(p, ativo) => void mudarProduto(p, { arquivado: !ativo })}
                  onVitrine={(p, ligada) => void mudarProduto(p, { no_catalogo: ligada })}
                  onOrdem={mudarOrdem}
                />
              )}
            </>
          )}
        </Abas.Content>
      </Abas.Root>

      {/* ───────── Modal ───────── */}
      {modalAberto && userId && (
        <ModalProduto
          userId={userId}
          prefill={null}
          produtoEdit={produtoEdit}
          onClose={() => setModalAberto(false)}
          onSaved={() => {
            recarregarCatalogo();
            qc.invalidateQueries({ queryKey: ["produto-skus"] });
            setModalAberto(false);
          }}
        />
      )}

      {importarAberto && userId && (
        <ModalImportarProdutos
          userId={userId}
          nomesExistentes={produtos.map((p) => p.nome)}
          restanteCota={ehConfere ? Math.max(0, COTAS_CONFERE.produtos - produtos.length) : null}
          onClose={() => setImportarAberto(false)}
          onMudou={() => qc.invalidateQueries({ queryKey: ["produtos", userId] })}
        />
      )}
    </PaginaLogada>
  );
}

/* ============== Lista de produtos ============== */
const AVATAR_BGS = ["var(--secondary-light)", "var(--surface-pink)", "var(--surface)"];

type Ordem = { coluna: ColunaCatalogo; direcao: DirecaoOrdem };

interface PropsLista {
  produtos: Produto[];
  ordem: Ordem;
  onOrdenar: (coluna: ColunaCatalogo) => void;
  /** Sem mistura de tipos no catálogo, "Produto físico" em toda linha não diz nada. */
  mostrarTipo: boolean;
  /** A chave "Vitrine" só existe pra quem tem a Vitrine online (Premium e Pro). */
  mostrarVitrine: boolean;
  idsSomenteLeitura: Set<string>;
  mudandoId: string | null;
  skusPorProduto: Map<string, SkuProduto[]>;
  onEditar: (p: Produto) => void;
  onRecalcular: (p: Produto) => void;
  onAtivo: (p: Produto, ativo: boolean) => void;
  onVitrine: (p: Produto, ligada: boolean) => void;
  /** Grava o número da coluna "Ordem"; devolve false quando não salvou. */
  onOrdem: (p: Produto, texto: string) => Promise<boolean>;
}

/**
 * Catálogo em lista (23/11/2026, pedido da Sil: "deixar como lista e não
 * parecido com uma vitrine"). Foto, preço, custo, lucro e as chaves de
 * Vitrine e Ativo; o cabeçalho de cada coluna ordena, e o segundo clique
 * inverte. No celular, cada produto vira um bloco com as mesmas informações.
 */
function ListaDeProdutos(props: PropsLista) {
  const { produtos, ordem, onOrdenar, mostrarVitrine } = props;

  return (
    <>
      {/* Celular: um bloco por produto, as chaves sempre à vista. */}
      <div className="mt-4 flex flex-wrap items-center gap-2 sm:hidden">
        <label className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
          Ordenar por
          <select
            value={ordem.coluna}
            onChange={(e) => onOrdenar(e.target.value as ColunaCatalogo)}
            className="min-h-11 rounded-lg border border-[var(--line)] bg-white px-2 text-[14px] text-[var(--ink)]"
          >
            <option value="ordem">Ordem</option>
            <option value="recentes">Mais recentes</option>
            <option value="nome">Produto</option>
            <option value="preco">Preço</option>
            <option value="custo">Custo</option>
            <option value="lucro">Lucro</option>
            <option value="status">Status</option>
          </select>
        </label>
      </div>
      <ul className="mt-3 flex flex-col gap-2 sm:hidden">
        {produtos.map((p, i) => (
          <li key={p.id} className="rounded-xl border border-[var(--line)] bg-white p-3">
            <div className="flex items-start gap-3">
              <CampoOrdem produto={p} {...props} />
              <FotoDoProduto produto={p} indice={i} />
              <div className="min-w-0 flex-1">
                <NomeDoProduto produto={p} {...props} />
                <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                  {precoTexto(p)} · custo {custoTexto(p)}
                </p>
                <LucroDoProduto produto={p} />
              </div>
              <MenuDoProduto produto={p} {...props} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              {mostrarVitrine && <ChaveVitrine produto={p} {...props} comRotulo />}
              <ChaveAtivo produto={p} {...props} comRotulo />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-[var(--line)] bg-white sm:block">
        <table className="w-full text-[14px]">
          <caption className="sr-only">
            Produtos com ordem, preço, custo, lucro e status. Clique no título de uma coluna pra
            ordenar.
          </caption>
          <thead className="border-b border-[var(--line)]">
            <tr>
              <Cabecalho ordem={ordem} onOrdenar={onOrdenar} coluna="ordem">
                Ordem
              </Cabecalho>
              <th scope="col" className="w-14 px-3 py-2">
                <span className="sr-only">Foto</span>
              </th>
              <Cabecalho ordem={ordem} onOrdenar={onOrdenar} coluna="nome">
                Produto
              </Cabecalho>
              <Cabecalho ordem={ordem} onOrdenar={onOrdenar} coluna="preco" direita>
                Preço
              </Cabecalho>
              <Cabecalho ordem={ordem} onOrdenar={onOrdenar} coluna="custo" direita>
                Custo
              </Cabecalho>
              <Cabecalho ordem={ordem} onOrdenar={onOrdenar} coluna="lucro" direita>
                Lucro
              </Cabecalho>
              {mostrarVitrine && (
                <th
                  scope="col"
                  className="px-3 py-2 text-left font-accent text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]"
                >
                  Vitrine
                </th>
              )}
              <Cabecalho ordem={ordem} onOrdenar={onOrdenar} coluna="status">
                Ativo
              </Cabecalho>
              <th scope="col" className="w-12 px-3 py-2">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {produtos.map((p, i) => (
              <tr
                key={p.id}
                className={`border-t border-[var(--line)] first:border-t-0 ${
                  p.arquivado ? "bg-[var(--bg)]" : ""
                }`}
              >
                <td className="w-20 py-2 pl-3 pr-0">
                  <CampoOrdem produto={p} {...props} />
                </td>
                <td className="px-3 py-2">
                  <FotoDoProduto produto={p} indice={i} />
                </td>
                <td className="max-w-[320px] px-3 py-2">
                  <NomeDoProduto produto={p} {...props} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--ink)]">
                  {precoTexto(p)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--ink-soft)]">
                  {custoTexto(p)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <LucroDoProduto produto={p} />
                </td>
                {mostrarVitrine && (
                  <td className="px-3 py-2">
                    <ChaveVitrine produto={p} {...props} />
                  </td>
                )}
                <td className="px-3 py-2">
                  <ChaveAtivo produto={p} {...props} />
                </td>
                <td className="px-3 py-2 text-right">
                  <MenuDoProduto produto={p} {...props} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Cabecalho({
  coluna,
  children,
  direita = false,
  ordem,
  onOrdenar,
}: {
  coluna: ColunaCatalogo;
  children: string;
  direita?: boolean;
  ordem: Ordem;
  onOrdenar: (coluna: ColunaCatalogo) => void;
}) {
  const ativa = ordem.coluna === coluna;
  const Seta = ordem.direcao === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={ativa ? (ordem.direcao === "asc" ? "ascending" : "descending") : "none"}
      className={`px-3 py-2 ${direita ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onOrdenar(coluna)}
        className={`inline-flex min-h-11 items-center gap-1 font-accent text-[11px] font-bold uppercase tracking-[0.08em] hover:text-[var(--ink)] ${
          ativa ? "text-[var(--ink)]" : "text-[var(--muted)]"
        }`}
      >
        {children}
        {ativa && <Seta size={12} aria-hidden="true" />}
      </button>
    </th>
  );
}

function precoTexto(p: Produto): string {
  const preco = Number(p.preco_venda);
  return preco > 0 ? fmt(preco) : "a definir";
}

function custoTexto(p: Produto): string {
  return p.preco_custo != null ? fmt(Number(p.preco_custo)) : "sem custo";
}

function FotoDoProduto({ produto, indice }: { produto: Produto; indice: number }) {
  if (produto.foto_url) {
    return (
      <img
        src={produto.foto_url}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-10 w-10 shrink-0 rounded-lg object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[16px] text-[var(--ink)]"
      style={{ background: AVATAR_BGS[indice % AVATAR_BGS.length] }}
    >
      {(produto.nome.charAt(0) || "?").toUpperCase()}
    </span>
  );
}

function NomeDoProduto({
  produto,
  mostrarTipo,
  idsSomenteLeitura,
  skusPorProduto,
}: { produto: Produto } & PropsLista) {
  const somenteLeitura = idsSomenteLeitura.has(produto.id);
  const skus = produto.controla_estoque ? skusPorProduto.get(produto.id) : undefined;
  const detalhe = somenteLeitura
    ? "somente leitura · acima da cota do plano Grátis"
    : mostrarTipo
      ? (TIPO_LABEL[produto.tipo] ?? produto.tipo)
      : null;
  return (
    <div className="min-w-0">
      <p
        className={`flex items-center gap-1.5 ${
          produto.arquivado ? "text-[var(--muted)]" : "text-[var(--ink)]"
        }`}
      >
        <span className="truncate" title={produto.nome}>
          {produto.nome}
        </span>
        {somenteLeitura && (
          <Lock size={13} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />
        )}
      </p>
      {detalhe && <p className="text-[12px] text-[var(--muted)]">{detalhe}</p>}
      {skus && <LinhaEstoqueDoCard skus={skus} />}
    </div>
  );
}

/**
 * Número da posição, à esquerda da foto. Salva ao sair do campo ou no Enter;
 * Esc desfaz. Vazio = sem número (o produto vai pelo cadastro mais recente).
 */
function CampoOrdem({ produto, mudandoId, onOrdem }: { produto: Produto } & PropsLista) {
  const salvo = produto.catalogo_ordem != null ? String(produto.catalogo_ordem) : "";
  const [texto, setTexto] = useState(salvo);
  const [editando, setEditando] = useState(false);
  const valor = editando ? texto : salvo;
  const salvar = async () => {
    setEditando(false);
    if (texto.trim() === salvo) return;
    const ok = await onOrdem(produto, texto);
    if (!ok) setTexto(salvo);
  };
  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={4}
      value={valor}
      disabled={mudandoId === produto.id}
      aria-label={`Ordem de ${produto.nome}. Vazio deixa o produto pelo cadastro mais recente.`}
      onFocus={() => {
        setTexto(salvo);
        setEditando(true);
      }}
      onChange={(e) => setTexto(e.target.value.replace(/\D/g, ""))}
      onBlur={() => void salvar()}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setTexto(salvo);
          setEditando(false);
          e.currentTarget.blur();
        }
      }}
      className="h-11 w-14 shrink-0 rounded-lg border border-[var(--line)] bg-white px-2 text-center text-[14px] tabular-nums text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--secondary-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--secondary-text)] disabled:opacity-50"
    />
  );
}

function LucroDoProduto({ produto }: { produto: Produto }) {
  const preco = Number(produto.preco_venda);
  const sobra = sobraDoProduto({
    precoVenda: preco,
    precoCusto: produto.preco_custo != null ? Number(produto.preco_custo) : null,
    breakdown: produto.calculadora_breakdown,
  });
  if (sobra == null) return <span className="text-[13px] text-[var(--muted)]">sem custo</span>;
  return (
    <span className={sobra.prejuizo ? "text-[var(--danger)]" : "text-[var(--ink)]"}>
      {sobra.prejuizo ? `prejuízo de ${fmt(-sobra.valor)}` : `${fmt(sobra.valor)} · ${sobra.pct}%`}
    </span>
  );
}

function ChaveVitrine({
  produto,
  mudandoId,
  onVitrine,
  comRotulo = false,
}: { produto: Produto; comRotulo?: boolean } & PropsLista) {
  const ligada = !!produto.no_catalogo;
  const inativo = !!produto.arquivado;
  return (
    <label
      className="inline-flex min-h-11 items-center gap-2 text-[13px] text-[var(--ink-soft)]"
      title={inativo ? "Produto inativo não aparece na Vitrine online." : undefined}
    >
      <Switch
        checked={ligada && !inativo}
        disabled={inativo || mudandoId === produto.id}
        aria-busy={mudandoId === produto.id || undefined}
        onCheckedChange={(v) => onVitrine(produto, v)}
        aria-label={comRotulo ? undefined : `Na Vitrine online: ${produto.nome}`}
      />
      {comRotulo && "Na Vitrine"}
    </label>
  );
}

function ChaveAtivo({
  produto,
  mudandoId,
  onAtivo,
  comRotulo = false,
}: { produto: Produto; comRotulo?: boolean } & PropsLista) {
  const ativo = !produto.arquivado;
  return (
    <label className="inline-flex min-h-11 items-center gap-2 text-[13px] text-[var(--ink-soft)]">
      <Switch
        checked={ativo}
        disabled={mudandoId === produto.id}
        aria-busy={mudandoId === produto.id || undefined}
        onCheckedChange={(v) => onAtivo(produto, v)}
        aria-label={comRotulo ? undefined : `Ativo: ${produto.nome}`}
      />
      <span className={comRotulo ? "" : "sr-only sm:not-sr-only"}>
        {ativo ? "Ativo" : "Inativo"}
      </span>
    </label>
  );
}

function MenuDoProduto({
  produto,
  idsSomenteLeitura,
  onEditar,
  onRecalcular,
}: { produto: Produto } & PropsLista) {
  const somenteLeitura = idsSomenteLeitura.has(produto.id);
  return (
    <MenuOpcoes
      ariaLabel={`Ações de ${produto.nome}`}
      itens={[
        {
          label: "Editar",
          icone: Pencil,
          onClick: () => onEditar(produto),
          desabilitado: somenteLeitura,
        },
        {
          label: "Recalcular preço",
          icone: RefreshCw,
          onClick: () => onRecalcular(produto),
          desabilitado: somenteLeitura || !!produto.arquivado,
        },
      ]}
    />
  );
}

function LinhaEstoqueDoCard({ skus }: { skus: SkuProduto[] }) {
  if (skus.length === 0) {
    return <p className="mt-1 text-[12px] text-[var(--muted)]">estoque ligado, sem quantidade</p>;
  }
  const total = skus.reduce((s, x) => s + x.saldo, 0);
  const baixos = skus.filter((s) =>
    estoqueBaixo({ saldo: s.saldo, estoqueMinimo: s.estoqueMinimo }),
  );
  const texto =
    skus.length > 1 ? `${total} no estoque em ${skus.length} variações` : `${total} no estoque`;
  return (
    <p className="mt-1 text-[12px] text-[var(--ink-soft)]">
      {texto}
      {baixos.length > 0 && (
        <span className="text-[var(--ink-soft)]">
          {" "}
          ·{" "}
          {skus.length > 1
            ? `${baixos.length} ${baixos.length === 1 ? "variação baixa" : "variações baixas"}`
            : "estoque baixo"}
        </span>
      )}
    </p>
  );
}
