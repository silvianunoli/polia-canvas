import { describe, expect, it } from "vitest";
import { lerLinkComErro } from "./linkComErro";

const VENCIDO =
  "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";

describe("lerLinkComErro", () => {
  it("magiclink vencido no /painel vira link-vencido", () => {
    expect(lerLinkComErro("/painel", VENCIDO, "")).toBe("link-vencido");
  });
  it("vale em qualquer rota que não trata o próprio link", () => {
    expect(lerLinkComErro("/onboarding", VENCIDO, "")).toBe("link-vencido");
    expect(lerLinkComErro("/", VENCIDO, "")).toBe("link-vencido");
  });
  it("otp_expired na query também conta", () => {
    expect(lerLinkComErro("/painel", "", "?error=access_denied&error_code=otp_expired")).toBe(
      "link-vencido",
    );
  });
  it("access_denied sem otp_expired é a desistência no Google", () => {
    expect(lerLinkComErro("/painel", "", "?error=access_denied&error_description=x")).toBe(
      "entrada-cancelada",
    );
    expect(lerLinkComErro("/painel", "#error=access_denied", "")).toBe("entrada-cancelada");
  });
  it("criar-senha, redefinir-senha e a própria tela de link expirado tratam sozinhas", () => {
    expect(lerLinkComErro("/auth/criar-senha", VENCIDO, "")).toBeNull();
    expect(lerLinkComErro("/auth/redefinir-senha", VENCIDO, "")).toBeNull();
    expect(lerLinkComErro("/auth/link-expirado", VENCIDO, "")).toBeNull();
  });
  it("URL sem erro não é nada", () => {
    expect(lerLinkComErro("/painel", "", "")).toBeNull();
    expect(lerLinkComErro("/painel", "#main-content", "?tipo=servico")).toBeNull();
    // O erro escondido dentro do ?next= (já codificado) não é erro desta URL.
    expect(lerLinkComErro("/auth/login", "", "?next=%2Fpainel%23error%3Daccess_denied")).toBeNull();
  });
});
