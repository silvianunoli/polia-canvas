import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import { track } from "@/lib/analytics";

type ProdutoTipo = "fisico" | "digital" | "servico";

// ── Motion ──
function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos · Pólia" },
      {
        name: "description",
        content: "Seu catálogo de produtos e a calculadora de preço.",
      },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .maybeSingle();
    if (profile && profile.onboarding_completed === false) {
      throw redirect({ to: "/painel" });
    }
  },
  component: ProdutosPage,
});

interface PrecoHistorico {
  preco: number;
  data: string;
}

// Composição que gerou o preço sugerido pela calculadora: persistida junto ao
// produto pra permitir "recalcular preço" sem perder custos/taxas/%s digitados.
interface CalculadoraBreakdown {
  perfil: "produto" | "servico";
  valores: Record<string, string>;
}

interface Produto {
  id: string;
  user_id: string;
  nome: string;
  tipo: string;
  foto_url: string | null;
  preco_venda: number;
  preco_custo: number | null;
  descricao: string | null;
  canal: string | null;
  arquivado: boolean;
  preco_atualizado_em: string | null;
  historico_precos: PrecoHistorico[];
  calculadora_breakdown: CalculadoraBreakdown | null;
  created_at: string;
  updated_at: string;
}

interface Prefill {
  nome?: string;
  preco_venda?: number;
  preco_custo?: number;
  tipo?: ProdutoTipo;
  calculadora_breakdown?: CalculadoraBreakdown;
}

const TIPO_LABEL: Record<string, string> = {
  fisico: "Produto físico",
  digital: "Produto digital",
  servico: "Serviço",
};

function fmt(v: number) {
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

function fmtData(iso: string) {
  // iso pode vir como ISO completo ou "YYYY-MM-DD"
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(
    2,
    "0",
  )}/${d.getFullYear()}`;
}

function hojeISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

type TabId = "produtos" | "calculadora";

function ProdutosPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabId>("produtos");

  // ── Modal ──
  const [modalAberto, setModalAberto] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [produtoEdit, setProdutoEdit] = useState<Produto | null>(null);
  const [produtoRecalcular, setProdutoRecalcular] = useState<Produto | null>(null);

  const initial = (user?.user_metadata?.full_name ?? user?.email ?? "P").charAt(0).toUpperCase();

  const produtosQuery = useQuery({
    queryKey: ["produtos", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("produtos")
        .select(
          "id, user_id, nome, tipo, foto_url, preco_venda, preco_custo, descricao, canal, arquivado, preco_atualizado_em, historico_precos, calculadora_breakdown, created_at, updated_at",
        )
        .eq("user_id", userId!)
        .eq("arquivado", false)
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as Produto[];
    },
  });

  const produtos = useMemo(() => produtosQuery.data ?? [], [produtosQuery.data]);

  // Meta do mês: mesma fonte que Painel e Financeiro (tabela `metas`), não mais
  // uma leitura própria do texto do Planejamento.
  const metaBoaQuery = useQuery({
    queryKey: ["meta-do-mes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("metas")
        .select("valor_alvo")
        .eq("user_id", userId!)
        .eq("titulo", "Meta do mês")
        .maybeSingle();
      return (data as { valor_alvo: number | null } | null)?.valor_alvo || null;
    },
  });

  const metaBoa = metaBoaQuery.data ?? null;

  const abrirAdicionar = (pf?: Prefill | null) => {
    setProdutoEdit(null);
    setPrefill(pf ?? null);
    setModalAberto(true);
  };

  const abrirEditar = (p: Produto) => {
    setPrefill(null);
    setProdutoEdit(p);
    setModalAberto(true);
  };

  const abrirRecalcular = (p: Produto) => {
    setProdutoRecalcular(p);
    setTab("calculadora");
  };

  const arquivar = async (p: Produto) => {
    if (!window.confirm(`Arquivar "${p.nome}"? Ele sai do seu catálogo.`)) return;
    await supabase.from("produtos").update({ arquivado: true }).eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["produtos", userId] });
  };

  if (produtosQuery.isLoading) {
    return (
      <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
        <PainelNav initial={initial} streak={0} navActive="/produtos" />
      </div>
    );
  }

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <PainelNav initial={initial} streak={0} navActive="/produtos" />

      <div className="mx-auto max-w-[1120px] px-6 py-12 md:px-10">
        {/* ───────── Header ───────── */}
        <header>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
            Produtos
          </p>
          <h1 className="font-cabinet mt-1 text-[clamp(28px,5vw,42px)] leading-[1.08] text-[var(--ink)]">
            Seus produtos e preços.
          </h1>
        </header>

        {/* ───────── Tabs ───────── */}
        <div className="mt-8 inline-flex gap-0.5 rounded-lg border border-[var(--line)] bg-white p-[3px]">
          {(
            [
              { id: "produtos", label: "Meus produtos" },
              { id: "calculadora", label: "Calculadora de preço" },
            ] as { id: TabId; label: string }[]
          ).map((t) => {
            const ativo = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-md px-[18px] py-2 text-[14px] font-medium transition-colors duration-200 ${
                  ativo
                    ? "bg-[var(--secondary)] text-[var(--secondary-ink)]"
                    : "text-[var(--ink-soft)] hover:bg-[var(--secondary-light)]"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ───────── TAB 1 — Meus produtos ───────── */}
        {tab === "produtos" && (
          <section className="mt-8">
            <button
              onClick={() => abrirAdicionar(null)}
              className="rounded-xl bg-[var(--secondary)] px-4 py-2.5 font-medium text-[var(--secondary-ink)] hover:opacity-90"
            >
              + Adicionar produto
            </button>

            {produtos.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
                <p className="mx-auto max-w-[420px] text-[14px] leading-relaxed text-[var(--muted)]">
                  Nenhum produto ainda. Adicione um aqui, ou deixe o Módulo 3 do planejamento criar
                  os primeiros com o que for listado lá.
                </p>
                <a
                  href="/planejamento/modulo/3"
                  className="mt-3 inline-block text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
                >
                  Configurar pelo Planejamento →
                </a>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {produtos.map((p, i) => (
                  <ProdutoCard
                    key={p.id}
                    produto={p}
                    indice={i}
                    onEditar={() => abrirEditar(p)}
                    onArquivar={() => arquivar(p)}
                    onRecalcular={() => abrirRecalcular(p)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ───────── TAB 2 — Calculadora ───────── */}
        {tab === "calculadora" && (
          <Calculadora
            onSalvarComoProduto={abrirAdicionar}
            metaBoa={metaBoa}
            produtoRecalcular={produtoRecalcular}
            onCancelarRecalculo={() => {
              setProdutoRecalcular(null);
              setTab("produtos");
            }}
            onAtualizado={() => {
              setProdutoRecalcular(null);
              setTab("produtos");
              qc.invalidateQueries({ queryKey: ["produtos", userId] });
            }}
          />
        )}
      </div>

      {/* ───────── Modal ───────── */}
      {modalAberto && userId && (
        <ModalProduto
          userId={userId}
          prefill={prefill}
          produtoEdit={produtoEdit}
          onClose={() => setModalAberto(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["produtos", userId] });
            setModalAberto(false);
          }}
        />
      )}
    </div>
  );
}

/* ============== Card de produto ============== */
const AVATAR_BGS = ["var(--secondary-light)", "var(--surface-pink)", "var(--surface)"];

function ProdutoCard({
  produto,
  indice,
  onEditar,
  onArquivar,
  onRecalcular,
}: {
  produto: Produto;
  indice: number;
  onEditar: () => void;
  onArquivar: () => void;
  onRecalcular: () => void;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
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

  const fecharMenu = () => setMenuAberto(false);

  const precoVenda = Number(produto.preco_venda);
  const custo = produto.preco_custo != null ? Number(produto.preco_custo) : 0;
  const margem =
    precoVenda > 0 ? Math.max(0, Math.round(((precoVenda - custo) / precoVenda) * 100)) : 0;

  return (
    <div className="group relative rounded-xl border border-[var(--line)] bg-white p-4">
      {/* Menu de contexto */}
      <div className="absolute right-3 top-3">
        <button
          onClick={() => setMenuAberto((v) => !v)}
          aria-label="Opções do produto"
          className={`rounded-md p-1 text-[var(--muted)] opacity-0 transition-opacity duration-150 hover:bg-[var(--surface)] hover:text-[var(--ink)] focus-visible:opacity-100 group-hover:opacity-100 ${
            menuAberto ? "opacity-100" : ""
          }`}
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </button>
        {menuAberto && (
          <>
            {/* Camada para fechar ao clicar fora */}
            <div className="fixed inset-0 z-10" onClick={fecharMenu} aria-hidden="true" />
            <div className="absolute right-0 z-20 mt-1 w-32 overflow-hidden rounded-lg border border-[var(--line)] bg-white py-1 shadow-sm">
              <button
                onClick={() => {
                  fecharMenu();
                  onEditar();
                }}
                className="block w-full px-3 py-2 text-left text-[14px] text-[var(--ink)] hover:bg-[var(--surface)]"
              >
                Editar
              </button>
              <button
                onClick={() => {
                  fecharMenu();
                  onRecalcular();
                }}
                className="block w-full px-3 py-2 text-left text-[14px] text-[var(--ink)] hover:bg-[var(--surface)]"
              >
                Recalcular preço
              </button>
              <button
                onClick={() => {
                  fecharMenu();
                  onArquivar();
                }}
                className="block w-full px-3 py-2 text-left text-[14px] text-[var(--danger)] hover:bg-[var(--surface)]"
              >
                Arquivar
              </button>
            </div>
          </>
        )}
      </div>

      {/* Foto ou avatar de inicial */}
      {produto.foto_url ? (
        <div className="aspect-square w-full overflow-hidden rounded-lg">
          <img src={produto.foto_url} alt={produto.nome} className="h-full w-full object-cover" />
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
      <p className="mt-3 text-[var(--ink)]">{produto.nome}</p>

      {/* Tipo */}
      <p className="text-[12px] text-[var(--muted)]">{TIPO_LABEL[produto.tipo] ?? produto.tipo}</p>

      {/* Preço de venda */}
      <p className="font-cabinet mt-2 text-[18px] text-[var(--ink)]">
        {precoVenda > 0 ? (
          fmt(precoVenda)
        ) : (
          <span className="text-[14px] text-[var(--muted)]">preço a definir</span>
        )}
      </p>

      {/* Barra de margem */}
      {precoVenda > 0 && (
        <>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
            <div
              className="h-full rounded-full bg-[var(--secondary)]"
              style={{
                width: shown ? `${margem}%` : "0%",
                transition: "width 600ms cubic-bezier(0.22,1,0.36,1)",
              }}
            />
          </div>
          <p className="mt-1.5 text-[12px] text-[var(--muted)]">
            {produto.preco_custo != null
              ? `custo ${fmt(custo)} · margem ${margem}%`
              : `custo estimado · margem ${margem}%`}
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

/* ============== Calculadora de preço ============== */
type PerfilCalc = "produto" | "servico";

function num(s: string) {
  const v = parseFloat(s.replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

function Calculadora({
  onSalvarComoProduto,
  metaBoa,
  produtoRecalcular,
  onCancelarRecalculo,
  onAtualizado,
}: {
  onSalvarComoProduto: (pf: Prefill) => void;
  metaBoa: number | null;
  produtoRecalcular?: Produto | null;
  onCancelarRecalculo?: () => void;
  onAtualizado?: () => void;
}) {
  const bk = produtoRecalcular?.calculadora_breakdown ?? null;
  const v = (campo: string) => bk?.valores?.[campo] ?? "";

  const [perfil, setPerfil] = useState<PerfilCalc>(
    bk?.perfil ?? (produtoRecalcular?.tipo === "servico" ? "servico" : "produto"),
  );

  // ── Perfil Produto ──
  const [materiaPrima, setMateriaPrima] = useState(() => v("materiaPrima"));
  const [embalagem, setEmbalagem] = useState(() => v("embalagem"));
  const [maoObra, setMaoObra] = useState(() => v("maoObra"));
  const [outrosDiretos, setOutrosDiretos] = useState(() => v("outrosDiretos"));
  const [despesasFixas, setDespesasFixas] = useState(() => v("despesasFixas"));
  const [qtd, setQtd] = useState(() => v("qtd"));
  const [taxaVenda, setTaxaVenda] = useState(() => v("taxaVenda"));
  const [impostos, setImpostos] = useState(() => v("impostos"));
  const [margem, setMargem] = useState(() => v("margem"));

  // ── Perfil Serviço ──
  const [valorHora, setValorHora] = useState(() => v("valorHora"));
  const [horas, setHoras] = useState(() => v("horas"));
  const [materiais, setMateriais] = useState(() => v("materiais"));
  const [deslocamento, setDeslocamento] = useState(() => v("deslocamento"));
  const [ferramentas, setFerramentas] = useState(() => v("ferramentas"));
  const [outrosServico, setOutrosServico] = useState(() => v("outrosServico"));
  const [taxaVendaS, setTaxaVendaS] = useState(() => v("taxaVendaS"));
  const [impostosS, setImpostosS] = useState(() => v("impostosS"));
  const [margemSeg, setMargemSeg] = useState(() => v("margemSeg"));

  // ── Simulador de desconto ──
  const [desconto, setDesconto] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Fórmula "preço por dentro": taxa, imposto e lucro são % do PREÇO final,
  // então o preço = custo / (1 − soma_dos_percentuais/100).
  const produtoCalc = useMemo(() => {
    const custoDireto = num(materiaPrima) + num(embalagem) + num(maoObra) + num(outrosDiretos);
    const rateio = num(despesasFixas) / Math.max(num(qtd), 1);
    const custoUnitario = custoDireto + rateio;
    const pctVenda = num(taxaVenda) + num(impostos);
    const pctTotal = pctVenda + num(margem);
    const invalido = pctTotal >= 100;
    const precoMinimo = pctVenda < 100 ? custoUnitario / (1 - pctVenda / 100) : custoUnitario;
    const precoSugerido = invalido ? custoUnitario : custoUnitario / (1 - pctTotal / 100);
    const taxasReais = precoSugerido * (pctVenda / 100);
    const lucroReais = precoSugerido * (num(margem) / 100);
    return {
      custoDireto,
      rateio,
      custoUnitario,
      precoMinimo,
      precoSugerido,
      taxasReais,
      lucroReais,
      invalido,
    };
  }, [
    materiaPrima,
    embalagem,
    maoObra,
    outrosDiretos,
    despesasFixas,
    qtd,
    taxaVenda,
    impostos,
    margem,
  ]);

  const servicoCalc = useMemo(() => {
    const maoDeObra = num(valorHora) * num(horas);
    const custosProjeto =
      num(materiais) + num(deslocamento) + num(ferramentas) + num(outrosServico);
    const custoTotal = maoDeObra + custosProjeto;
    const pctVenda = num(taxaVendaS) + num(impostosS);
    const pctTotal = pctVenda + num(margemSeg);
    const invalido = pctTotal >= 100;
    const precoSugerido = invalido ? custoTotal : custoTotal / (1 - pctTotal / 100);
    const taxasReais = precoSugerido * (pctVenda / 100);
    const lucroReais = precoSugerido * (num(margemSeg) / 100);
    return {
      maoDeObra,
      custosProjeto,
      custoTotal,
      precoSugerido,
      taxasReais,
      lucroReais,
      invalido,
    };
  }, [
    valorHora,
    horas,
    materiais,
    deslocamento,
    ferramentas,
    outrosServico,
    taxaVendaS,
    impostosS,
    margemSeg,
  ]);

  const calc = perfil === "produto" ? produtoCalc : servicoCalc;
  const custoBase = perfil === "produto" ? produtoCalc.custoUnitario : servicoCalc.custoTotal;
  const round2 = (v: number) => Math.round(v * 100) / 100;
  const lucroPorVenda = round2(calc.lucroReais);
  const vendasParaMetaBoa =
    lucroPorVenda > 0 && metaBoa ? Math.ceil(metaBoa / lucroPorVenda) : null;
  const pctVenda = perfil === "produto" ? num(taxaVenda) + num(impostos) : num(taxaVendaS) + num(impostosS);

  // Com desconto de X%: taxa/imposto são % do preço, então caem junto com ele.
  const descontoPct = num(desconto);
  const simulacaoDesconto = useMemo(() => {
    if (!descontoPct) return null;
    const precoComDesconto = calc.precoSugerido * (1 - descontoPct / 100);
    const taxasComDesconto = precoComDesconto * (pctVenda / 100);
    const lucroComDesconto = precoComDesconto - custoBase - taxasComDesconto;
    return { precoComDesconto, lucroComDesconto };
  }, [descontoPct, calc.precoSugerido, custoBase, pctVenda]);

  function buildBreakdown(): CalculadoraBreakdown {
    return perfil === "produto"
      ? {
          perfil,
          valores: { materiaPrima, embalagem, maoObra, outrosDiretos, despesasFixas, qtd, taxaVenda, impostos, margem },
        }
      : {
          perfil,
          valores: {
            valorHora,
            horas,
            materiais,
            deslocamento,
            ferramentas,
            outrosServico,
            taxaVendaS,
            impostosS,
            margemSeg,
          },
        };
  }

  const salvar = async () => {
    const precoVenda = round2(calc.precoSugerido);
    const precoCusto = round2(custoBase) || undefined;
    const breakdown = buildBreakdown();

    if (!produtoRecalcular) {
      onSalvarComoProduto({
        nome: "",
        tipo: perfil === "produto" ? "fisico" : "servico",
        preco_venda: precoVenda,
        preco_custo: precoCusto,
        calculadora_breakdown: breakdown,
      });
      return;
    }

    // Recalculando: atualiza o mesmo produto direto, sem passar pelo modal.
    setSalvando(true);
    setErro(null);
    const update: Record<string, unknown> = {
      preco_venda: precoVenda,
      preco_custo: precoCusto ?? null,
      calculadora_breakdown: breakdown,
      updated_at: new Date().toISOString(),
    };
    if (Number(produtoRecalcular.preco_venda) !== precoVenda) {
      const atual = Array.isArray(produtoRecalcular.historico_precos)
        ? produtoRecalcular.historico_precos
        : [];
      update.historico_precos = [
        { preco: Number(produtoRecalcular.preco_venda), data: hojeISODate() },
        ...atual,
      ] as unknown as Json;
      update.preco_atualizado_em = new Date().toISOString();
    }
    const { error } = await supabase
      .from("produtos")
      .update(update as never)
      .eq("id", produtoRecalcular.id);
    setSalvando(false);
    if (error) {
      setErro(error.message || "Não consegui atualizar o preço. Tenta de novo.");
      return;
    }
    track("produto_preco_recalculado");
    onAtualizado?.();
  };

  return (
    <section className="mt-8 max-w-[640px]">
      {produtoRecalcular && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl bg-[var(--secondary-light)] px-4 py-3 text-[13px] text-[var(--secondary-text)]">
          <span>
            Recalculando preço de <b>{produtoRecalcular.nome}</b>.
          </span>
          <button
            type="button"
            onClick={onCancelarRecalculo}
            className="shrink-0 font-medium underline hover:opacity-80"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Seletor de perfil */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "produto", label: "Produto (físico/digital)" },
            { id: "servico", label: "Serviço (por hora)" },
          ] as { id: PerfilCalc; label: string }[]
        ).map((p) => {
          const ativo = perfil === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPerfil(p.id)}
              className={`rounded-full px-4 py-2 text-[13px] ${
                ativo
                  ? "border border-[var(--secondary)] bg-[var(--secondary-light)] text-[var(--secondary-text)]"
                  : "border border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--secondary)]"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Campos */}
      {perfil === "produto" ? (
        <>
          <GrupoCalc titulo="Custos diretos (por unidade)">
            <CampoNum
              label="Matéria-prima / insumos (R$)"
              value={materiaPrima}
              onChange={setMateriaPrima}
            />
            <CampoNum label="Embalagem (R$)" value={embalagem} onChange={setEmbalagem} />
            <CampoNum label="Mão de obra por unidade (R$)" value={maoObra} onChange={setMaoObra} />
            <CampoNum
              label="Outros custos diretos (R$)"
              value={outrosDiretos}
              onChange={setOutrosDiretos}
            />
          </GrupoCalc>
          <GrupoCalc titulo="Custos fixos (rateio do mês)">
            <CampoNum
              label="Custos fixos do mês (R$)"
              dica="aluguel, internet, ferramentas"
              value={despesasFixas}
              onChange={setDespesasFixas}
            />
            <CampoNum label="Quantas vende por mês" value={qtd} onChange={setQtd} />
          </GrupoCalc>
          <GrupoCalc titulo="Sobre o preço de venda (%)">
            <CampoNum
              label="Taxa de maquininha / marketplace (%)"
              value={taxaVenda}
              onChange={setTaxaVenda}
            />
            <CampoNum label="Impostos sobre a venda (%)" value={impostos} onChange={setImpostos} />
            <CampoNum label="Lucro desejado (%)" value={margem} onChange={setMargem} />
          </GrupoCalc>
        </>
      ) : (
        <>
          <GrupoCalc titulo="Seu trabalho">
            <CampoNum label="Valor da sua hora (R$)" value={valorHora} onChange={setValorHora} />
            <CampoNum label="Horas estimadas no serviço" value={horas} onChange={setHoras} />
          </GrupoCalc>
          <GrupoCalc titulo="Custos do projeto">
            <CampoNum label="Materiais / insumos (R$)" value={materiais} onChange={setMateriais} />
            <CampoNum label="Deslocamento (R$)" value={deslocamento} onChange={setDeslocamento} />
            <CampoNum
              label="Ferramentas / software (R$)"
              value={ferramentas}
              onChange={setFerramentas}
            />
            <CampoNum label="Outros (R$)" value={outrosServico} onChange={setOutrosServico} />
          </GrupoCalc>
          <GrupoCalc titulo="Sobre o preço (%)">
            <CampoNum label="Taxa / comissão (%)" value={taxaVendaS} onChange={setTaxaVendaS} />
            <CampoNum
              label="Impostos sobre a venda (%)"
              value={impostosS}
              onChange={setImpostosS}
            />
            <CampoNum
              label="Margem de segurança / lucro (%)"
              value={margemSeg}
              onChange={setMargemSeg}
            />
          </GrupoCalc>
        </>
      )}

      {/* Resultado */}
      <div className="mt-8 rounded-xl bg-[var(--secondary-light)] p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--secondary-text)]">
          Preço sugerido
        </p>
        <p className="font-cabinet mt-1 text-[var(--ink)] text-[clamp(28px,5vw,40px)] leading-none">
          {fmt(round2(calc.precoSugerido))}
        </p>
        {calc.invalido && (
          <p className="mt-2 text-[13px] text-[var(--danger)]">
            As porcentagens (taxas + impostos + lucro) somam 100% ou mais. Reduza alguma pra
            calcular o preço.
          </p>
        )}
        <div className="mt-4 space-y-1.5 text-[13px] text-[var(--ink-soft)]">
          {perfil === "produto" ? (
            <>
              <LinhaCalc label="Custo por unidade" valor={fmt(round2(produtoCalc.custoUnitario))} />
              <p className="text-[12px] text-[var(--muted)]">
                diretos {fmt(round2(produtoCalc.custoDireto))} + rateio dos fixos{" "}
                {fmt(round2(produtoCalc.rateio))}
              </p>
              <LinhaCalc
                label="Preço mínimo (sem lucro)"
                valor={fmt(round2(produtoCalc.precoMinimo))}
              />
            </>
          ) : (
            <>
              <LinhaCalc label="Custo total" valor={fmt(round2(servicoCalc.custoTotal))} />
              <p className="text-[12px] text-[var(--muted)]">
                mão de obra {fmt(round2(servicoCalc.maoDeObra))} + custos do projeto{" "}
                {fmt(round2(servicoCalc.custosProjeto))}
              </p>
            </>
          )}
          <LinhaCalc label="Taxas e impostos" valor={fmt(round2(calc.taxasReais))} />
          <LinhaCalc label="Seu lucro" valor={fmt(round2(calc.lucroReais))} />
        </div>
        {vendasParaMetaBoa !== null && (
          <p className="mt-4 border-t border-[var(--line)] pt-3 text-[13px] text-[var(--ink-soft)]">
            Pra bater o mês bom ({fmt(metaBoa!)}) só com esse produto: {vendasParaMetaBoa} vendas.
          </p>
        )}
      </div>

      {/* Simulador de desconto */}
      <div className="mt-4 rounded-xl border border-[var(--line)] bg-white p-5">
        <CampoNum
          label="Simular com desconto de X% (opcional)"
          value={desconto}
          onChange={setDesconto}
        />
        {simulacaoDesconto && (
          <p
            className={`mt-3 text-[13px] ${
              simulacaoDesconto.lucroComDesconto < 0
                ? "text-[var(--danger)]"
                : "text-[var(--ink-soft)]"
            }`}
          >
            Com {descontoPct}% de desconto, o preço cai pra{" "}
            {fmt(round2(simulacaoDesconto.precoComDesconto))} e sobram{" "}
            {fmt(round2(simulacaoDesconto.lucroComDesconto))}.
            {simulacaoDesconto.lucroComDesconto < 0 && " Esse desconto dá prejuízo."}
          </p>
        )}
      </div>

      {erro && <p className="mt-4 text-[13px] text-[var(--danger)]">{erro}</p>}

      {/* Salvar */}
      <button
        onClick={salvar}
        disabled={salvando}
        className="mt-4 rounded-xl border border-[var(--secondary)] px-4 py-2.5 font-medium text-[var(--secondary-text)] hover:bg-[var(--secondary-light)] disabled:opacity-50"
      >
        {salvando
          ? "Salvando..."
          : produtoRecalcular
            ? "Salvar novo preço"
            : "Salvar como produto"}
      </button>

      <p className="mt-4 text-[13px] text-[var(--muted)]">
        Esses são valores de referência. Considere também o mercado e o posicionamento da sua marca.
      </p>
    </section>
  );
}

function CampoNum({
  label,
  value,
  onChange,
  dica,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dica?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-[var(--muted)]">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
        placeholder="0"
      />
      {dica && <span className="mt-1 block text-[11px] text-[var(--muted)]">{dica}</span>}
    </label>
  );
}

function GrupoCalc({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
        {titulo}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function LinhaCalc({ label, valor }: { label: string; valor: string }) {
  return (
    <p className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className="font-medium text-[var(--ink)]">{valor}</span>
    </p>
  );
}

/* ============== Modal: adicionar/editar produto ============== */
function ModalProduto({
  userId,
  prefill,
  produtoEdit,
  onClose,
  onSaved,
}: {
  userId: string;
  prefill: Prefill | null;
  produtoEdit: Produto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const edit = !!produtoEdit;

  const [nome, setNome] = useState(produtoEdit?.nome ?? prefill?.nome ?? "");
  const [tipo, setTipo] = useState<ProdutoTipo>(
    (produtoEdit?.tipo as ProdutoTipo) ?? prefill?.tipo ?? "fisico",
  );
  const [fotoUrl, setFotoUrl] = useState(produtoEdit?.foto_url ?? "");
  const [precoVenda, setPrecoVenda] = useState(
    produtoEdit?.preco_venda != null
      ? String(produtoEdit.preco_venda)
      : prefill?.preco_venda != null
        ? String(prefill.preco_venda)
        : "",
  );
  const [precoCusto, setPrecoCusto] = useState(
    produtoEdit?.preco_custo != null
      ? String(produtoEdit.preco_custo)
      : prefill?.preco_custo != null
        ? String(prefill.preco_custo)
        : "",
  );
  const [descricao, setDescricao] = useState(produtoEdit?.descricao ?? "");
  const [canal, setCanal] = useState(produtoEdit?.canal ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const precoVendaNum = num(precoVenda);
  const precoCustoNum = precoCusto.trim() ? num(precoCusto) : null;
  const podeSalvar = nome.trim().length > 0 && precoVendaNum > 0;

  const salvar = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    setErro(null);

    if (edit && produtoEdit) {
      const update: Record<string, unknown> = {
        nome: nome.trim(),
        tipo,
        foto_url: fotoUrl.trim() || null,
        preco_venda: precoVendaNum,
        preco_custo: precoCustoNum,
        descricao: descricao.trim() || null,
        canal: canal.trim() || null,
        updated_at: new Date().toISOString(),
      };

      // Histórico de preço: só registra quando o preço de venda mudou.
      if (Number(produtoEdit.preco_venda) !== precoVendaNum) {
        const atual = Array.isArray(produtoEdit.historico_precos)
          ? produtoEdit.historico_precos
          : [];
        update.historico_precos = [
          { preco: Number(produtoEdit.preco_venda), data: hojeISODate() },
          ...atual,
        ] as unknown as Json;
        update.preco_atualizado_em = new Date().toISOString();
      }

      const { error } = await supabase
        .from("produtos")
        .update(update as never)
        .eq("id", produtoEdit.id);
      setSalvando(false);
      if (error) {
        setErro(error.message || "Erro ao salvar.");
        return;
      }
    } else {
      const { error } = await supabase.from("produtos").insert({
        user_id: userId,
        nome: nome.trim(),
        tipo,
        foto_url: fotoUrl.trim() || null,
        preco_venda: precoVendaNum,
        preco_custo: precoCustoNum,
        descricao: descricao.trim() || null,
        canal: canal.trim() || null,
        calculadora_breakdown: prefill?.calculadora_breakdown ?? null,
      } as never);
      setSalvando(false);
      if (error) {
        setErro(error.message || "Erro ao salvar.");
        return;
      }
      track("produto_criado", { tipo });
    }
    onSaved();
  };

  return (
    <div
      className="polia-v3 fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/50 px-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-5 text-[24px] text-[var(--ink)]">
          {edit ? "Editar produto" : "Adicionar produto"}
        </h2>

        {/* Nome */}
        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Nome</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
            placeholder="ex: Camiseta bordada"
            autoFocus
          />
        </div>

        {/* Tipo */}
        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Tipo</label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "fisico", label: "Produto físico" },
                { id: "digital", label: "Produto digital" },
                { id: "servico", label: "Serviço" },
              ] as { id: ProdutoTipo; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTipo(t.id)}
                className={`rounded-lg border px-3 py-1.5 text-[13px] ${
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

        {/* Foto (URL) */}
        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Foto</label>
          <input
            value={fotoUrl}
            onChange={(e) => setFotoUrl(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
            placeholder="https://..."
          />
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            cole o link de uma imagem (opcional)
          </p>
        </div>

        {/* Preço de venda */}
        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Preço de venda (R$)</label>
          <input
            type="number"
            inputMode="decimal"
            value={precoVenda}
            onChange={(e) => setPrecoVenda(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
            placeholder="0"
          />
        </div>

        {/* Preço de custo */}
        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">
            Custo de produção (R$)
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={precoCusto}
            onChange={(e) => setPrecoCusto(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
            placeholder="0"
          />
        </div>

        {/* Descrição */}
        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Descrição curta</label>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
            placeholder="ex: algodão pima, tamanho único"
          />
        </div>

        {/* Canal de venda */}
        <div className="mb-6">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Onde a compra acontece</label>
          <input
            value={canal}
            onChange={(e) => setCanal(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
            placeholder="ex: DM do Instagram, link de pagamento"
          />
        </div>

        {erro && <p className="mb-3 text-[13px] text-[var(--danger)]">{erro}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[14px] text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando || !podeSalvar}
            className="rounded-xl bg-[var(--secondary)] px-5 py-2 text-[14px] font-medium text-[var(--secondary-ink)] hover:opacity-90 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar produto"}
          </button>
        </div>
      </div>
    </div>
  );
}
