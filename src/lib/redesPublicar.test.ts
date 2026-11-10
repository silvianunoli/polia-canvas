import { describe, expect, it } from "vitest";
import {
  PRAZO_CONFIRMAR_MS,
  cabecalhoUploadTiktok,
  containersInstagram,
  corpoFotosTiktok,
  corpoVideoTiktok,
  erroGraphPassageiro,
  escolhasDoDestino,
  idPostDoTexto,
  leituraContainerIg,
  leituraInitTiktok,
  leituraStatusTiktok,
  motivoErroInstagram,
  problemasAntesDeEnviar,
  proximoPasso,
  statusDoPost,
  tokenMidiaValido,
  urlMidiaPublica,
  urlPostTiktok,
  type LinhaDestino,
  type LinhaMidia,
  type LinhaPost,
} from "../../supabase/functions/_shared/redesPublicar.ts";
import {
  ESCOLHAS_TIKTOK_INICIAIS,
  type InfoCriadorTiktok,
} from "../../supabase/functions/_shared/redesPosts.ts";

const AGORA = Date.parse("2026-11-10T12:00:00Z");
const POST = "11111111-1111-4111-8111-111111111111";

const destino = (extra: Partial<LinhaDestino> = {}): LinhaDestino => ({
  id: "d1",
  post_id: POST,
  user_id: "u1",
  rede: "tiktok",
  status: "publicando",
  tt_privacidade: "PUBLIC_TO_EVERYONE",
  tt_permite_comentario: true,
  tt_permite_dueto: false,
  tt_permite_stitch: false,
  tt_divulga_marca: false,
  tt_marca_propria: false,
  tt_conteudo_de_marca: false,
  conteudo_ia: false,
  consentiu_em: "2026-11-10T11:00:00Z",
  publicando_desde: "2026-11-10T11:59:00Z",
  envio_id: null,
  envio_iniciado_em: null,
  externo_id: null,
  ...extra,
});

const post: LinhaPost = { id: POST, user_id: "u1", tipo: "video", legenda: "Oi", titulo: null };
const video: LinhaMidia = {
  id: "m1",
  ordem: 0,
  tipo: "video",
  caminho: `u1/${POST}/00.mp4`,
  mime: "video/mp4",
  bytes: 10_000_000,
  largura: 1080,
  altura: 1920,
  duracao_s: "30.00",
};
const criador: InfoCriadorTiktok = {
  usuario: "polialab",
  nome: "Pólia",
  fotoUrl: null,
  privacidades: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"],
  comentarioDesligado: false,
  duetoDesligado: false,
  stitchDesligado: false,
  duracaoMaxS: 600,
};

describe("proximoPasso", () => {
  it("TikTok: envia, confere, e nunca reenvia pedido que saiu sem resposta", () => {
    expect(proximoPasso(destino(), AGORA)).toBe("enviar");
    expect(proximoPasso(destino({ envio_id: "p1" }), AGORA)).toBe("conferir");
    expect(proximoPasso(destino({ envio_iniciado_em: "2026-11-10T11:59:30Z" }), AGORA)).toBe(
      "incerto",
    );
  });

  it("Instagram: contêiner criado é conferido; pedido de publicar sem resposta é incerto", () => {
    const ig = (extra: Partial<LinhaDestino>) => destino({ rede: "instagram", ...extra });
    expect(proximoPasso(ig({}), AGORA)).toBe("enviar");
    expect(proximoPasso(ig({ envio_id: "c1" }), AGORA)).toBe("conferir");
    expect(
      proximoPasso(ig({ envio_id: "c1", envio_iniciado_em: "2026-11-10T11:59:30Z" }), AGORA),
    ).toBe("incerto");
  });

  it("passou do prazo vira vencido; fora de publicando não faz nada", () => {
    const velho = new Date(AGORA - PRAZO_CONFIRMAR_MS - 1000).toISOString();
    expect(proximoPasso(destino({ publicando_desde: velho, envio_id: "p1" }), AGORA)).toBe(
      "vencido",
    );
    expect(proximoPasso(destino({ status: "publicado" }), AGORA)).toBe("nada");
  });
});

describe("problemasAntesDeEnviar", () => {
  it("passa com as escolhas gravadas e a conta como está", () => {
    expect(problemasAntesDeEnviar(post, [video], destino(), criador, AGORA)).toEqual([]);
  });

  it("barra quando a conta mudou depois do agendamento", () => {
    const fechou = { ...criador, comentarioDesligado: true, privacidades: ["SELF_ONLY" as const] };
    const erros = problemasAntesDeEnviar(post, [video], destino(), fechou, AGORA);
    expect(erros).toContain("A conta desligou os comentários no TikTok.");
    expect(erros).toContain("Essa opção de privacidade não está disponível pra conta agora.");
  });

  it("Instagram não olha o TikTok, nem o título das fotos dele", () => {
    const ig = destino({ rede: "instagram", tt_privacidade: null });
    const comTitulo = { ...post, titulo: "Título do TikTok" };
    expect(problemasAntesDeEnviar(comTitulo, [video], ig, null, AGORA)).toEqual([]);
  });

  it("sem consentimento gravado não sai", () => {
    expect(
      problemasAntesDeEnviar(post, [video], destino({ consentiu_em: null }), criador, AGORA),
    ).toContain("Confirma as escolhas antes de agendar.");
  });
});

describe("statusDoPost", () => {
  it("resume os destinos", () => {
    expect(statusDoPost([{ status: "publicado" }, { status: "publicando" }])).toBe("publicando");
    expect(statusDoPost([{ status: "publicado" }, { status: "publicado" }])).toBe("publicado");
    expect(statusDoPost([{ status: "publicado" }, { status: "erro" }])).toBe("parcial");
    expect(statusDoPost([{ status: "erro" }, { status: "cancelado" }])).toBe("erro");
    expect(statusDoPost([{ status: "cancelado" }])).toBe("cancelado");
  });
});

describe("TikTok", () => {
  const e = escolhasDoDestino(
    destino({ tt_divulga_marca: true, tt_marca_propria: true, conteudo_ia: true }),
  );

  it("vídeo: interações viram disable_*, marca vira os toggles, um pedaço só", () => {
    const c = corpoVideoTiktok("Legenda", e, 10_000_000);
    expect(c.post_info).toMatchObject({
      title: "Legenda",
      privacy_level: "PUBLIC_TO_EVERYONE",
      disable_comment: false,
      disable_duet: true,
      disable_stitch: true,
      brand_organic_toggle: true,
      brand_content_toggle: false,
      is_aigc: true,
    });
    expect(c.source_info).toEqual({
      source: "FILE_UPLOAD",
      video_size: 10_000_000,
      chunk_size: 10_000_000,
      total_chunk_count: 1,
    });
    expect(cabecalhoUploadTiktok("video/mp4", 100)["content-range"]).toBe("bytes 0-99/100");
    expect(() => corpoVideoTiktok("x", ESCOLHAS_TIKTOK_INICIAIS, 10)).toThrow();
  });

  it("fotos: título opcional, legenda na descrição, sem música automática", () => {
    const c = corpoFotosTiktok(null, "Legenda", e, ["https://a/1", "https://a/2"]);
    expect(c.post_info).not.toHaveProperty("title");
    expect(c).toMatchObject({
      media_type: "PHOTO",
      post_mode: "DIRECT_POST",
      is_aigc: true,
      post_info: { description: "Legenda", auto_add_music: false },
      source_info: { source: "PULL_FROM_URL", photo_cover_index: 0 },
    });
    expect(corpoFotosTiktok("Oi", "", e, ["https://a/1"]).post_info).toHaveProperty("title", "Oi");
  });

  it("init: publish_id, recusa com motivo, ou tentar depois", () => {
    expect(
      leituraInitTiktok({
        data: { publish_id: "v_1", upload_url: "https://up" },
        error: { code: "ok" },
      }),
    ).toEqual({ tipo: "ok", publishId: "v_1", uploadUrl: "https://up" });
    const recusa = leituraInitTiktok({ error: { code: "spam_risk_too_many_posts" } });
    expect(recusa.tipo === "erro" && recusa.motivo).toContain("limite de posts");
    expect(leituraInitTiktok({ error: { code: "rate_limit_exceeded" } }).tipo).toBe("passageiro");
    expect(leituraInitTiktok(null).tipo).toBe("passageiro");
  });

  it("status: id do post sem perder dígito, falha com motivo, processando espera", () => {
    const texto =
      '{"data":{"status":"PUBLISH_COMPLETE","publicaly_available_post_id":[7312345678901234567]},"error":{"code":"ok"}}';
    const r = leituraStatusTiktok(JSON.parse(texto), texto);
    expect(r).toEqual({ fase: "publicado", postId: "7312345678901234567" });
    expect(idPostDoTexto('{"publicaly_available_post_id":[]}')).toBeNull();
    const falhou = leituraStatusTiktok(
      { data: { status: "FAILED", fail_reason: "photo_pull_failed" } },
      "",
    );
    expect(falhou).toEqual({ fase: "erro", motivo: "O TikTok não conseguiu baixar as fotos." });
    expect(leituraStatusTiktok({ data: { status: "PROCESSING_UPLOAD" } }, "").fase).toBe(
      "esperando",
    );
  });

  it("link do post só com @ e id seguros", () => {
    expect(urlPostTiktok("polialab", "123", "video")).toBe(
      "https://www.tiktok.com/@polialab/video/123",
    );
    expect(urlPostTiktok("polialab", "123", "fotos")).toBe(
      "https://www.tiktok.com/@polialab/photo/123",
    );
    expect(urlPostTiktok("a/b", "123", "video")).toBeNull();
    expect(urlPostTiktok("polialab", null, "video")).toBeNull();
  });

  it("token da foto: 64 hex; link sem barra dobrada", () => {
    expect(tokenMidiaValido("a".repeat(64))).toBe(true);
    expect(tokenMidiaValido("../x")).toBe(false);
    expect(urlMidiaPublica("https://one.usepolia.com.br/api/redes/midia/", "ab")).toBe(
      "https://one.usepolia.com.br/api/redes/midia/ab",
    );
  });
});

describe("Instagram", () => {
  it("monta foto, carrossel e Reels", () => {
    expect(containersInstagram("fotos", "L", ["https://1"])).toEqual({
      itens: [],
      principal: { image_url: "https://1", caption: "L" },
    });
    const carrossel = containersInstagram("fotos", "L", ["https://1", "https://2"]);
    expect(carrossel.itens).toEqual([
      { image_url: "https://1", is_carousel_item: "true" },
      { image_url: "https://2", is_carousel_item: "true" },
    ]);
    expect(carrossel.principal).toEqual({ media_type: "CAROUSEL", caption: "L" });
    expect(containersInstagram("video", "L", ["https://v"]).principal).toMatchObject({
      media_type: "REELS",
      video_url: "https://v",
    });
  });

  it("lê o contêiner e os erros da Graph", () => {
    expect(leituraContainerIg("FINISHED")).toBe("pronto");
    expect(leituraContainerIg("IN_PROGRESS")).toBe("esperando");
    expect(leituraContainerIg("EXPIRED")).toBe("erro");
    expect(leituraContainerIg("PUBLISHED")).toBe("ja_publicado");
    expect(erroGraphPassageiro({ code: 4 })).toBe(true);
    expect(erroGraphPassageiro({ code: 100 })).toBe(false);
    expect(motivoErroInstagram({ code: 190 })).toContain("Conecta de novo");
  });
});
