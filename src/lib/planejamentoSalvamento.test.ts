import { describe, it, expect } from "vitest";
import {
  enfileirarSalvamento,
  esperarSalvamentos,
  haSalvamentoEmAndamento,
  secaoTemResposta,
} from "./planejamentoSalvamento";

function adiado() {
  let resolver!: () => void;
  let rejeitar!: (e: unknown) => void;
  const promessa = new Promise<void>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

describe("enfileirarSalvamento (QA-14)", () => {
  it("o segundo envio do mesmo campo só sai depois que o primeiro voltou", async () => {
    const ordem: string[] = [];
    const primeiro = adiado();
    let valor = "azul";
    const p1 = enfileirarSalvamento("1.1:0", async () => {
      ordem.push(`sai:${valor}`);
      await primeiro.promessa;
      ordem.push("volta:1");
    });
    // Deixa o primeiro sair antes de a usuária continuar digitando.
    await new Promise((r) => setTimeout(r, 0));
    valor = "verde";
    const p2 = enfileirarSalvamento("1.1:0", async () => {
      ordem.push(`sai:${valor}`);
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(ordem).toEqual(["sai:azul"]);
    primeiro.resolver();
    await Promise.all([p1, p2]);
    expect(ordem).toEqual(["sai:azul", "volta:1", "sai:verde"]);
  });

  it("falha no primeiro não trava o próximo, e a falha chega a quem chamou", async () => {
    const p1 = enfileirarSalvamento("1.1:1", async () => {
      throw new Error("rede");
    });
    let rodou = false;
    const p2 = enfileirarSalvamento("1.1:1", async () => {
      rodou = true;
    });
    await expect(p1).rejects.toThrow("rede");
    await p2;
    expect(rodou).toBe(true);
  });

  it("campos diferentes não esperam um pelo outro", async () => {
    const travado = adiado();
    void enfileirarSalvamento("1.1:2", () => travado.promessa);
    let outro = false;
    await enfileirarSalvamento("1.1:3", async () => {
      outro = true;
    });
    expect(outro).toBe(true);
    travado.resolver();
    await esperarSalvamentos();
  });

  it("esperarSalvamentos espera a fila esvaziar e haSalvamentoEmAndamento acompanha", async () => {
    const travado = adiado();
    void enfileirarSalvamento("1.2:0", () => travado.promessa);
    expect(haSalvamentoEmAndamento()).toBe(true);
    let terminou = false;
    const espera = esperarSalvamentos().then(() => {
      terminou = true;
    });
    await Promise.resolve();
    expect(terminou).toBe(false);
    travado.resolver();
    await espera;
    expect(terminou).toBe(true);
    expect(haSalvamentoEmAndamento()).toBe(false);
  });

  it("esperarSalvamentos desiste depois do limite", async () => {
    const travado = adiado();
    void enfileirarSalvamento("1.2:1", () => travado.promessa);
    const inicio = Date.now();
    await esperarSalvamentos(30);
    expect(Date.now() - inicio).toBeLessThan(1000);
    travado.resolver();
    await esperarSalvamentos();
  });
});

describe("secaoTemResposta (QA-21)", () => {
  it("seção toda em branco não fecha", () => {
    expect(secaoTemResposta(["", "   ", "\n"])).toBe(false);
    expect(secaoTemResposta([])).toBe(false);
  });
  it("uma resposta basta", () => {
    expect(secaoTemResposta(["", "Bolsas de couro"])).toBe(true);
  });
});
