import { describe, expect, it } from "vitest";
import { sugerirEmail } from "./sugestaoEmail";

describe("sugerirEmail", () => {
  it.each([
    ["fulana@gmial.com", "fulana@gmail.com"],
    ["fulana@gmai.com", "fulana@gmail.com"],
    ["fulana@gmail.co", "fulana@gmail.com"],
    ["fulana@gmail.con", "fulana@gmail.com"],
    ["fulana@gmail.cm", "fulana@gmail.com"],
    ["fulana@gamil.com", "fulana@gmail.com"],
    ["fulana@gmial.con", "fulana@gmail.com"],
    ["fulana@hotmal.com", "fulana@hotmail.com"],
    ["fulana@hotmial.com", "fulana@hotmail.com"],
    ["fulana@hotmail.co", "fulana@hotmail.com"],
    ["fulana@hotmai.con", "fulana@hotmail.com"],
    ["fulana@outlok.com", "fulana@outlook.com"],
    ["fulana@yaho.com.br", "fulana@yahoo.com.br"],
    ["fulana@yahoo.com.b", "fulana@yahoo.com.br"],
    ["fulana@yaho.com", "fulana@yahoo.com"],
    ["fulana@icloud.co", "fulana@icloud.com"],
    ["fulana@iclod.com", "fulana@icloud.com"],
    ["fulana@uool.com.br", "fulana@uol.com.br"],
    ["fulana@bol.com.b", "fulana@bol.com.br"],
    ["fulana@tera.com.br", "fulana@terra.com.br"],
    ["fulana@live.con", "fulana@live.com"],
  ])("%s vira %s", (digitado, esperado) => {
    expect(sugerirEmail(digitado)).toBe(esperado);
  });

  it.each([
    "fulana@gmail.com",
    "fulana@hotmail.com",
    "fulana@outlook.com",
    "fulana@yahoo.com.br",
    "fulana@yahoo.com",
    "fulana@icloud.com",
    "fulana@live.com",
    "fulana@bol.com.br",
    "fulana@uol.com.br",
    "fulana@terra.com.br",
  ])("%s já está certo", (email) => {
    expect(sugerirEmail(email)).toBeNull();
  });

  it.each([
    "ana@docesdaana.com.br",
    "ana@empresa.com",
    "ana@usp.br",
    "ana@ymail.com",
    "ana@mail.com",
    "ana@pop.com.br",
    "ana@oi.com.br",
    "ana@hotmail.com.br",
    "ana@outlook.com.br",
    "ana@yahoo.com.ar",
    "ana@yahoo.ca",
  ])("%s não ganha sugestão (domínio próprio ou real)", (email) => {
    expect(sugerirEmail(email)).toBeNull();
  });

  it("não decide quando o erro lembra dois domínios", () => {
    expect(sugerirEmail("ana@ol.com.br")).toBeNull();
  });

  it("não mexe na parte antes do @ e aceita maiúscula no domínio", () => {
    expect(sugerirEmail("  Ana.Souza+loja@GMIAL.COM ")).toBe("Ana.Souza+loja@gmail.com");
    expect(sugerirEmail("Ana@GMAIL.COM")).toBeNull();
  });

  it("ignora o que ainda não é e-mail", () => {
    expect(sugerirEmail("")).toBeNull();
    expect(sugerirEmail("ana")).toBeNull();
    expect(sugerirEmail("@gmial.com")).toBeNull();
    expect(sugerirEmail("ana@")).toBeNull();
    expect(sugerirEmail("ana@gmial")).toBeNull();
  });
});
