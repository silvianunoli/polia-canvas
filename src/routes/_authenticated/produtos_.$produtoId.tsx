import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { FormularioProduto } from "@/components/produtos/FormularioProduto";
import { SELECT_PRODUTO, chavesDoCatalogo } from "@/components/produtos/colunasProduto";
import type { Produto } from "@/components/produtos/tipos";

// Editar produto em página (ONE-254, 24/11/2026). O "Recalcular preço" da
// lista chega aqui com `calcular`, e a calculadora abre com a conta salva:
// antes ele levava pra /calculadora e a dona perdia o cadastro de vista.
interface EditarProdutoSearch {
  calcular?: boolean;
}

export const Route = createFileRoute("/_authenticated/produtos_/$produtoId")({
  head: () => ({ meta: [{ title: "Editar produto · Pólia One" }] }),
  validateSearch: (search: Record<string, unknown>): EditarProdutoSearch =>
    search.calcular === true || search.calcular === "1" || search.calcular === "true"
      ? { calcular: true }
      : {},
  component: EditarProduto,
});

function EditarProduto() {
  const { produtoId } = Route.useParams();
  const { calcular } = Route.useSearch();
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Só o produto da própria dona (o RLS também barra).
  const produtoQuery = useQuery({
    queryKey: ["produto-editar", userId, produtoId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select(SELECT_PRODUTO)
        .eq("id", produtoId)
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Produto | null) ?? null;
    },
  });

  const voltar = () => void navigate({ to: "/produtos" });
  const produto = produtoQuery.data ?? null;

  return (
    <PaginaLogada
      largura="larga"
      eyebrow="Cadastro de produtos"
      titulo={produto ? produto.nome : "Editar produto."}
    >
      {!userId || produtoQuery.isLoading ? (
        <p className="text-[14px] text-[var(--muted)]">Carregando o produto...</p>
      ) : produtoQuery.isError ? (
        <div role="alert" className="space-y-3">
          <p className="text-[14px] text-[var(--danger)]">
            A Pólia One não conseguiu abrir esse produto agora.
          </p>
          <button
            type="button"
            onClick={() => void produtoQuery.refetch()}
            className="inline-flex min-h-11 items-center text-[14px] font-medium text-[var(--secondary-text)] hover:underline"
          >
            Tentar de novo
          </button>
        </div>
      ) : !produto ? (
        <p className="text-[14px] text-[var(--ink-soft)]">
          Esse produto não está no seu catálogo.{" "}
          <Link
            to="/produtos"
            className="font-medium text-[var(--secondary-text)] no-underline hover:underline"
          >
            Ver meus produtos
          </Link>
        </p>
      ) : (
        <FormularioProduto
          key={produto.id}
          userId={userId}
          prefill={null}
          produtoEdit={produto}
          casca="pagina"
          calculadoraAberta={!!calcular}
          onClose={voltar}
          onSaved={() => {
            for (const chave of chavesDoCatalogo(userId)) qc.invalidateQueries({ queryKey: chave });
            qc.invalidateQueries({ queryKey: ["produto-editar", userId, produtoId] });
            voltar();
          }}
        />
      )}
    </PaginaLogada>
  );
}
