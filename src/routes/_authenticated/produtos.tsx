import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Package, Pencil, RefreshCw, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { BTN_ACAO } from "@/lib/botoes";
import { COTAS_CONFERE } from "@/lib/planos";
import { ehPlanoGratis } from "@/lib/planoGratis";
import { useLinkDoModulo } from "@/lib/useLinkDoModulo";
import { toastErro } from "@/lib/toast";
import { BlockError } from "@/components/ui/BlockError";
import { sobraDoProduto, taxasDoBreakdown } from "@/lib/precificacao.functions";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { MenuOpcoes } from "@/components/ui/MenuOpcoes";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { ModalProduto } from "@/components/produtos/ModalProduto";
import { fmt, fmtData, TIPO_LABEL, type Produto } from "@/components/produtos/tipos";

export const Route = createFileRoute("/_authenticated/produtos")({
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
  const linkModulo3 = useLinkDoModulo(3);

  // ── Modal ──
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoEdit, setProdutoEdit] = useState<Produto | null>(null);
  const [produtoParaArquivar, setProdutoParaArquivar] = useState<Produto | null>(null);
  const [arquivando, setArquivando] = useState(false);

  const produtosQuery = useQuery({
    queryKey: ["produtos", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select(
          "id, user_id, nome, tipo, foto_url, preco_venda, preco_custo, descricao, canal, arquivado, preco_atualizado_em, historico_precos, calculadora_breakdown, created_at, updated_at",
        )
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
    qc.invalidateQueries({ queryKey: ["produtos", userId] });
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

  if (produtosQuery.isLoading) {
    return (
      <PaginaLogada largura="larga" eyebrow="Produtos" titulo="Seus produtos.">
        <p className="text-[14px] text-[var(--muted)]">Carregando seus produtos…</p>
      </PaginaLogada>
    );
  }

  return (
    <PaginaLogada
      dica="produtos"
      largura="larga"
      eyebrow="Produtos"
      titulo="Seus produtos."
      subtitulo="O que você vende, quanto custa e quanto sobra em cada venda."
    >
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={abrirAdicionar} disabled={cotaAtingida} className={BTN_ACAO}>
          + Adicionar produto
        </button>
        <Link
          to="/calculadora"
          className="inline-flex min-h-11 items-center text-[14px] font-medium text-[var(--secondary-text)] no-underline hover:underline"
        >
          Calcular um preço na Calculadora
        </Link>
      </div>

      {cotaAtingida && (
        <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[13px] text-[var(--ink-soft)]">
          No plano Grátis você cria até {COTAS_CONFERE.produtos} produtos. Suba pro Premium pra
          deixar ilimitado. {/* Botão de assinar leva ao checkout, não a outra tela de bloqueio. */}
          <Link
            to="/assinar"
            search={{ plano: "controle" }}
            className="font-medium text-[var(--secondary-text)] no-underline hover:underline"
          >
            Assinar o Premium
          </Link>
        </div>
      )}

      {produtos.length === 0 ? (
        <div className="mt-6">
          <Vazio
            icone={Package}
            titulo="Nenhum produto ainda."
            texto="Adicione um aqui, ou deixe o Módulo 3 do Planejamento criar os primeiros com o que for listado lá."
            acao={
              // A ação do vazio é a da própria tela; o Planejamento é caminho
              // secundário e só aponta pro Módulo 3 quando ele está liberado.
              <>
                <button
                  type="button"
                  onClick={abrirAdicionar}
                  disabled={cotaAtingida}
                  className={BTN_ACAO}
                >
                  + Adicionar produto
                </button>
                <p className="mt-3 text-[12px] text-[var(--muted)]">
                  ou deixe o{" "}
                  <LinkInterno
                    href={linkModulo3.href}
                    className="inline-flex min-h-11 items-center font-medium text-[var(--secondary-text)] hover:underline"
                  >
                    {linkModulo3.liberado ? "Módulo 3 do Planejamento →" : "Planejamento →"}
                  </LinkInterno>{" "}
                  criar os primeiros
                </p>
              </>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {produtos.map((p, i) => (
            <ProdutoCard
              key={p.id}
              produto={p}
              indice={i}
              somenteLeitura={idsExcedentes.has(p.id)}
              onEditar={() => abrirEditar(p)}
              onArquivar={() => setProdutoParaArquivar(p)}
              onRecalcular={() => abrirRecalcular(p)}
            />
          ))}
        </div>
      )}

      {/* ───────── Modal ───────── */}
      {modalAberto && userId && (
        <ModalProduto
          userId={userId}
          prefill={null}
          produtoEdit={produtoEdit}
          onClose={() => setModalAberto(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["produtos", userId] });
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
    </PaginaLogada>
  );
}

/* ============== Card de produto ============== */
const AVATAR_BGS = ["var(--secondary-light)", "var(--surface-pink)", "var(--surface)"];

function ProdutoCard({
  produto,
  indice,
  somenteLeitura,
  onEditar,
  onArquivar,
  onRecalcular,
}: {
  produto: Produto;
  indice: number;
  somenteLeitura?: boolean;
  onEditar: () => void;
  onArquivar: () => void;
  onRecalcular: () => void;
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
      {/* Menu de contexto */}
      <div className="absolute right-1 top-1 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
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

      {/* Tipo */}
      <p className="text-[12px] text-[var(--muted)]">
        {somenteLeitura
          ? "somente leitura · acima da cota do plano Grátis"
          : (TIPO_LABEL[produto.tipo] ?? produto.tipo)}
      </p>

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
              ? "sem custo cadastrado · cadastre o custo pra saber quanto sobra"
              : sobra.prejuizo
                ? `custo ${fmt(custo)} · prejuízo de ${fmt(-sobra.valor)} por venda${temTaxas ? "" : " (sem taxa/imposto)"}`
                : `custo ${fmt(custo)} · sobra ${sobra.pct}%${temTaxas ? "" : " (sem taxa/imposto)"}`}
          </p>
        </>
      )}

      {/* Canal de venda */}
      {produto.canal && (
        <p className="mt-1 text-[12px] text-[var(--muted)]">onde compra: {produto.canal}</p>
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
