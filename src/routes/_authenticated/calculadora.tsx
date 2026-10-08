import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { COTAS_CONFERE, temProjete } from "@/lib/planos";
import { ehPlanoGratis } from "@/lib/planoGratis";
import { buscarMetaDoMes } from "@/lib/metaDoMes";
import { Calculadora } from "@/components/produtos/Calculadora";
import { ModalProduto } from "@/components/produtos/ModalProduto";
import type { Prefill, Produto } from "@/components/produtos/tipos";

interface CalculadoraSearch {
  produto?: string;
}

// Ferramenta própria, separada do catálogo de Produtos. Abre no plano Grátis:
// calcular não gasta cota. Só guardar o resultado como produto passa pela cota
// do catálogo (5 no Grátis), a mesma da trigger do banco.
export const Route = createFileRoute("/_authenticated/calculadora")({
  head: () => ({
    meta: [
      { title: "Calculadora de preço · Pólia One" },
      {
        name: "description",
        content: "Quanto custa, quanto cobrar e quanto sobra em cada venda.",
      },
    ],
  }),
  // `produto` = id de um produto do catálogo a recalcular (vem do menu do card).
  validateSearch: (search: Record<string, unknown>): CalculadoraSearch => ({
    produto: typeof search.produto === "string" ? search.produto : undefined,
  }),
  component: CalculadoraPage,
});

function CalculadoraPage() {
  const { produto: produtoId } = Route.useSearch();
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const meta = useUserMeta();
  // Cancelada conta como Grátis e o cadeado espera o perfil carregar
  // (antes piscava pra quem paga).
  const ehConfere = ehPlanoGratis(meta);
  const ehProjete = temProjete(meta.plano);

  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  // Valor-hora padrão (modo Encomenda, Pro): persistido em profiles pra
  // reaproveitar entre os modos Serviço/Encomenda e entre sessões.
  const valorHoraPadraoQuery = useQuery({
    queryKey: ["produtos-valor-hora-padrao", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("valor_hora_padrao")
        .eq("id", userId!)
        .maybeSingle();
      return (data?.valor_hora_padrao as number | null) ?? null;
    },
  });

  // Meta do mês: mesma fonte que Painel e Financeiro (tabela `metas`).
  const metaBoaQuery = useQuery({
    queryKey: ["meta-do-mes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await buscarMetaDoMes(supabase, userId!);
      return data?.valor_alvo || null;
    },
  });

  // Quantos produtos ativos ela já tem, pra avisar da cota antes de abrir o
  // modal de salvar (só o Grátis tem teto).
  const totalProdutosQuery = useQuery({
    queryKey: ["produtos-total-ativos", userId],
    enabled: !!userId && ehConfere,
    queryFn: async () => {
      const { count } = await supabase
        .from("produtos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("arquivado", false);
      return count ?? 0;
    },
  });
  const cotaAtingida = ehConfere && (totalProdutosQuery.data ?? 0) >= COTAS_CONFERE.produtos;

  // Recalcular um produto existente: carrega só esse produto, da própria dona.
  const produtoQuery = useQuery({
    queryKey: ["produto-recalcular", userId, produtoId],
    enabled: !!userId && !!produtoId,
    queryFn: async () => {
      const { data } = await supabase
        .from("produtos")
        .select(
          "id, user_id, nome, tipo, foto_url, preco_venda, preco_custo, descricao, canal, arquivado, preco_atualizado_em, historico_precos, calculadora_breakdown, created_at, updated_at",
        )
        .eq("id", produtoId!)
        .eq("user_id", userId!)
        .maybeSingle();
      return (data as unknown as Produto | null) ?? null;
    },
  });

  const irParaProdutos = () => void navigate({ to: "/produtos" });

  const pronto =
    !!userId &&
    !valorHoraPadraoQuery.isLoading &&
    !metaBoaQuery.isLoading &&
    !(produtoId && produtoQuery.isLoading);

  if (!pronto) {
    return (
      <PaginaLogada largura="larga" eyebrow="Calculadora" titulo="Quanto sobra em cada venda.">
        <p className="text-[14px] text-[var(--muted)]">Carregando a calculadora…</p>
      </PaginaLogada>
    );
  }

  const produtoRecalcular = produtoId ? (produtoQuery.data ?? null) : null;

  return (
    <PaginaLogada
      dica="calculadora"
      largura="larga"
      eyebrow="Calculadora"
      titulo="Quanto sobra em cada venda."
      subtitulo="Coloque os custos e veja o preço de venda e quanto fica depois das taxas."
    >
      {produtoId && !produtoRecalcular && (
        <p className="mb-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[13px] text-[var(--ink-soft)]">
          A Pólia One não encontrou esse produto no seu catálogo. A calculadora abre em branco.{" "}
          <Link
            to="/produtos"
            className="font-medium text-[var(--secondary-text)] no-underline hover:underline"
          >
            Ver meus produtos
          </Link>
        </p>
      )}

      {cotaAtingida && !produtoRecalcular && (
        <p className="mb-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[13px] text-[var(--ink-soft)]">
          Seu catálogo do plano Grátis já tem {COTAS_CONFERE.produtos} produtos. Dá pra calcular à
          vontade, e guardar mais um pede o Premium.{" "}
          <Link
            to="/assinar"
            search={{ plano: "controle" }}
            className="font-medium text-[var(--secondary-text)] no-underline hover:underline"
          >
            Assinar o Premium
          </Link>
        </p>
      )}

      {/* `key` remonta a calculadora quando muda o produto recalculado: os campos
          nascem de useState(inicial) e não releriam o breakdown novo. */}
      <Calculadora
        key={produtoRecalcular?.id ?? "novo"}
        onSalvarComoProduto={(pf) => {
          if (cotaAtingida) return;
          setPrefill(pf);
          setModalAberto(true);
        }}
        salvarBloqueado={cotaAtingida}
        metaBoa={metaBoaQuery.data ?? null}
        userId={userId}
        ehProjete={ehProjete}
        valorHoraPadrao={valorHoraPadraoQuery.data ?? null}
        valorHoraPadraoCarregando={valorHoraPadraoQuery.isLoading}
        produtoRecalcular={produtoRecalcular}
        onCancelarRecalculo={irParaProdutos}
        onAtualizado={() => {
          qc.invalidateQueries({ queryKey: ["produtos", userId] });
          irParaProdutos();
        }}
      />

      {modalAberto && userId && (
        <ModalProduto
          userId={userId}
          prefill={prefill}
          produtoEdit={null}
          onClose={() => setModalAberto(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["produtos", userId] });
            qc.invalidateQueries({ queryKey: ["produtos-total-ativos", userId] });
            setModalAberto(false);
            irParaProdutos();
          }}
        />
      )}
    </PaginaLogada>
  );
}
