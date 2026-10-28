import { describe, expect, it } from "vitest";
import {
  avisoDeTeste,
  avisoResumoSemana,
  avisoVendasDoDia,
  ehTipoPush,
  hojeEmBrasilia,
  semanaPassadaEmBrasilia,
} from "../../supabase/functions/_shared/pushLembretes.ts";
import { classificarErroFcm, lerContaDeServico } from "../../supabase/functions/_shared/fcm.ts";

describe("hojeEmBrasilia", () => {
  it("usa o dia de Brasília, não o UTC", () => {
    // 02h UTC de 28/10 ainda é 23h de 27/10 em Brasília.
    expect(hojeEmBrasilia(new Date("2026-10-28T02:00:00Z"))).toBe("2026-10-27");
    expect(hojeEmBrasilia(new Date("2026-10-28T03:00:00Z"))).toBe("2026-10-28");
  });
});

describe("semanaPassadaEmBrasilia", () => {
  it("na segunda das 9h pega a segunda e o domingo da semana anterior", () => {
    expect(semanaPassadaEmBrasilia(new Date("2026-11-02T12:00:00Z"))).toEqual({
      inicio: "2026-10-26",
      fim: "2026-11-01",
    });
  });

  it("no domingo ainda olha a semana anterior, não a corrente", () => {
    expect(semanaPassadaEmBrasilia(new Date("2026-11-01T15:00:00Z"))).toEqual({
      inicio: "2026-10-19",
      fim: "2026-10-25",
    });
  });
});

describe("avisos", () => {
  it("resumo formata em reais e acerta o plural", () => {
    expect(avisoResumoSemana(1234.5, 3).corpo).toContain("R$ 1.234,50 em 3 vendas");
    expect(avisoResumoSemana(80, 1).corpo).toContain("em 1 venda.");
  });

  it("cada aviso abre a tela certa", () => {
    expect(avisoVendasDoDia().rota).toBe("/vendas");
    expect(avisoResumoSemana(10, 1).rota).toBe("/painel");
    expect(avisoDeTeste().rota).toBe("/configuracoes");
  });

  it("copy sem exclamação, sem travessão e sem o vocabulário morto", () => {
    const textos = [avisoVendasDoDia(), avisoResumoSemana(10, 2), avisoDeTeste()].flatMap((a) => [
      a.titulo,
      a.corpo,
    ]);
    for (const t of textos) {
      expect(t).not.toMatch(/[!—–]/);
      expect(t.toLowerCase()).not.toMatch(/quanto sobra|margem|jornada|etapa|trilha/);
    }
  });

  it("só aceita os tipos agendados", () => {
    expect(ehTipoPush("vendas_do_dia")).toBe(true);
    expect(ehTipoPush("resumo_semana")).toBe(true);
    expect(ehTipoPush("teste")).toBe(false);
    expect(ehTipoPush(undefined)).toBe(false);
  });
});

describe("fcm", () => {
  it("lê a conta de serviço em base64 e recusa lixo", () => {
    const json = JSON.stringify({
      project_id: "p",
      client_email: "e@x",
      private_key: "k",
      outro: 1,
    });
    expect(lerContaDeServico(btoa(json))).toEqual({
      project_id: "p",
      client_email: "e@x",
      private_key: "k",
    });
    expect(lerContaDeServico("")).toBeNull();
    expect(lerContaDeServico("não é base64")).toBeNull();
    expect(lerContaDeServico(btoa(JSON.stringify({ project_id: "p" })))).toBeNull();
  });

  it("token desinstalado sai da tabela, erro passageiro não", () => {
    expect(classificarErroFcm(404, '{"error":{"status":"NOT_FOUND"}}')).toBe("token_invalido");
    expect(classificarErroFcm(400, '{"details":[{"errorCode":"UNREGISTERED"}]}')).toBe(
      "token_invalido",
    );
    expect(
      classificarErroFcm(400, "The registration token is not a valid FCM registration token"),
    ).toBe("token_invalido");
    expect(classificarErroFcm(503, "UNAVAILABLE")).toBe("erro");
    expect(classificarErroFcm(401, "UNAUTHENTICATED")).toBe("erro");
  });
});
