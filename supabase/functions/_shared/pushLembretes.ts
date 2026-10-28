import type { Aviso } from "./fcm.ts";

// Avisos push da Pólia One (AND-06, 27/10/2026). Puro: datas e texto, sem rede
// nem banco, pra ficar testável (src/lib/pushLembretes.test.ts).
//
// Voz: aviso de produto, a Pólia é o sujeito da promessa, sem exclamação e
// sem piada em aviso de dinheiro. Cobrança e fim de teste não passam por aqui,
// continuam no e-mail.

export type TipoPush = "vendas_do_dia" | "resumo_semana";

export function ehTipoPush(valor: unknown): valor is TipoPush {
  return valor === "vendas_do_dia" || valor === "resumo_semana";
}

const formatoDiaBrasilia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "AAAA-MM-DD" do dia corrente em Brasília. */
export function hojeEmBrasilia(agora: Date): string {
  return formatoDiaBrasilia.format(agora);
}

function somaDias(dia: string, dias: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Segunda a domingo da semana que já fechou, no horário de Brasília. */
export function semanaPassadaEmBrasilia(agora: Date): { inicio: string; fim: string } {
  const hoje = hojeEmBrasilia(agora);
  const diaDaSemana = new Date(`${hoje}T12:00:00Z`).getUTCDay(); // 0 = domingo
  const desdeSegunda = (diaDaSemana + 6) % 7;
  const segundaDestaSemana = somaDias(hoje, -desdeSegunda);
  return { inicio: somaDias(segundaDestaSemana, -7), fim: somaDias(segundaDestaSemana, -1) };
}

const formatoReal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function avisoVendasDoDia(): Aviso {
  return {
    titulo: "Teve venda hoje?",
    corpo: "Registra agora na Pólia One e o mês fecha com o número certo.",
    rota: "/vendas",
  };
}

export function avisoResumoSemana(total: number, quantidade: number): Aviso {
  const vendas = quantidade === 1 ? "1 venda" : `${quantidade} vendas`;
  return {
    titulo: "A semana da sua marca",
    corpo: `Semana passada a marca vendeu ${formatoReal.format(total)} em ${vendas}. O Painel mostra quanto disso a marca lucra.`,
    rota: "/painel",
  };
}

export function avisoDeTeste(): Aviso {
  return {
    titulo: "Aviso de teste",
    corpo: "Se chegou aqui, os avisos da Pólia One estão funcionando neste celular.",
    rota: "/configuracoes",
  };
}
