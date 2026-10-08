// Seleção de categoria do ModalLancamento (QA-28). Regra pura, sem React.
//
// O bug: com "+ nova categoria" aberta, clicar num chip existente marcava o
// chip (aria-pressed), mas o campo de texto continuava aberto e era ELE que ia
// pro banco. Ficavam dois botões marcados na tela e o lançamento era salvo sem
// categoria (texto vazio) ou com o texto digitado, nunca com o chip escolhido.
// Agora chip e "nova categoria" se excluem: escolher um fecha o outro.

export interface SelecaoCategoria {
  categoria: string;
  novaAberta: boolean;
  novaTexto: string;
}

export type CliqueCategoria = { tipo: "chip"; valor: string } | { tipo: "nova" };

export function clicarCategoria(
  atual: SelecaoCategoria,
  clique: CliqueCategoria,
): SelecaoCategoria {
  if (clique.tipo === "nova") {
    // Clicar de novo em "+ nova categoria" fecha o campo (o botão é toggle).
    if (atual.novaAberta) return { categoria: "", novaAberta: false, novaTexto: "" };
    return { categoria: "", novaAberta: true, novaTexto: atual.novaTexto };
  }
  // Chip: alterna (clicar no já marcado desmarca) e fecha a nova categoria.
  return {
    categoria: atual.categoria === clique.valor && !atual.novaAberta ? "" : clique.valor,
    novaAberta: false,
    novaTexto: "",
  };
}

// O que vai pro banco: o texto da nova categoria quando ela está aberta, senão
// o chip marcado. Vazio vira null (categoria é opcional).
export function categoriaParaSalvar(s: SelecaoCategoria): string | null {
  const valor = s.novaAberta ? s.novaTexto.trim() : s.categoria;
  return valor || null;
}
