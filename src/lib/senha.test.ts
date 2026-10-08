import { describe, it, expect } from "vitest";
import {
  META_PRECISA_CRIAR_SENHA,
  MSG_REQUISITOS_SENHA,
  REQUISITOS,
  mensagemErroNovaSenha,
  precisaCriarSenha,
  senhaCumpreRequisitos,
} from "./senha";

describe("REQUISITOS", () => {
  it("são exatamente três: tamanho, número e maiúscula (o guia visual mostra uma barra de 3 segmentos)", () => {
    expect(REQUISITOS.map((r) => r.id)).toEqual(["len", "num", "up"]);
  });

  it("cada requisito tem um rótulo visível e uma função de teste", () => {
    for (const r of REQUISITOS) {
      expect(r.label.length).toBeGreaterThan(0);
      expect(typeof r.teste).toBe("function");
    }
  });

  it("nenhum rótulo usa exclamação, travessão ou emoji (regra de marca)", () => {
    for (const r of REQUISITOS) {
      expect(r.label).not.toMatch(/[!\u2014]/);
      expect(r.label).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe("senhaCumpreRequisitos", () => {
  it("aceita senha com 8+ caracteres, 1 número e 1 maiúscula", () => {
    expect(senhaCumpreRequisitos("Polia123")).toBe(true);
  });

  it("aceita exatamente 8 caracteres (limite inclusivo)", () => {
    expect("Abcdef12").toHaveLength(8);
    expect(senhaCumpreRequisitos("Abcdef12")).toBe(true);
  });

  it("bloqueia quando tem 7 caracteres, mesmo com número e maiúscula", () => {
    expect(senhaCumpreRequisitos("Abcde12")).toBe(false);
  });

  it("bloqueia quando não tem número", () => {
    expect(senhaCumpreRequisitos("Poliapolia")).toBe(false);
  });

  it("bloqueia quando não tem letra maiúscula", () => {
    expect(senhaCumpreRequisitos("polia1234")).toBe(false);
  });

  it("bloqueia senha vazia", () => {
    expect(senhaCumpreRequisitos("")).toBe(false);
  });

  it("espaço conta no tamanho, mas não substitui número nem maiúscula", () => {
    expect(senhaCumpreRequisitos("        ")).toBe(false);
    expect(senhaCumpreRequisitos("A 1     ")).toBe(true);
  });

  it("símbolo não é obrigatório (a régua é só tamanho, número e maiúscula)", () => {
    expect(senhaCumpreRequisitos("SemSimbolo1")).toBe(true);
  });

  // A regex de maiúscula é [A-Z]: letra acentuada maiúscula (Á, Ç) não conta.
  // Fica documentado pra ninguém mudar a régua da tela sem querer.
  it("maiúscula acentuada não satisfaz o requisito de maiúscula (regex é [A-Z])", () => {
    expect(senhaCumpreRequisitos("Ávila123")).toBe(false);
    expect(senhaCumpreRequisitos("Ávila12A")).toBe(true);
  });

  it("cada requisito falha isoladamente quando só ele falta", () => {
    const [len, num, up] = REQUISITOS;
    expect(len.teste("Ab1")).toBe(false);
    expect(num.teste("Abcdefgh")).toBe(false);
    expect(up.teste("abcdefg1")).toBe(false);
  });
});

describe("precisaCriarSenha (conta criada pela compra, QA-03)", () => {
  it("só é verdadeiro com a marca do webhook em true", () => {
    expect(precisaCriarSenha({ [META_PRECISA_CRIAR_SENHA]: true })).toBe(true);
    expect(precisaCriarSenha({ [META_PRECISA_CRIAR_SENHA]: false })).toBe(false);
    expect(precisaCriarSenha({ [META_PRECISA_CRIAR_SENHA]: "true" })).toBe(false);
    expect(precisaCriarSenha({ full_name: "Ana" })).toBe(false);
    expect(precisaCriarSenha(undefined)).toBe(false);
    expect(precisaCriarSenha(null)).toBe(false);
  });

  it("usa o mesmo nome literal que o webhook grava", () => {
    expect(META_PRECISA_CRIAR_SENHA).toBe("precisa_criar_senha");
  });
});

describe("mensagemErroNovaSenha", () => {
  it("same_password vira mensagem própria", () => {
    expect(mensagemErroNovaSenha({ code: "same_password", message: "x" })).toBe(
      "A senha nova precisa ser diferente da atual.",
    );
  });

  it("reconhece same_password só pela mensagem do Supabase (sem code)", () => {
    expect(
      mensagemErroNovaSenha({
        message: "New password should be different from the old password.",
      }),
    ).toMatch(/diferente da atual/);
  });

  it("weak_password explica o que fazer", () => {
    expect(mensagemErroNovaSenha({ code: "weak_password", message: "x" })).toMatch(
      /^Essa senha é fácil de adivinhar/,
    );
  });

  it("reauthentication_needed pede entrada recente", () => {
    expect(mensagemErroNovaSenha({ code: "reauthentication_needed" })).toMatch(/entrada recente/);
  });

  it("erro sem saída do lado dela devolve null (a tela usa o tenta de novo)", () => {
    expect(mensagemErroNovaSenha({ code: "unexpected_failure", message: "boom" })).toBeNull();
    expect(mensagemErroNovaSenha(null)).toBeNull();
    expect(mensagemErroNovaSenha(undefined)).toBeNull();
  });

  it("toda mensagem começa com maiúscula, sem exclamação nem travessão", () => {
    const msgs = [
      mensagemErroNovaSenha({ code: "same_password" }),
      mensagemErroNovaSenha({ code: "weak_password" }),
      mensagemErroNovaSenha({ code: "reauthentication_needed" }),
      MSG_REQUISITOS_SENHA,
    ];
    for (const m of msgs) {
      expect(m).toMatch(/^[A-ZÀ-Ú]/);
      expect(m).not.toMatch(/[!—–]/);
    }
  });
});
