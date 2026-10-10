import { afterEach, describe, expect, it, vi } from "vitest";
import { enviarEventosMeta, fbcDoFbclid, montarUserData, sha256 } from "./metaCapi.server";

const EVENTO = {
  event_name: "CompleteRegistration",
  event_time: 1_790_000_000,
  event_id: "cadastro_abc",
  action_source: "website" as const,
  user_data: {},
};

afterEach(() => {
  delete process.env.META_CAPI_TOKEN;
  delete process.env.META_CAPI_TEST_CODE;
  vi.restoreAllMocks();
});

describe("sha256", () => {
  it("normaliza (trim + minúsculas) antes do hash, como o Meta pede", async () => {
    expect(await sha256("  Ana@Exemplo.com ")).toBe(await sha256("ana@exemplo.com"));
    expect(await sha256("br")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("fbcDoFbclid", () => {
  it("monta fb.1.<ms>.<fbclid>", () => {
    expect(fbcDoFbclid("IwAR3abcDEF_123-xyz", 1700000000000)).toBe(
      "fb.1.1700000000000.IwAR3abcDEF_123-xyz",
    );
  });
  it("descarta vazio ou com caractere estranho", () => {
    expect(fbcDoFbclid(undefined, 1)).toBeNull();
    expect(fbcDoFbclid("curto", 1)).toBeNull();
    expect(fbcDoFbclid("abc<script>defghij", 1)).toBeNull();
  });
});

describe("montarUserData", () => {
  it("e-mail e id só em hash; IP e navegador crus; país sempre", async () => {
    const d = await montarUserData({
      email: "ana@exemplo.com",
      userId: "u1",
      ip: "200.1.2.3",
      userAgent: "Mozilla",
      fbp: "fb.1.1700000000000.123456",
      fbc: "fb.1.1700000000000.IwAR3abc",
    });
    expect(d.em).toEqual([await sha256("ana@exemplo.com")]);
    expect(d.external_id).toEqual([await sha256("u1")]);
    expect(JSON.stringify(d)).not.toContain("ana@exemplo.com");
    expect(d.client_ip_address).toBe("200.1.2.3");
    expect(d.client_user_agent).toBe("Mozilla");
    expect(d.fbp).toBe("fb.1.1700000000000.123456");
    expect(d.fbc).toBe("fb.1.1700000000000.IwAR3abc");
    expect(d.country).toEqual([await sha256("br")]);
  });
  it("ignora _fbp fora do formato", async () => {
    const d = await montarUserData({ fbp: "qualquer-coisa" });
    expect(d.fbp).toBeUndefined();
  });
});

describe("enviarEventosMeta", () => {
  it("sem token não chama o Meta e não quebra", async () => {
    const f = vi.fn();
    expect(await enviarEventosMeta([EVENTO], f as unknown as typeof fetch)).toEqual({
      enviado: false,
      motivo: "sem_token",
    });
    expect(f).not.toHaveBeenCalled();
  });

  it("com token manda pro pixel, com test_event_code quando configurado", async () => {
    process.env.META_CAPI_TOKEN = "tok";
    process.env.META_CAPI_TEST_CODE = "TEST123";
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await enviarEventosMeta([EVENTO], f as unknown as typeof fetch)).toEqual({
      enviado: true,
    });
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toMatch(/graph\.facebook\.com\/v\d+\.\d+\/\d+\/events\?access_token=tok$/);
    const corpo = JSON.parse((init as RequestInit).body as string);
    expect(corpo.data[0].event_id).toBe("cadastro_abc");
    expect(corpo.test_event_code).toBe("TEST123");
  });

  it("recusa do Meta ou falha de rede vira { enviado: false }, sem jogar", async () => {
    process.env.META_CAPI_TOKEN = "tok";
    vi.spyOn(console, "error").mockImplementation(() => {});
    const recusa = vi.fn().mockResolvedValue(new Response("{}", { status: 400 }));
    expect((await enviarEventosMeta([EVENTO], recusa as unknown as typeof fetch)).enviado).toBe(
      false,
    );
    const rede = vi.fn().mockRejectedValue(new Error("offline"));
    expect((await enviarEventosMeta([EVENTO], rede as unknown as typeof fetch)).motivo).toBe(
      "rede",
    );
  });
});
