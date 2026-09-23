import { describe, it, expect, afterEach, vi } from "vitest";
import { ERROR_COPY, type ErrorCode } from "./errorCopy";

const CODIGOS = Object.keys(ERROR_COPY) as ErrorCode[];

function textosVisiveis(code: ErrorCode): string[] {
  const c = ERROR_COPY[code];
  return [
    c.title,
    c.subtitle,
    c.pageTitle,
    c.primaryAction.label,
    ...(c.secondaryAction ? [c.secondaryAction.label] : []),
  ];
}

describe("ERROR_COPY", () => {
  it("cobre os 7 códigos do PRD de erros", () => {
    expect([...CODIGOS].sort()).toEqual(
      ["403", "404", "500", "link-expirado", "manutencao", "offline", "sessao-expirada"].sort(),
    );
  });

  it.each(CODIGOS)("%s tem título, subtítulo, título de aba, ícone e ação principal", (code) => {
    const c = ERROR_COPY[code];
    expect(c.title.trim().length).toBeGreaterThan(0);
    expect(c.subtitle.trim().length).toBeGreaterThan(0);
    expect(c.pageTitle.trim().length).toBeGreaterThan(0);
    expect(c.icon).toBeDefined();
    expect(c.primaryAction.label.trim().length).toBeGreaterThan(0);
  });

  // Regra de marca da Pólia: sem travessão, sem exclamação, sem emoji. Erro é
  // exatamente a superfície onde não se faz piada nem se grita.
  it.each(CODIGOS)("%s não usa travessão, exclamação nem emoji em texto visível", (code) => {
    for (const texto of textosVisiveis(code)) {
      expect(texto).not.toMatch(/\u2014/);
      expect(texto).not.toMatch(/!/);
      expect(texto).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  // Mensagem de sistema fala pela empresa no plural ("a gente"), nunca em 1ª
  // pessoa do singular, que é reservada à Sil em /sobre e afins.
  it.each(CODIGOS)("%s não fala em 1ª pessoa do singular", (code) => {
    for (const texto of textosVisiveis(code)) {
      expect(texto).not.toMatch(/\b(eu|consegui|não consigo|minha)\b/i);
    }
  });

  it.each(CODIGOS)("%s: toda ação com href aponta pra rota interna (começa com /)", (code) => {
    const c = ERROR_COPY[code];
    for (const acao of [c.primaryAction, c.secondaryAction]) {
      if (acao && "href" in acao) expect(acao.href).toMatch(/^\//);
    }
  });

  it("os títulos de aba são únicos (cada erro é distinguível no histórico do navegador)", () => {
    const titulos = CODIGOS.map((c) => ERROR_COPY[c].pageTitle);
    expect(new Set(titulos).size).toBe(titulos.length);
  });

  it("sessão expirada manda pro login e link expirado manda pedir link novo", () => {
    expect(ERROR_COPY["sessao-expirada"].primaryAction).toMatchObject({ href: "/auth/login" });
    expect(ERROR_COPY["link-expirado"].primaryAction).toMatchObject({
      href: "/auth/esqueci-senha",
    });
  });

  describe("500", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    // Antes os dois botões iam pro mesmo lugar e "tentar de novo" não tentava nada.
    it("a ação principal recarrega a página de verdade, em vez de só navegar", () => {
      const reload = vi.fn();
      vi.stubGlobal("location", { ...window.location, reload });
      const acao = ERROR_COPY["500"].primaryAction;
      expect("onClick" in acao).toBe(true);
      if ("onClick" in acao) acao.onClick();
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it("a ação secundária leva pro painel, diferente da principal", () => {
      expect(ERROR_COPY["500"].secondaryAction).toEqual({
        label: "Ir pro painel",
        href: "/painel",
      });
    });
  });
});
