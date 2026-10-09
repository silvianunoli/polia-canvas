import { describe, expect, it } from "vitest";
import {
  BLOQUEIO_LOGIN_SEGUNDOS,
  MAX_TENTATIVAS_LOGIN,
  interpretarBloqueio,
  segundosRestantes,
  somarFalha,
  type EstadoBloqueio,
} from "./bloqueioLogin";

// QA-10 (09/10/2026): o F5 zerava o bloqueio de 5 senhas erradas.
describe("bloqueio do login", () => {
  const agora = 1_800_000_000_000;

  it("a 5ª senha errada trava por 60 s; antes disso só conta", () => {
    let e: EstadoBloqueio = { tentativas: 0, ate: null };
    for (let i = 1; i < MAX_TENTATIVAS_LOGIN; i++) {
      e = somarFalha(e, agora);
      expect(e).toEqual({ tentativas: i, ate: null });
    }
    e = somarFalha(e, agora);
    expect(e.ate).toBe(agora + BLOQUEIO_LOGIN_SEGUNDOS * 1000);
    expect(segundosRestantes(e, agora)).toBe(60);
  });

  it("depois do F5 o bloqueio guardado continua valendo", () => {
    const guardado = JSON.stringify({ tentativas: 5, ate: agora + 42_000 });
    const e = interpretarBloqueio(guardado, agora);
    expect(segundosRestantes(e, agora)).toBe(42);
  });

  it("as tentativas antes do bloqueio também sobrevivem ao F5", () => {
    const e = interpretarBloqueio(JSON.stringify({ tentativas: 3, ate: null }), agora);
    expect(somarFalha(somarFalha(e, agora), agora).ate).not.toBeNull();
  });

  it("bloqueio vencido zera tudo", () => {
    const e = interpretarBloqueio(JSON.stringify({ tentativas: 5, ate: agora - 1 }), agora);
    expect(e).toEqual({ tentativas: 0, ate: null });
  });

  it("lixo no armazenamento não quebra nem bloqueia", () => {
    expect(interpretarBloqueio("{nao-json", agora)).toEqual({ tentativas: 0, ate: null });
    expect(interpretarBloqueio(JSON.stringify({ tentativas: -2, ate: "x" }), agora)).toEqual({
      tentativas: 0,
      ate: null,
    });
    expect(interpretarBloqueio(null, agora)).toEqual({ tentativas: 0, ate: null });
  });
});
