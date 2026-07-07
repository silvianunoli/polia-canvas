import { describe, it, expect, beforeEach, vi } from "vitest";
import { getCookieConsent, setCookieConsent, hasConsent, COOKIE_CONSENT_KEY } from "./cookieConsent";

describe("getCookieConsent", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("retorna null quando nada foi salvo ainda", () => {
    expect(getCookieConsent()).toBeNull();
  });

  it("retorna o valor salvo no localStorage", () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    expect(getCookieConsent()).toBe("accepted");
  });
});

describe("setCookieConsent", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("grava o valor escolhido na chave de consentimento", () => {
    setCookieConsent("essential");
    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBe("essential");
  });

  it("dispara o evento 'polia-cookie-consent-change' pra quem estiver ouvindo (ex.: banner de cookies)", () => {
    const listener = vi.fn();
    window.addEventListener("polia-cookie-consent-change", listener);
    setCookieConsent("rejected");
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("polia-cookie-consent-change", listener);
  });

  it("sobrescreve um valor anterior", () => {
    setCookieConsent("accepted");
    setCookieConsent("rejected");
    expect(getCookieConsent()).toBe("rejected");
  });
});

describe("hasConsent", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('tipo "essential"', () => {
    it("é true assim que existe QUALQUER decisão salva (mesmo rejeitada)", () => {
      setCookieConsent("rejected");
      expect(hasConsent("essential")).toBe(true);
    });

    it("é false antes de qualquer decisão", () => {
      expect(hasConsent("essential")).toBe(false);
    });
  });

  describe('tipo "analytics"', () => {
    it("é true somente quando o consentimento é 'accepted'", () => {
      setCookieConsent("accepted");
      expect(hasConsent("analytics")).toBe(true);
    });

    it("é false quando o consentimento é 'essential'", () => {
      setCookieConsent("essential");
      expect(hasConsent("analytics")).toBe(false);
    });

    it("é false quando o consentimento é 'rejected'", () => {
      setCookieConsent("rejected");
      expect(hasConsent("analytics")).toBe(false);
    });

    it("é false antes de qualquer decisão", () => {
      expect(hasConsent("analytics")).toBe(false);
    });
  });
});
