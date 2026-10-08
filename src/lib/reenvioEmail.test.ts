import { describe, expect, it } from "vitest";
import {
  ESPERAS_MINUTOS,
  MAX_TENTATIVAS,
  proximaTentativaEm,
} from "../../supabase/functions/_shared/reenvioEmail";

// PAY-27: intervalos da fila de reenvio dos e-mails do Stripe.
describe("proximaTentativaEm", () => {
  const agora = new Date("2026-10-08T12:00:00Z");

  it("a primeira falha tenta de novo em 5 minutos", () => {
    expect(proximaTentativaEm(1, agora)?.toISOString()).toBe("2026-10-08T12:05:00.000Z");
  });

  it("as esperas crescem a cada falha", () => {
    const minutos = ESPERAS_MINUTOS.map(
      (_, i) => ((proximaTentativaEm(i + 1, agora)?.getTime() ?? 0) - agora.getTime()) / 60_000,
    );
    expect(minutos).toEqual(ESPERAS_MINUTOS);
    for (let i = 1; i < minutos.length; i++) expect(minutos[i]).toBeGreaterThan(minutos[i - 1]);
  });

  it("depois do limite, desiste (null)", () => {
    expect(proximaTentativaEm(MAX_TENTATIVAS + 1, agora)).toBeNull();
  });

  it("número inválido não agenda nada", () => {
    expect(proximaTentativaEm(0, agora)).toBeNull();
    expect(proximaTentativaEm(1.5, agora)).toBeNull();
  });
});
