import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("junta múltiplas strings de classe com espaço", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("ignora valores falsy (undefined, null, false, '')", () => {
    expect(cn("a", undefined, null, false, "", "b")).toBe("a b");
  });

  it("resolve conflito Tailwind mantendo a última classe conflitante", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("expande objeto de classes condicionais (clsx)", () => {
    expect(cn({ ativo: true, oculto: false })).toBe("ativo");
  });

  it("achata arrays aninhadas de classes", () => {
    expect(cn(["a", ["b", "c"]])).toBe("a b c");
  });

  it("retorna string vazia quando não recebe argumentos", () => {
    expect(cn()).toBe("");
  });
});
