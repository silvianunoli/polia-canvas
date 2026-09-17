import { describe, expect, it } from "vitest";
import { bucketDaUsuaria, bucketDoHash, decidirFlag } from "./flags-regra";

const base = { rollout_pct: 100, beta_user_ids: [] as string[] };

describe("decidirFlag", () => {
  it("usa o padrão quando a flag não existe", () => {
    expect(decidirFlag(null, "u1", 10, true)).toBe(true);
    expect(decidirFlag(null, "u1", 10, false)).toBe(false);
  });

  it("off desliga pra todo mundo, on com 100% liga pra todo mundo", () => {
    expect(decidirFlag({ ...base, estado: "off" }, "u1", 0, true)).toBe(false);
    expect(decidirFlag({ ...base, estado: "on" }, null, null, false)).toBe(true);
  });

  it("rollout parcial respeita o bucket e exige usuária identificada", () => {
    const flag = { ...base, estado: "on" as const, rollout_pct: 25 };
    expect(decidirFlag(flag, "u1", 10, false)).toBe(true);
    expect(decidirFlag(flag, "u1", 25, false)).toBe(false);
    expect(decidirFlag(flag, "u1", 90, false)).toBe(false);
    expect(decidirFlag(flag, null, null, true)).toBe(false);
  });

  it("beta liga pra lista explícita e pro rollout, nunca pra anônima", () => {
    const flag = { estado: "beta" as const, rollout_pct: 0, beta_user_ids: ["vip"] };
    expect(decidirFlag(flag, "vip", 99, false)).toBe(true);
    expect(decidirFlag(flag, "outra", 0, false)).toBe(false);
    expect(decidirFlag({ ...flag, rollout_pct: 50 }, "outra", 10, false)).toBe(true);
    expect(decidirFlag(flag, null, null, true)).toBe(false);
  });
});

describe("bucket", () => {
  it("é determinístico e fica entre 0 e 99", async () => {
    const a = await bucketDaUsuaria("3f2a1b4c-1111-2222-3333-444455556666", "dashboard_v2");
    const b = await bucketDaUsuaria("3f2a1b4c-1111-2222-3333-444455556666", "dashboard_v2");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(100);
    expect(bucketDoHash("ffffffff")).toBe(0xffffffff % 100);
  });
});
