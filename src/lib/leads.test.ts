import { describe, expect, it } from "vitest";
import {
  ehLead,
  formatarWhatsapp,
  noGrupo,
  normalizarWhatsapp,
  resumoLeads,
  slugValido,
  sugerirSlug,
  type ClienteResumo,
} from "./leads";

describe("normalizarWhatsapp", () => {
  it("aceita os formatos que a cliente digita", () => {
    expect(normalizarWhatsapp("(11) 98888-0000")).toBe("5511988880000");
    expect(normalizarWhatsapp("+55 11 98888 0000")).toBe("5511988880000");
    expect(normalizarWhatsapp("011988880000")).toBe("5511988880000");
    expect(normalizarWhatsapp("1133334444")).toBe("551133334444");
  });
  it("recusa o que não é número brasileiro", () => {
    expect(normalizarWhatsapp("98888-0000")).toBeNull();
    expect(normalizarWhatsapp("(11) 88888-00001")).toBeNull();
    expect(normalizarWhatsapp("(10) 98888-0000")).toBeNull();
    expect(normalizarWhatsapp("(11) 18888-0000")).toBeNull();
    expect(normalizarWhatsapp("")).toBeNull();
  });
  it("o resultado passa no check do banco", () => {
    expect(normalizarWhatsapp("(21) 97777-1234")).toMatch(/^[0-9]{12,13}$/);
  });
});

describe("formatarWhatsapp", () => {
  it("formata celular e fixo", () => {
    expect(formatarWhatsapp("5511988880000")).toBe("(11) 98888-0000");
    expect(formatarWhatsapp("551133334444")).toBe("(11) 3333-4444");
  });
  it("devolve igual o que não reconhece", () => {
    expect(formatarWhatsapp("123")).toBe("123");
  });
});

describe("slug do link", () => {
  it("sugere a partir do nome da marca", () => {
    expect(sugerirSlug("Canecas da Aimer")).toBe("canecas-da-aimer");
    expect(sugerirSlug("  Ateliê São João!! ")).toBe("atelie-sao-joao");
  });
  it("não sugere menos de 3 letras", () => {
    expect(sugerirSlug("A")).toBe("");
  });
  it("corta em 40 sem hífen no fim", () => {
    const s = sugerirSlug("a".repeat(39) + " b");
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("-")).toBe(false);
    expect(slugValido(s)).toBe(true);
  });
  it("valida igual ao banco", () => {
    expect(slugValido("canecas-da-aimer")).toBe(true);
    expect(slugValido("ab")).toBe(false);
    expect(slugValido("-canecas")).toBe(false);
    expect(slugValido("Canecas")).toBe(false);
    expect(slugValido("canecas_aimer")).toBe(false);
  });
});

describe("lead e grupos", () => {
  it("lead é antes do pedido ou sem status", () => {
    expect(ehLead(null)).toBe(true);
    expect(ehLead("Pensando")).toBe(true);
    expect(ehLead("Em produção")).toBe(false);
  });
  it("filtra por grupo", () => {
    expect(noGrupo("Primeiro contato", "leads")).toBe(true);
    expect(noGrupo("Entregue", "pedido")).toBe(true);
    expect(noGrupo("Pós-venda", "pedido")).toBe(false);
    expect(noGrupo("Pós-venda", "depois")).toBe(true);
    expect(noGrupo(null, "todas")).toBe(true);
  });
});

describe("resumoLeads", () => {
  const c = (id: string, extra: Partial<ClienteResumo>): ClienteResumo => ({
    id,
    status_pedido: "Primeiro contato",
    origem: null,
    created_at: "2026-10-10T12:00:00Z",
    venda_registrada: false,
    novo: false,
    ...extra,
  });

  it("conta o mês, o link, quem virou cliente e os não vistos", () => {
    const r = resumoLeads(
      [
        c("1", { origem: "link", novo: true }),
        c("2", { origem: "instagram", status_pedido: "Entregue" }),
        c("3", { origem: "instagram" }),
        c("4", { origem: "indicacao", created_at: "2026-09-02T12:00:00Z" }),
      ],
      "2026-10",
      new Map([
        ["2", 100],
        ["4", 400],
      ]),
    );
    expect(r).toEqual({
      novosNoMes: 3,
      peloLink: 1,
      viraramCliente: 1,
      naoVistos: 1,
      origemMaisComum: "instagram",
      origemQueMaisCompra: "indicacao",
    });
  });

  it("sem origem nem compra fica null", () => {
    const r = resumoLeads([c("1", {})], "2026-10");
    expect(r.origemMaisComum).toBeNull();
    expect(r.origemQueMaisCompra).toBeNull();
  });
});
