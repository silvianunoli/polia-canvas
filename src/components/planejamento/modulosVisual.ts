import {
  Sprout,
  Users,
  Package,
  Wallet,
  Megaphone,
  Target,
  type LucideIcon,
} from "lucide-react";

// Um ícone por módulo, consistente nas 3 superfícies (header do documento,
// faixa sticky e nós do mapa).
export const MODULO_ICONE: Record<number, LucideIcon> = {
  1: Sprout,
  2: Users,
  3: Package,
  4: Wallet,
  5: Megaphone,
  6: Target,
};

// Campo cuja resposta vira o snippet do módulo no Mapa (a resposta destaque).
export const MODULO_SNIPPET_CAMPO: Record<number, string> = {
  1: "marca.proposito",
  2: "mercado.posicionamento",
  3: "marca.frase_valor",
  4: "financeiro.preco_ideal",
  5: "caderno.bio",
  6: "metas.visao_1ano",
};
