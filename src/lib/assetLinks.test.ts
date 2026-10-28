import { describe, expect, it } from "vitest";

import { corpoAssetLinks, IMPRESSOES_DIGITAIS_DO_APP, PACOTE_DO_APP } from "./assetLinks";

describe("assetlinks.json (AND-09)", () => {
  it("declara o pacote do app e as impressões digitais no formato do Android", () => {
    const corpo = JSON.parse(corpoAssetLinks());
    expect(corpo).toHaveLength(1);
    expect(corpo[0].relation).toEqual(["delegate_permission/common.handle_all_urls"]);
    expect(corpo[0].target).toEqual({
      namespace: "android_app",
      package_name: PACOTE_DO_APP,
      sha256_cert_fingerprints: IMPRESSOES_DIGITAIS_DO_APP,
    });
  });

  it("cada impressão digital é SHA-256 em hexadecimal com dois-pontos", () => {
    for (const f of IMPRESSOES_DIGITAIS_DO_APP) {
      expect(f).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    }
  });
});
