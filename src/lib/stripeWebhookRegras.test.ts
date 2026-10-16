import { describe, expect, it } from "vitest";
import {
  acaoDoPlano,
  cancelamentoAgendado,
  cancelamentoEncerraAcesso,
  cancelamentoFoiAgendadoNesteEvento,
  compraSemValor,
  ehCortesia,
  fimDaCortesia,
  formatarDataBR,
  mascararEmail,
  normalizarEmail,
  origemDaSessao,
  semEmails,
} from "../../supabase/functions/_shared/stripeWebhookRegras";

// HIG-18 (08/10/2026): o stripe-webhook roda em Deno e não tinha teste nenhum.
// As decisões dele moram em _shared/stripeWebhookRegras.ts, sem import de
// runtime, e são testadas aqui pelo Vitest do app. Cada caso abaixo é um bug
// que já aconteceu ou uma regra que já foi decidida.

describe("acaoDoPlano", () => {
  it("assinatura paga, em trial ou em carência libera o plano", () => {
    expect(acaoDoPlano("active", null)).toBe("liberar");
    expect(acaoDoPlano("trialing", "incomplete")).toBe("liberar");
    expect(acaoDoPlano("past_due", "active")).toBe("liberar");
  });

  it("checkout aberto e não pago não libera nada (QA-01)", () => {
    expect(acaoDoPlano("incomplete", null)).toBe("nada");
  });

  it("tentativa abandonada que expira não mexe no plano liberado à mão (PAY-30)", () => {
    expect(acaoDoPlano("incomplete_expired", "incomplete")).toBe("nada");
    expect(acaoDoPlano("incomplete_expired", null)).toBe("nada");
  });

  it("quem pagou e parou de pagar vira cancelada", () => {
    expect(acaoDoPlano("unpaid", "past_due")).toBe("cancelada");
    expect(acaoDoPlano("incomplete_expired", "active")).toBe("cancelada");
  });

  it("canceled pelo updated não mexe (quem decide é o deleted)", () => {
    expect(acaoDoPlano("canceled", "active")).toBe("nada");
  });
});

describe("cancelamentoEncerraAcesso (customer.subscription.deleted)", () => {
  it("plano pago com fatura paga: encerra", () => {
    expect(cancelamentoEncerraAcesso("controle", true)).toBe(true);
    expect(cancelamentoEncerraAcesso("projete", true)).toBe(true);
  });

  it("Premium liberado à mão que abandonou o checkout não vira cancelada (PAY-30)", () => {
    expect(cancelamentoEncerraAcesso("controle", false)).toBe(false);
  });

  it("quem já está no Grátis, beta ou cancelada não é tocada", () => {
    expect(cancelamentoEncerraAcesso("confere", true)).toBe(false);
    expect(cancelamentoEncerraAcesso("beta", true)).toBe(false);
    expect(cancelamentoEncerraAcesso("cancelada", true)).toBe(false);
    expect(cancelamentoEncerraAcesso(null, true)).toBe(false);
  });
});

describe("cancelamento agendado", () => {
  it("vale por cancel_at_period_end ou por cancel_at (portal do Stripe)", () => {
    expect(cancelamentoAgendado({ cancel_at_period_end: true, cancel_at: null })).toBe(true);
    expect(cancelamentoAgendado({ cancel_at_period_end: false, cancel_at: 1_800_000_000 })).toBe(
      true,
    );
    expect(cancelamentoAgendado({ cancel_at_period_end: false, cancel_at: null })).toBe(false);
  });

  it("é a virada só quando previous_attributes mostra que antes não estava agendado", () => {
    const agora = { cancel_at_period_end: true, cancel_at: null };
    expect(cancelamentoFoiAgendadoNesteEvento(agora, { cancel_at_period_end: false })).toBe(true);
  });

  it("reentrega ou outro updated sem mexer no cancelamento não manda o e-mail de novo", () => {
    const agora = { cancel_at_period_end: true, cancel_at: null };
    expect(cancelamentoFoiAgendadoNesteEvento(agora, undefined)).toBe(false);
    expect(cancelamentoFoiAgendadoNesteEvento(agora, {})).toBe(false);
  });

  it("desistir do cancelamento não é virada", () => {
    const agora = { cancel_at_period_end: false, cancel_at: null };
    expect(cancelamentoFoiAgendadoNesteEvento(agora, { cancel_at_period_end: true })).toBe(false);
  });
});

describe("origemDaSessao", () => {
  it("guarda só as chaves conhecidas e com valor válido", () => {
    expect(
      origemDaSessao({
        origem: "landing-a",
        utm_source: "instagram",
        utm_campaign: "<script>",
        qualquer: "coisa",
      }),
    ).toEqual({ origem: "landing-a", utm_source: "instagram" });
  });

  it("sem metadados devolve vazio", () => {
    expect(origemDaSessao(null)).toEqual({});
  });
});

describe("e-mail e texto", () => {
  it("mascara o e-mail pro alerta do Telegram", () => {
    expect(mascararEmail("ana.souza@gmail.com")).toBe("an***@gmail.com");
    expect(mascararEmail("sem-arroba")).toBe("***");
  });

  it("normaliza o e-mail da compra (Ana@ travava o convite)", () => {
    expect(normalizarEmail("  Ana@Gmail.com ")).toBe("ana@gmail.com");
  });

  it("tira qualquer e-mail da mensagem de erro", () => {
    expect(semEmails('falhou pra "ana@gmail.com" agora')).toBe('falhou pra "[email]" agora');
  });

  it("formata a data no fuso de Brasília (22h do dia 9 não vira dia 10)", () => {
    expect(formatarDataBR(new Date("2026-10-10T01:00:00Z"))).toBe("09/10/2026");
  });
});

describe("cortesia (campanha UGC)", () => {
  it("só metadata.cortesia = sim marca a assinatura", () => {
    expect(ehCortesia({ cortesia: "sim" })).toBe(true);
    expect(ehCortesia({ cortesia: "nao" })).toBe(false);
    expect(ehCortesia({})).toBe(false);
    expect(ehCortesia(null)).toBe(false);
    expect(ehCortesia(undefined)).toBe(false);
  });

  it("compra sem valor é assinatura que saiu por R$ 0", () => {
    expect(compraSemValor({ mode: "subscription", amount_total: 0 })).toBe(true);
    expect(compraSemValor({ mode: "subscription", amount_total: 4790 })).toBe(false);
    // amount_total ausente não é zero: não marca cortesia por falta de dado.
    expect(compraSemValor({ mode: "subscription", amount_total: null })).toBe(false);
    expect(compraSemValor({ mode: "payment", amount_total: 0 })).toBe(false);
  });

  it("fim da cortesia é o desconto que acaba primeiro", () => {
    expect(fimDaCortesia([{ end: 2000 }, { end: 1000 }])).toBe(1000);
    expect(fimDaCortesia([{ end: null }, { end: 1500 }])).toBe(1500);
  });

  it("sem data de fim (cupom once/forever, desconto não expandido) devolve null", () => {
    expect(fimDaCortesia([{ end: null }])).toBeNull();
    expect(fimDaCortesia(["di_123"])).toBeNull();
    expect(fimDaCortesia([])).toBeNull();
    expect(fimDaCortesia(null)).toBeNull();
  });
});
