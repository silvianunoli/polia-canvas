import type { Prefill, Produto } from "./tipos";
import { FormularioProduto } from "./FormularioProduto";

/**
 * Cadastro de produto na janela. Desde 24/11/2026 (ONE-254) a lista de
 * Produtos abre a página /produtos/novo e /produtos/$produtoId; a janela
 * ficou pra Calculadora avulsa ("Guardar esse preço" a partir do segundo).
 * A lógica mora em FormularioProduto, a mesma da página.
 */
export function ModalProduto(props: {
  userId: string;
  prefill: Prefill | null;
  produtoEdit: Produto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return <FormularioProduto {...props} casca="janela" />;
}
