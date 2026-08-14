import { describe, expect, it } from "vitest";
import {
  diasDoMes,
  montarPromptMes,
  planejamentoIncompleto,
  precisaLembrarHoje,
  sanearRespostaMes,
} from "@/lib/planoConteudo.functions";
import type { ContextoMarca } from "@/lib/planoConteudo.functions";

const CONTEXTO_BASE: ContextoMarca = {
  proposito: "ajudar mulheres a se organizarem",
  missao: "vender velas artesanais pra quem ama casa aconchegante",
  personalidade: "acolhedora",
  tom: "calma",
  fraseValor: "velas que contam histórias",
  perfilCliente: "mulheres de 30-45 anos",
  dores: "casa sem identidade",
  gatilhos: "cheiro que lembra a infância",
  posicionamento: "premium artesanal",
  produtos: "velas de soja, difusores",
  transformacao: "casa mais aconchegante",
  voz: "informal e acolhedora",
  antiExemplos: "nunca usa gírias de vendas agressivas",
  canalPrincipal: "instagram",
};

describe("planejamentoIncompleto", () => {
  it("bloqueia quando falta marca (missão e propósito vazios)", () => {
    expect(
      planejamentoIncompleto({
        "mercado.perfil_cliente": "x",
        "produto.lista": "y",
      }),
    ).toBe(true);
  });

  it("bloqueia quando falta perfil_cliente", () => {
    expect(
      planejamentoIncompleto({
        "marca.missao": "x",
        "produto.lista": "y",
      }),
    ).toBe(true);
  });

  it("bloqueia quando falta produto.lista", () => {
    expect(
      planejamentoIncompleto({
        "marca.missao": "x",
        "mercado.perfil_cliente": "y",
      }),
    ).toBe(true);
  });

  it("libera quando marca (missão OU propósito) + perfil_cliente + produto.lista estão preenchidos", () => {
    expect(
      planejamentoIncompleto({
        "marca.proposito": "x",
        "mercado.perfil_cliente": "y",
        "produto.lista": "z",
      }),
    ).toBe(false);
    expect(
      planejamentoIncompleto({
        "marca.missao": "x",
        "mercado.perfil_cliente": "y",
        "produto.lista": "z",
      }),
    ).toBe(false);
  });
});

describe("diasDoMes", () => {
  it("retorna 31 pra janeiro", () => {
    expect(diasDoMes(1, 2026)).toBe(31);
  });

  it("retorna 28 pra fevereiro em ano não-bissexto", () => {
    expect(diasDoMes(2, 2026)).toBe(28);
  });

  it("retorna 29 pra fevereiro em ano bissexto", () => {
    expect(diasDoMes(2, 2028)).toBe(29);
  });

  it("retorna 30 pra abril", () => {
    expect(diasDoMes(4, 2026)).toBe(30);
  });
});

describe("montarPromptMes", () => {
  it("pede a quantidade certa de dias e inclui o contexto de marca", () => {
    const { prompt } = montarPromptMes({
      mes: 2,
      ano: 2026,
      diasNoMes: 28,
      contexto: CONTEXTO_BASE,
    });
    expect(prompt).toContain("28 dias");
    expect(prompt).toContain("Exatamente 28 itens");
    expect(prompt).toContain(CONTEXTO_BASE.missao);
    expect(prompt).toContain(CONTEXTO_BASE.perfilCliente);
    expect(prompt).toContain(CONTEXTO_BASE.produtos);
    expect(prompt).toContain(CONTEXTO_BASE.voz);
  });
});

describe("sanearRespostaMes", () => {
  it("aceita resposta válida e mantém a ordem", () => {
    const json = {
      dias: [
        { dia: 1, tipo: "feed", titulo: "A", ideia: "primeira ideia" },
        { dia: 2, tipo: "reels", titulo: "B", ideia: "segunda ideia" },
      ],
    };
    const dias = sanearRespostaMes(json, 2);
    expect(dias).toHaveLength(2);
    expect(dias[0].tipo).toBe("feed");
    expect(dias[1].tipo).toBe("reels");
  });

  it("descarta dias fora do intervalo do mês", () => {
    const json = {
      dias: [
        { dia: 1, tipo: "feed", titulo: "A", ideia: "x" },
        { dia: 99, tipo: "feed", titulo: "B", ideia: "y" },
      ],
    };
    expect(sanearRespostaMes(json, 28)).toHaveLength(1);
  });

  it("sanitiza tipo inválido pra 'feed'", () => {
    const json = { dias: [{ dia: 1, tipo: "video_tiktok", titulo: "A", ideia: "x" }] };
    expect(sanearRespostaMes(json, 1)[0].tipo).toBe("feed");
  });
});

describe("precisaLembrarHoje", () => {
  it("não lembra quando não há item de hoje", () => {
    expect(precisaLembrarHoje(new Date(), null)).toBe(false);
  });

  it("não lembra quando o item de hoje já foi postado", () => {
    expect(precisaLembrarHoje(new Date(), { postado: true })).toBe(false);
  });

  it("lembra quando o item de hoje ainda não foi postado", () => {
    expect(precisaLembrarHoje(new Date(), { postado: false })).toBe(true);
  });
});
