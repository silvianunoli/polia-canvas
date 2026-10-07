import { describe, it, expect } from "vitest";
import { ehErroDeCaptcha, tokenCaptcha, MSG_CAPTCHA } from "./captcha";

describe("ehErroDeCaptcha", () => {
  it("reconhece o código do Supabase Auth", () => {
    expect(ehErroDeCaptcha({ code: "captcha_failed", message: "x" })).toBe(true);
  });

  it("reconhece pela mensagem quando não vem código", () => {
    expect(ehErroDeCaptcha({ message: "captcha protection: request disallowed" })).toBe(true);
  });

  it("outro erro ou nenhum erro não é captcha", () => {
    expect(ehErroDeCaptcha({ code: "invalid_credentials", message: "Invalid login" })).toBe(false);
    expect(ehErroDeCaptcha(null)).toBe(false);
  });
});

describe("tokenCaptcha", () => {
  it("sem token vira undefined, pra não mandar captchaToken: null", () => {
    expect(tokenCaptcha(null)).toBeUndefined();
    expect(tokenCaptcha("abc")).toBe("abc");
  });
});

it("a mensagem segue as regras de marca (sem exclamação nem travessão)", () => {
  expect(MSG_CAPTCHA).not.toMatch(/[!—–]/);
});
