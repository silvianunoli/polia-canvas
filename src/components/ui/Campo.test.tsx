import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Campo } from "./Campo";

afterEach(() => cleanup());

describe("Campo", () => {
  it("mantém o aria-describedby do filho e soma a dica", () => {
    render(
      <Campo label="Valor" id="valor" hint="Em reais">
        <input aria-describedby="aviso-externo" />
      </Campo>,
    );
    expect(screen.getByLabelText("Valor").getAttribute("aria-describedby")).toBe(
      "aviso-externo valor-dica",
    );
  });

  it("sem dica nem erro, preserva só o do filho", () => {
    render(
      <Campo label="Valor" id="valor">
        <input aria-describedby="aviso-externo" />
      </Campo>,
    );
    expect(screen.getByLabelText("Valor").getAttribute("aria-describedby")).toBe("aviso-externo");
  });

  it("sem nada, não inventa atributo", () => {
    render(
      <Campo label="Valor" id="valor">
        <input />
      </Campo>,
    );
    expect(screen.getByLabelText("Valor").hasAttribute("aria-describedby")).toBe(false);
  });
});
