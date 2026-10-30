import { describe, expect, it } from "vitest";
import { caminhoNoBucket } from "./useFotosDoProduto";

const U = "11111111-2222-3333-4444-555555555555";
const base = "https://egzwkyqpkexgrhbxwcvb.supabase.co/storage/v1/object/public/produtos-fotos/";

describe("caminhoNoBucket", () => {
  it("acha o caminho da foto da própria dona", () => {
    expect(caminhoNoBucket(`${base}${U}/foto-1.jpg`, U)).toBe(`${U}/foto-1.jpg`);
  });
  it("ignora link de fora do bucket", () => {
    expect(caminhoNoBucket("https://lovelesscrochet.com.br/img/amy-1.webp", U)).toBeNull();
  });
  it("ignora foto de outra dona", () => {
    expect(caminhoNoBucket(`${base}outra/foto-1.jpg`, U)).toBeNull();
  });
  it("aceita vazio", () => {
    expect(caminhoNoBucket(null, U)).toBeNull();
  });
});
