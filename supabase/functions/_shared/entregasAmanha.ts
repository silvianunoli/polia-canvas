import { emailPolia, escapeHtml } from "./email-polia.ts";
import type { Aviso } from "./fcm.ts";
import { hojeEmBrasilia, somaDias } from "./pushLembretes.ts";

// Aviso da véspera (ONE-174, 05/11/2026). Puro: datas e texto, sem rede nem
// banco, pra ficar testável (src/lib/entregasAmanha.test.ts).
//
// Voz: aviso de produto, sem exclamação e sem piada. O nome da cliente vem de
// formulário público (a vitrine online), então entra escapado no HTML, e fica de
// fora do push porque ele aparece na tela bloqueada do celular.

export type ItemDaEntrega = { nome: string; variacao: string | null; quantidade: number };
export type PedidoDaEntrega = {
  cliente: string | null;
  status: string;
  total: number;
  itens: ItemDaEntrega[];
};

const SITE = "https://one.usepolia.com.br";
const ROTA = "/pedidos";

const formatoReal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** "AAAA-MM-DD" do dia seguinte em Brasília. */
export function amanhaEmBrasilia(agora: Date): string {
  return somaDias(hojeEmBrasilia(agora), 1);
}

function contagem(quantidade: number): string {
  return quantidade === 1 ? "1 entrega" : `${quantidade} entregas`;
}

/** "Joana · 2x Bolo de pote · a receber R$ 36,00", igual ao cartão do quadro. */
export function linhaDoPedido(p: PedidoDaEntrega): string {
  const itens = p.itens
    .map((i) => `${i.quantidade}x ${i.nome}${i.variacao ? ` ${i.variacao}` : ""}`)
    .join(", ");
  const pagamento = p.status === "recebida" ? "pago" : `a receber ${formatoReal.format(p.total)}`;
  return [p.cliente?.trim() || "Sem nome", itens, pagamento].filter(Boolean).join(" · ");
}

export function avisoEntregasAmanha(quantidade: number): Aviso {
  return {
    titulo: `Amanhã: ${contagem(quantidade)}`,
    corpo: "A Pólia One mostra no quadro o que já está pronto e o que falta.",
    rota: ROTA,
  };
}

export function montarEmailEntregasAmanha(pedidos: PedidoDaEntrega[]): {
  assunto: string;
  texto: string;
  html: string;
} {
  const linhas = pedidos.map(linhaDoPedido);
  const rodape = "Pra não receber este aviso, é só desligar em Configurações, na Pólia One.";
  const ctaLabel = "Quero abrir os pedidos";
  const url = `${SITE}${ROTA}`;
  return {
    assunto: `Amanhã: ${contagem(pedidos.length)} na Pólia One`,
    texto: `${linhas.join("\n")}\n\n${ctaLabel}: ${url}\n\n${rodape}`,
    html: emailPolia({
      preheader: "A Pólia One mostra no quadro o que já está pronto e o que falta.",
      headline: `Amanhã: ${contagem(pedidos.length)}`,
      paragrafos: [...linhas.map(escapeHtml), rodape],
      ctaLabel,
      ctaUrl: url,
    }),
  };
}
