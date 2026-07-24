import { describe, it, expect } from "vitest";
import { lintTextoSocial } from "./social-lint.functions";

describe("lintTextoSocial", () => {
  it("aprova um texto limpo, na voz da casa", () => {
    const resultado = lintTextoSocial(
      "Quanto sobra depois do custo fixo? Faz a conta antes de fechar a venda.",
    );
    expect(resultado.aprovado).toBe(true);
    expect(resultado.violacoes).toHaveLength(0);
  });

  it("reprova travessão em qualquer lugar do texto", () => {
    const resultado = lintTextoSocial("Cobrar certo — isso muda o jogo.");
    expect(resultado.aprovado).toBe(false);
    expect(resultado.violacoes[0].termo).toBe("travessão");
  });

  const casosPalavraProibida: Array<[string, string]> = [
    ["margem", "A margem do produto tá baixa."],
    ["etapa", "Termina essa etapa antes de seguir."],
    ["trilha", "Segue a trilha que preparei."],
    ["jornada", "Essa é a sua jornada."],
    ["marco", "Bateu um marco importante."],
    ["turma", "A turma de julho já fechou."],
    ["infoproduto", "Vende um infoproduto novo."],
    ['"sabe primeiro"', "Quem assina sabe primeiro."],
    ['"planilha por fora"', "Para de usar planilha por fora."],
    ['"do seu jeito"', "Faz do seu jeito."],
    ['"no seu tempo"', "Resolve no seu tempo."],
    ['"no seu ritmo"', "Vai no seu ritmo."],
    ["miga", "Oi, miga, bora conferir."],
    ["querida", "Oi, querida, tudo bem?"],
    ["linda", "Ficou linda essa arte."],
    ["bora", "Bora fazer a conta."],
    ["gata", "E aí, gata."],
    ['"6 dígitos"', "Ganhe 6 dígitos por mês."],
    ['"renda extra fácil"', "Descobre a renda extra fácil."],
    ["fórmula", "Essa é a fórmula certa."],
    ['"últimas vagas"', "Restam últimas vagas."],
    ['"a sócia que já passou"', "Chama a sócia que já passou por isso."],
  ];

  it.each(casosPalavraProibida)("reprova a palavra proibida: %s", (termoEsperado, texto) => {
    const resultado = lintTextoSocial(texto);
    expect(resultado.aprovado).toBe(false);
    expect(resultado.violacoes.some((v) => v.termo === termoEsperado)).toBe(true);
  });

  it('não reprova "digital" quando vem logo depois de "produto"', () => {
    const resultado = lintTextoSocial("Isso é um produto digital, tipo um e-book.");
    expect(resultado.violacoes.some((v) => v.termo.includes("digital"))).toBe(false);
  });

  it('reprova "digital" fora de "produto digital"', () => {
    const resultado = lintTextoSocial("Isso é totalmente digital.");
    expect(resultado.violacoes.some((v) => v.termo.includes("digital"))).toBe(true);
  });

  it("mostra o trecho que reprovou, com contexto ao redor", () => {
    const resultado = lintTextoSocial("Faz do seu jeito, sem pressa nenhuma por aqui.");
    expect(resultado.violacoes[0].trecho).toContain("do seu jeito");
  });

  it("acumula mais de uma violação no mesmo texto", () => {
    const resultado = lintTextoSocial("Oi, miga — bora fazer do seu jeito.");
    expect(resultado.violacoes.length).toBeGreaterThan(1);
  });
});
