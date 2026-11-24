import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { FormularioProduto } from "@/components/produtos/FormularioProduto";
import { chavesDoCatalogo } from "@/components/produtos/colunasProduto";
import { COTAS_CONFERE } from "@/lib/planos";
import { ehPlanoGratis } from "@/lib/planoGratis";

// Cadastro de produto em página (ONE-254, 24/11/2026): saiu da janela estreita
// pra caber a Calculadora dentro da seção Preço. `calcular` abre a calculadora.
interface NovoProdutoSearch {
  calcular?: boolean;
}

export const Route = createFileRoute("/_authenticated/produtos_/novo")({
  head: () => ({ meta: [{ title: "Novo produto · Pólia One" }] }),
  validateSearch: (search: Record<string, unknown>): NovoProdutoSearch =>
    search.calcular === true || search.calcular === "1" || search.calcular === "true"
      ? { calcular: true }
      : {},
  component: NovoProduto,
});

function NovoProduto() {
  const { calcular } = Route.useSearch();
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const meta = useUserMeta();
  const ehConfere = ehPlanoGratis(meta);
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Mesma cota da lista e da trigger do banco: 5 produtos ativos no Grátis.
  const totalQuery = useQuery({
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
  const cotaAtingida = ehConfere && (totalQuery.data ?? 0) >= COTAS_CONFERE.produtos;

  const voltar = () => void navigate({ to: "/produtos" });

  return (
    <PaginaLogada largura="larga" eyebrow="Produtos" titulo="Novo produto.">
      {!userId ? (
        <p className="text-[14px] text-[var(--muted)]">Carregando o cadastro...</p>
      ) : (
        <FormularioProduto
          userId={userId}
          prefill={null}
          produtoEdit={null}
          casca="pagina"
          calculadoraAberta={!!calcular}
          onClose={voltar}
          onSaved={() => {
            for (const chave of chavesDoCatalogo(userId)) qc.invalidateQueries({ queryKey: chave });
            voltar();
          }}
          bloqueadoPorCota={
            cotaAtingida ? (
              <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[13px] text-[var(--ink-soft)]">
                No plano Grátis cabem {COTAS_CONFERE.produtos} produtos ativos. Desative um na lista
                ou assine o Premium pra cadastrar mais.{" "}
                <Link
                  to="/assinar"
                  search={{ plano: "controle" }}
                  className="font-medium text-[var(--secondary-text)] no-underline hover:underline"
                >
                  Assinar o Premium
                </Link>
              </p>
            ) : undefined
          }
        />
      )}
    </PaginaLogada>
  );
}
