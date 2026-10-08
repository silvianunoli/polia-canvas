import { describe, it, expect } from "vitest";
import {
  BTN_PRIMARIO,
  BTN_CONTORNO,
  BTN_ACAO,
  BTN_ACAO_CONTORNO,
  BTN_MIUDO,
  BTN_MIUDO_ACAO,
} from "./botoes";

const TODOS = {
  BTN_PRIMARIO,
  BTN_CONTORNO,
  BTN_ACAO,
  BTN_ACAO_CONTORNO,
  BTN_MIUDO,
  BTN_MIUDO_ACAO,
};

describe("BTN_MIUDO_ACAO", () => {
  // Ação principal dentro de cartão precisa do alvo de toque de 44px.
  it("é o miúdo com altura mínima de 44px", () => {
    expect(BTN_MIUDO_ACAO.startsWith(BTN_MIUDO)).toBe(true);
    expect(BTN_MIUDO_ACAO).toContain("min-h-11");
  });
});

describe("formas canônicas de botão", () => {
  // A auditoria de 13/08/2026 achou três formas convivendo; a única que a
  // usuária vê antes de entrar (retângulo com borda de tinta) virou padrão.
  it.each(Object.entries(TODOS))(
    "%s é retângulo arredondado com borda de tinta e foco visível",
    (_n, cls) => {
      expect(cls).toContain("rounded-xl");
      expect(cls).toContain("border-[var(--ink)]");
      expect(cls).toContain("focus-visible:outline");
      expect(cls).toContain("disabled:cursor-not-allowed");
    },
  );

  // rounded-full fica reservado pra selo não clicável.
  it("nenhuma forma clicável usa rounded-full", () => {
    for (const cls of Object.values(TODOS)) expect(cls).not.toContain("rounded-full");
  });

  it("nenhuma forma tem hex hardcoded: cor só via token", () => {
    for (const cls of Object.values(TODOS)) expect(cls).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it("as formas preenchidas usam turquesa de fundo com texto de contraste; as de contorno, texto de tinta", () => {
    for (const cls of [BTN_PRIMARIO, BTN_ACAO]) {
      expect(cls).toContain("bg-[var(--secondary)]");
      expect(cls).toContain("text-[var(--secondary-ink)]");
    }
    for (const cls of [BTN_CONTORNO, BTN_ACAO_CONTORNO, BTN_MIUDO]) {
      expect(cls).not.toContain("bg-[var(--secondary)]");
      expect(cls).toContain("text-[var(--ink)]");
    }
  });

  it("site público é grande, área logada é média e o miúdo é o menor", () => {
    expect(BTN_PRIMARIO).toContain("text-[15px]");
    expect(BTN_CONTORNO).toContain("text-[15px]");
    expect(BTN_ACAO).toContain("text-[14px]");
    expect(BTN_ACAO_CONTORNO).toContain("text-[14px]");
    expect(BTN_MIUDO).toContain("text-[13px]");
  });
});
