import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { emailPolia, escapeHtml } from "./email-template";

// Este arquivo existe por causa de um defeito real. O `stripe-webhook` carregava
// uma cópia própria da casca HTML, com um comentário mandando "manter os dois em
// sync" — e a cópia não acompanhou a virada v3: título em Georgia serifada e
// rodapé em #9E9E9E, que reprova AA sobre o fundo. Os quatro e-mails de dinheiro
// (compra confirmada, pagamento recusado, cancelamento, renovação) saíam fora da
// marca. Comentário pedindo sincronia não sincroniza nada; teste sincroniza.

const FUNCTIONS_DIR = path.resolve(__dirname, "../../supabase/functions");

describe("emailPolia", () => {
  const html = emailPolia({
    preheader: "preheader",
    headline: "Sua compra foi confirmada",
    paragrafos: ["Primeiro parágrafo."],
    ctaLabel: "Criar minha senha",
    ctaUrl: "https://usepolia.com.br/ativar",
  });

  it("usa Cabinet Grotesk no título, nunca serifada", () => {
    expect(html).toContain("'Cabinet Grotesk'");
    // Fraunces no site é só itálico de acento, e Georgia foi o fallback que a
    // cópia morta do webhook usava. Nenhuma serifada entra em título de e-mail.
    // O lookbehind é pra não pegar o "sans-serif" do fim da pilha, que é o
    // fallback correto — o que não pode entrar é serifada de verdade.
    expect(html).not.toMatch(/Georgia|Times New Roman|Fraunces|(?<!sans-)serif/);
  });

  it("só usa cor que é token do escopo .polia-v3", () => {
    const hexes = [...new Set((html.match(/#[0-9A-Fa-f]{6}/g) ?? []).map((h) => h.toUpperCase()))];
    expect(hexes.sort()).toEqual(
      ["#0A0A0A", "#2C2C2C", "#6B6B6B", "#7CCBCD", "#E6E6E6", "#F2F0ED", "#FFFFFF"].sort(),
    );
  });

  it("não ressuscita os cinzas que reprovam AA sobre o fundo", () => {
    expect(html).not.toMatch(/#9E9E9E|#767676/i);
  });

  it("só mostra a caixa de destaque e o descadastro quando pedidos", () => {
    expect(html).not.toContain("#F6DAD4");
    expect(html).not.toContain("Não quero mais receber");

    const comExtras = emailPolia({
      preheader: "p",
      headline: "h",
      paragrafos: ["p"],
      destaque: { rotulo: "Seu resultado", texto: "Texto" },
      descadastroUrl: "https://usepolia.com.br/descadastrar?t=abc",
    });
    expect(comExtras).toContain("#F6DAD4");
    expect(comExtras).toContain("Não quero mais receber");
  });
});

describe("escapeHtml", () => {
  it("neutraliza tag e atributo vindos de formulário público", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    expect(escapeHtml("O'Brien & filhas")).toBe("O&#39;Brien &amp; filhas");
  });
});

// Guarda de origem: o problema não foi o HTML errado, foi existir um segundo
// HTML. Qualquer edge function que voltar a declarar a própria casca quebra aqui.
describe("edge functions", () => {
  const arquivos = readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "_shared")
    .map((e) => path.join(FUNCTIONS_DIR, e.name, "index.ts"));

  it.each(arquivos)("%s não declara a própria casca de e-mail", (arquivo) => {
    const fonte = readFileSync(arquivo, "utf8");
    expect(fonte).not.toMatch(/function emailPolia/);
    expect(fonte).not.toMatch(/<!DOCTYPE html>/i);
  });
});
