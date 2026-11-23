import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Abas from "@radix-ui/react-tabs";
import {
  Archive,
  Calculator,
  ChevronDown,
  ListOrdered,
  Lock,
  Package,
  Pencil,
  RefreshCw,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { BTN_ACAO, BTN_MIUDO } from "@/lib/botoes";
import { COTAS_CONFERE, temNumerosDoMes, temVitrine } from "@/lib/planos";
import { ehPlanoGratis } from "@/lib/planoGratis";
import { toastErro } from "@/lib/toast";
import { BlockError } from "@/components/ui/BlockError";
import { sobraDoProduto, taxasDoBreakdown } from "@/lib/precificacao.functions";
import { MenuOpcoes } from "@/components/ui/MenuOpcoes";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { ModalProduto } from "@/components/produtos/ModalProduto";
import { ModalImportarProdutos } from "@/components/produtos/ModalImportarProdutos";
import { ModalOrdemVitrine } from "@/components/catalogo/ModalOrdemVitrine";
import { fmt, fmtData, nomeBate, TIPO_LABEL, type Produto } from "@/components/produtos/tipos";
import { AbaEstoque } from "@/components/produtos/AbaEstoque";
import { AbaEquipamentos } from "@/components/produtos/AbaEquipamentos";
import { AbaInsumos } from "@/components/produtos/AbaInsumos";
import { useProdutosComEstoque, type SkuProduto } from "@/components/vendas/dados";
import { useInsumos } from "@/components/produtos/insumosDados";
import { useEquipamentos } from "@/components/produtos/equipamentosDados";
import { estoqueBaixo } from "@/lib/vendas";
import {
  contagemDoCatalogo,
  filtrarCatalogo,
  mostraTipoNoCard,
  ordenarCatalogo,
  ROTULO_FILTRO,
  ROTULO_ORDEM,
  type FiltroCatalogo,
  type OrdemCatalogo,
} from "@/lib/catalogoProdutos";

const SELECT_PRODUTO =
  "id, user_id, nome, tipo, foto_url, preco_venda, preco_custo, descricao, observacao_interna, canal, controla_estoque, no_catalogo, usa_paleta, cor_da_foto, max_cores, preco_sob_consulta, cor_sob_consulta, tamanho_sob_consulta, pronta_entrega, arquivado, preco_atualizado_em, historico_precos, calculadora_breakdown, created_at, updated_at";

const FILTROS: FiltroCatalogo[] = ["todos", "vitrine", "fora", "sem_custo", "arquivados"];

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
  const [produtoParaArquivar, setProdutoParaArquivar] = useState<Produto | null>(null);
  const [arquivando, setArquivando] = useState(false);
  const [importarAberto, setImportarAberto] = useState(false);
  // Ordem da Vitrine online também daqui (Premium e Pro), além da tela Vitrine online.
  const [ordemAberta, setOrdemAberta] = useState(false);
  const ehPro = temVitrine(meta.plano);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroCatalogo>("todos");
  const [ordem, setOrdem] = useState<OrdemCatalogo>("recentes");
  const [reativandoId, setReativandoId] = useState<string | null>(null);
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
  const listaDoFiltro = useMemo(() => {
    const base = filtro === "arquivados" ? arquivados : filtrarCatalogo(produtos, filtro);
    return ordenarCatalogo(
      base.filter((p) => nomeBate(p.nome, busca)),
      ordem,
      lucroPctDoProduto,
    );
  }, [filtro, arquivados, produtos, busca, ordem]);

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

  const confirmarArquivar = async () => {
    if (!produtoParaArquivar) return;
    setArquivando(true);
    const { error } = await supabase
      .from("produtos")
      .update({ arquivado: true })
      .eq("id", produtoParaArquivar.id);
    setArquivando(false);
    if (error) {
      // Antes o erro era ignorado e o diálogo fechava como se tivesse arquivado.
      console.error("produto_arquivar", error);
      toastErro("A Pólia One não conseguiu arquivar o produto. Tenta de novo.");
      return;
    }
    setProdutoParaArquivar(null);
    recarregarCatalogo();
  };

  const recarregarCatalogo = () => {
    qc.invalidateQueries({ queryKey: ["produtos", userId] });
    qc.invalidateQueries({ queryKey: ["produtos-arquivados", userId] });
    qc.invalidateQueries({ queryKey: ["painel-produtos-inativos", userId] });
    qc.invalidateQueries({ queryKey: ["estoque", userId] });
  };

  const reativar = async (p: Produto) => {
    if (reativandoId) return;
    setReativandoId(p.id);
    const { error } = await supabase.from("produtos").update({ arquivado: false }).eq("id", p.id);
    setReativandoId(null);
    if (error) {
      console.error("produto_reativar", error);
      toastErro(
        cotaAtingida
          ? `No plano Grátis cabem ${COTAS_CONFERE.produtos} produtos ativos. Arquive um pra reativar este.`
          : "A Pólia One não conseguiu reativar o produto. Tenta de novo.",
      );
      return;
    }
    recarregarCatalogo();
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
              ...(ehPro
                ? [
                    {
                      label: "Ordem na vitrine",
                      icone: ListOrdered,
                      onClick: () => setOrdemAberta(true),
                    },
                  ]
                : []),
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
                  {FILTROS.map((f) =>
                    f !== "todos" && contagem[f] === 0 ? null : (
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
                <label className="ml-auto flex items-center gap-2 text-[13px] text-[var(--muted)]">
                  Ordenar
                  <select
                    value={ordem}
                    onChange={(e) => setOrdem(e.target.value as OrdemCatalogo)}
                    className="min-h-11 rounded-lg border border-[var(--line)] bg-white px-2 py-1.5 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
                  >
                    {(Object.keys(ROTULO_ORDEM) as OrdemCatalogo[]).map((o) => (
                      <option key={o} value={o}>
                        {ROTULO_ORDEM[o]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {filtro === "arquivados" && (
                <p className="mt-3 text-[13px] text-[var(--muted)]">
                  Arquivado sai do catálogo, da Vitrine e das telas de venda, com tudo guardado.
                  "Reativar" traz de volta.
                </p>
              )}

              {listaDoFiltro.length === 0 ? (
                <p className="mt-4 text-[14px] text-[var(--muted)]" role="status">
                  {busca.trim()
                    ? `Nenhum produto com "${busca.trim()}" no nome neste filtro.`
                    : "Nenhum produto neste filtro."}
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {listaDoFiltro.map((p, i) => (
                    <ProdutoCard
                      key={p.id}
                      produto={p}
                      indice={i}
                      mostrarTipo={mostrarTipo}
                      somenteLeitura={idsExcedentes.has(p.id)}
                      onEditar={() => abrirEditar(p)}
                      onArquivar={() => setProdutoParaArquivar(p)}
                      onRecalcular={() => abrirRecalcular(p)}
                      onReativar={p.arquivado ? () => void reativar(p) : undefined}
                      reativando={reativandoId === p.id}
                      skus={p.controla_estoque ? skusPorProduto.get(p.id) : undefined}
                    />
                  ))}
                </div>
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

      <ConfirmarAcao
        open={!!produtoParaArquivar}
        onOpenChange={(open) => {
          if (!open) setProdutoParaArquivar(null);
        }}
        titulo={`Arquivar "${produtoParaArquivar?.nome ?? ""}"?`}
        descricao="Sai do seu catálogo, mas continua guardado. Não é o mesmo que apagar."
        textoConfirmar="Arquivar"
        textoCarregando="Arquivando…"
        onConfirmar={confirmarArquivar}
        carregando={arquivando}
      />
      {ordemAberta && userId && (
        <ModalOrdemVitrine
          userId={userId}
          onClose={() => {
            setOrdemAberta(false);
            qc.invalidateQueries({ queryKey: ["produtos", userId] });
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

/* ============== Card de produto ============== */
const AVATAR_BGS = ["var(--secondary-light)", "var(--surface-pink)", "var(--surface)"];

function ProdutoCard({
  produto,
  indice,
  mostrarTipo,
  somenteLeitura,
  onEditar,
  onArquivar,
  onRecalcular,
  onReativar,
  reativando = false,
  skus,
}: {
  skus?: SkuProduto[];
  produto: Produto;
  indice: number;
  /** Sem mistura de tipos no catálogo, "Produto físico" em todo card não diz nada. */
  mostrarTipo: boolean;
  somenteLeitura?: boolean;
  onEditar: () => void;
  onArquivar: () => void;
  onRecalcular: () => void;
  /** Só nos arquivados: o card troca o menu pelo botão "Reativar". */
  onReativar?: () => void;
  reativando?: boolean;
}) {
  const reduce = usePrefersReducedMotion();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (reduce) {
      setShown(true);
      return;
    }
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(r);
  }, [reduce]);

  const precoVenda = Number(produto.preco_venda);
  const custo = produto.preco_custo != null ? Number(produto.preco_custo) : 0;
  // Mesma fonte que a calculadora: lê taxa/imposto do breakdown salvo (se o
  // produto veio de lá), pra não divergir do preço sugerido na mesma sessão.
  const { taxaVendaPct, impostosPct } = taxasDoBreakdown(produto.calculadora_breakdown);
  // A barra usa a % presa em 0..100; o texto usa o valor com sinal, pra um
  // produto vendido abaixo do custo não aparecer como "sobra 0%" (QA-27).
  const sobra = sobraDoProduto({
    precoVenda,
    precoCusto: produto.preco_custo != null ? custo : null,
    breakdown: produto.calculadora_breakdown,
  });
  const sobraPct = sobra?.pctBarra ?? 0;
  const temTaxas = taxaVendaPct > 0 || impostosPct > 0;

  return (
    <div className="group relative rounded-xl border border-[var(--line)] bg-white p-4">
      {/* Menu de contexto (arquivado tem só "Reativar", embaixo) */}
      <div
        data-arquivado={!!onReativar}
        className="absolute right-1 top-1 data-[arquivado=true]:hidden opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <MenuOpcoes
          itens={[
            { label: "Editar", icone: Pencil, onClick: onEditar, desabilitado: somenteLeitura },
            {
              label: "Recalcular preço",
              icone: RefreshCw,
              onClick: onRecalcular,
              desabilitado: somenteLeitura,
            },
            { label: "Arquivar", icone: Archive, onClick: onArquivar },
          ]}
        />
      </div>

      {/* Foto ou avatar de inicial */}
      {produto.foto_url ? (
        <div className="aspect-square w-full overflow-hidden rounded-lg">
          <img
            src={produto.foto_url}
            alt={produto.nome}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div
          className="flex h-14 w-14 items-center justify-center rounded-xl"
          style={{ background: AVATAR_BGS[indice % AVATAR_BGS.length] }}
          aria-hidden="true"
        >
          <span className="text-[28px] leading-none text-[var(--ink)]">
            {(produto.nome.charAt(0) || "?").toUpperCase()}
          </span>
        </div>
      )}

      {/* Nome */}
      <p className="mt-3 flex items-center gap-1.5 text-[var(--ink)]">
        {produto.nome}
        {somenteLeitura && (
          <Lock size={13} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />
        )}
      </p>

      {/* Tipo e Vitrine */}
      {(() => {
        const partes = somenteLeitura
          ? ["somente leitura · acima da cota do plano Grátis"]
          : [
              mostrarTipo ? (TIPO_LABEL[produto.tipo] ?? produto.tipo) : null,
              produto.arquivado ? "arquivado" : produto.no_catalogo ? "na Vitrine online" : null,
            ].filter(Boolean);
        return partes.length > 0 ? (
          <p className="text-[12px] text-[var(--muted)]">{partes.join(" · ")}</p>
        ) : null;
      })()}

      {/* Preço de venda */}
      <p className="font-cabinet mt-2 text-[18px] text-[var(--ink)]">
        {precoVenda > 0 ? (
          fmt(precoVenda)
        ) : (
          <span className="text-[14px] text-[var(--muted)]">preço a definir</span>
        )}
      </p>

      {/* Barra de margem */}
      {/* Sem custo cadastrado a sobra não existe: nem barra, nem número. */}
      {precoVenda > 0 && (
        <>
          {produto.preco_custo != null && (
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
              <div
                className="h-full w-full origin-left rounded-full bg-[var(--secondary)]"
                style={{
                  transform: `scaleX(${shown ? sobraPct / 100 : 0})`,
                  transition: reduce ? "none" : "transform 200ms cubic-bezier(0.22,1,0.36,1)",
                }}
              />
            </div>
          )}
          <p
            className={`mt-1.5 text-[12px] ${
              sobra?.prejuizo ? "text-[var(--danger)]" : "text-[var(--muted)]"
            }`}
          >
            {sobra == null
              ? "sem custo cadastrado · cadastre o custo pra saber o lucro"
              : sobra.prejuizo
                ? `custo ${fmt(custo)} · prejuízo de ${fmt(-sobra.valor)} por venda${temTaxas ? "" : " (sem taxa/imposto)"}`
                : `custo ${fmt(custo)} · lucro de ${sobra.pct}%${temTaxas ? "" : " (sem taxa/imposto)"}`}
          </p>
        </>
      )}

      {/* Estoque (VND-03): soma das variações e quantas estão baixas */}
      {skus && <LinhaEstoqueDoCard skus={skus} />}

      {/* Canal de venda */}
      {produto.canal && (
        <p className="mt-1 text-[12px] text-[var(--muted)]">onde compra: {produto.canal}</p>
      )}

      {onReativar && (
        <button
          type="button"
          onClick={onReativar}
          disabled={reativando}
          aria-busy={reativando || undefined}
          className={`${BTN_MIUDO} mt-3 min-h-11 bg-white`}
        >
          {reativando ? "Reativando…" : "Reativar"}
          <span className="sr-only"> {produto.nome}</span>
        </button>
      )}

      {/* Atualizado em */}
      {produto.preco_atualizado_em && (
        <p className="mt-1 text-[11px] text-[var(--muted)]">
          atualizado em {fmtData(produto.preco_atualizado_em)}
        </p>
      )}
    </div>
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
