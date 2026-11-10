import { describe, expect, it } from "vitest";
import {
  ESCOLHAS_TIKTOK_INICIAIS,
  fraseIncluiPoliticaDeMarca,
  infoCriadorDaResposta,
  normalizarEscolhas,
  podeCancelar,
  problemasDoPost,
  rotuloComercial,
  type ContextoPost,
  type EntradaPost,
  type InfoCriadorTiktok,
} from "../../supabase/functions/_shared/redesPosts.ts";

const AGORA = Date.parse("2026-11-10T12:00:00Z");
const USER = "u1";
const POST = "11111111-1111-4111-8111-111111111111";
const PASTA = `${USER}/${POST}/`;

const criador: InfoCriadorTiktok = {
  usuario: "polialab",
  nome: "Pólia",
  fotoUrl: null,
  privacidades: ["PUBLIC_TO_EVERYONE", "FOLLOWER_OF_CREATOR", "SELF_ONLY"],
  comentarioDesligado: false,
  duetoDesligado: true,
  stitchDesligado: false,
  duracaoMaxS: 60,
};

const ctx = (extra: Partial<ContextoPost> = {}): ContextoPost => ({
  userId: USER,
  agora: AGORA,
  conectadas: ["instagram", "tiktok"],
  criador,
  ...extra,
});

const foto = (ordem: number, extra: Partial<EntradaPost["midias"][number]> = {}) => ({
  ordem,
  tipo: "imagem" as const,
  caminho: `${PASTA}${String(ordem).padStart(2, "0")}.jpg`,
  mime: "image/jpeg",
  bytes: 300_000,
  largura: 1080,
  altura: 1350,
  duracaoS: null,
  ...extra,
});

const base = (extra: Partial<EntradaPost> = {}): EntradaPost => ({
  postId: POST,
  tipo: "fotos",
  legenda: "Legenda",
  titulo: null,
  midias: [foto(0), foto(1)],
  redes: ["instagram"],
  tiktok: null,
  quando: { modo: "agendar", em: "2026-11-10T15:00:00Z" },
  consentiu: true,
  ...extra,
});

const comTiktok = (extra: Partial<EntradaPost> = {}): EntradaPost =>
  base({
    redes: ["instagram", "tiktok"],
    tiktok: { ...ESCOLHAS_TIKTOK_INICIAIS, privacidade: "PUBLIC_TO_EVERYONE" },
    ...extra,
  });

describe("problemasDoPost", () => {
  it("carrossel no Instagram pronto passa", () => {
    expect(problemasDoPost(base(), ctx())).toEqual([]);
  });

  it("sem consentimento, sem rede ou rede desconectada não passa", () => {
    expect(problemasDoPost(base({ consentiu: false }), ctx())).toContain(
      "Confirma as escolhas antes de agendar.",
    );
    expect(problemasDoPost(base({ redes: [] }), ctx())).toContain("Escolhe onde o post sai.");
    expect(problemasDoPost(base(), ctx({ conectadas: [] }))).toContain(
      "O Instagram não está conectado.",
    );
  });

  it("arquivo fora da pasta do post é recusado", () => {
    const p = base({ midias: [foto(0, { caminho: `outra/${POST}/00.jpg` })] });
    expect(problemasDoPost(p, ctx())).toContain("Um dos arquivos não é deste post.");
    const q = base({ midias: [foto(0, { caminho: `${PASTA}../x.jpg` })] });
    expect(problemasDoPost(q, ctx())).toContain("Um dos arquivos não é deste post.");
  });

  it("Instagram: até 10 fotos, só JPEG, proporção entre 4:5 e 1,91:1", () => {
    const onze = base({ midias: Array.from({ length: 11 }, (_, i) => foto(i)) });
    expect(problemasDoPost(onze, ctx())).toContain("O Instagram aceita até 10 fotos por post.");
    const png = base({ midias: [foto(0, { mime: "image/png" })] });
    expect(problemasDoPost(png, ctx())).toContain("As fotos precisam estar em JPEG.");
    const story = base({ midias: [foto(0, { largura: 1080, altura: 1920 })] });
    expect(problemasDoPost(story, ctx())).toContain(
      "O Instagram aceita foto de 4:5 (em pé) até 1,91:1 (deitada).",
    );
    // No TikTok sozinho, 9:16 e 11 fotos servem.
    const so = base({
      redes: ["tiktok"],
      tiktok: { ...ESCOLHAS_TIKTOK_INICIAIS, privacidade: "SELF_ONLY" },
      midias: Array.from({ length: 11 }, (_, i) => foto(i, { altura: 1920 })),
    });
    expect(problemasDoPost(so, ctx())).toEqual([]);
  });

  it("TikTok: privacidade é obrigatória e precisa estar entre as da conta", () => {
    const sem = comTiktok({ tiktok: { ...ESCOLHAS_TIKTOK_INICIAIS } });
    expect(problemasDoPost(sem, ctx())).toContain("Escolhe quem pode ver o post no TikTok.");
    const fora = comTiktok({
      tiktok: { ...ESCOLHAS_TIKTOK_INICIAIS, privacidade: "MUTUAL_FOLLOW_FRIENDS" },
    });
    expect(problemasDoPost(fora, ctx())).toContain(
      "Essa opção de privacidade não está disponível pra conta agora.",
    );
    expect(problemasDoPost(comTiktok(), ctx({ criador: null }))).toContain(
      "A Pólia One não conseguiu ler a conta do TikTok agora. Tenta de novo.",
    );
  });

  it("TikTok: interação desligada na conta não pode ser ligada; foto não tem dueto", () => {
    const video = comTiktok({
      tipo: "video",
      redes: ["tiktok"],
      midias: [
        { ...foto(0), tipo: "video", caminho: `${PASTA}00.mp4`, mime: "video/mp4", duracaoS: 30 },
      ],
      tiktok: {
        ...ESCOLHAS_TIKTOK_INICIAIS,
        privacidade: "PUBLIC_TO_EVERYONE",
        permiteDueto: true,
      },
    });
    expect(problemasDoPost(video, ctx())).toContain("A conta desligou o dueto no TikTok.");
    const fotos = comTiktok({
      tiktok: {
        ...ESCOLHAS_TIKTOK_INICIAIS,
        privacidade: "PUBLIC_TO_EVERYONE",
        permiteStitch: true,
      },
    });
    expect(problemasDoPost(fotos, ctx())).toContain("Dueto e stitch só existem em vídeo.");
  });

  it("TikTok: divulgação exige uma opção, e conteúdo de marca não pode ser privado", () => {
    const vazia = comTiktok({
      tiktok: {
        ...ESCOLHAS_TIKTOK_INICIAIS,
        privacidade: "PUBLIC_TO_EVERYONE",
        divulgaMarca: true,
      },
    });
    expect(problemasDoPost(vazia, ctx())).toContain(
      "Marca se o post divulga a sua marca, a de outra pessoa ou as duas.",
    );
    const privada = comTiktok({
      tiktok: {
        ...ESCOLHAS_TIKTOK_INICIAIS,
        privacidade: "SELF_ONLY",
        divulgaMarca: true,
        conteudoDeMarca: true,
      },
    });
    expect(problemasDoPost(privada, ctx())).toContain(
      "Conteúdo de marca não pode ficar só pra você.",
    );
  });

  it("vídeo: um só, MP4 ou MOV, de 3 s até o teto da conta do TikTok", () => {
    const v = (duracaoS: number, mime = "video/mp4") =>
      comTiktok({
        tipo: "video",
        midias: [{ ...foto(0), tipo: "video", caminho: `${PASTA}00.mp4`, mime, duracaoS }],
      });
    expect(problemasDoPost(v(30), ctx())).toEqual([]);
    expect(problemasDoPost(v(2), ctx())).toContain("O vídeo precisa ter pelo menos 3 segundos.");
    expect(problemasDoPost(v(61), ctx())).toContain(
      "Essa conta do TikTok aceita vídeo de até 60 segundos.",
    );
    expect(problemasDoPost(v(30, "video/webm"), ctx())).toContain("Use vídeo em MP4 ou MOV.");
  });

  it("título só em fotos do TikTok, até 90 caracteres", () => {
    expect(problemasDoPost(base({ titulo: "Oi" }), ctx())).toContain(
      "O título só vale pra post de fotos no TikTok.",
    );
    expect(problemasDoPost(comTiktok({ titulo: "x".repeat(91) }), ctx())).toContain(
      "O título passa de 90 caracteres.",
    );
  });

  it("horário: pelo menos 5 minutos à frente e no máximo 60 dias", () => {
    const cedo = base({ quando: { modo: "agendar", em: "2026-11-10T12:02:00Z" } });
    expect(problemasDoPost(cedo, ctx())).toContain(
      "Escolhe um horário pelo menos 5 minutos à frente.",
    );
    const longe = base({ quando: { modo: "agendar", em: "2027-02-10T12:00:00Z" } });
    expect(problemasDoPost(longe, ctx())).toContain("Dá pra agendar até 60 dias à frente.");
    expect(problemasDoPost(base({ quando: { modo: "agora" } }), ctx())).toEqual([]);
    const ruim = base({ quando: { modo: "agendar", em: "ontem" } });
    expect(problemasDoPost(ruim, ctx())).toContain("Escolhe um dia e uma hora válidos.");
  });
});

describe("infoCriadorDaResposta", () => {
  it("lê a conta e mantém só as privacidades conhecidas", () => {
    const { info, motivo } = infoCriadorDaResposta({
      data: {
        creator_username: "polialab",
        creator_nickname: "Pólia",
        creator_avatar_url: "http://inseguro",
        privacy_level_options: ["PUBLIC_TO_EVERYONE", "OUTRA", "SELF_ONLY"],
        comment_disabled: false,
        duet_disabled: true,
        stitch_disabled: false,
        max_video_post_duration_sec: 300,
      },
      error: { code: "ok" },
    });
    expect(motivo).toBeNull();
    expect(info).toMatchObject({
      usuario: "polialab",
      fotoUrl: null,
      privacidades: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"],
      duetoDesligado: true,
      duracaoMaxS: 300,
    });
  });

  it("conta que não pode postar volta com o motivo", () => {
    const r = infoCriadorDaResposta({ error: { code: "spam_risk_too_many_posts" } });
    expect(r.info).toBeNull();
    expect(r.motivo).toContain("limite de posts do dia");
    expect(infoCriadorDaResposta(null).motivo).toBeTruthy();
    expect(infoCriadorDaResposta({ data: { privacy_level_options: [] } }).info).toBeNull();
  });
});

describe("escolhas do TikTok", () => {
  it("começam todas desligadas e sem privacidade", () => {
    expect(Object.values(ESCOLHAS_TIKTOK_INICIAIS).every((v) => v === false || v === null)).toBe(
      true,
    );
  });

  it("normalizar tira dueto e stitch de fotos e as caixas sem divulgação", () => {
    const e = normalizarEscolhas(
      { ...ESCOLHAS_TIKTOK_INICIAIS, permiteDueto: true, permiteStitch: true, marcaPropria: true },
      "fotos",
    );
    expect(e).toMatchObject({ permiteDueto: false, permiteStitch: false, marcaPropria: false });
  });

  it("rótulo e frase seguem a divulgação", () => {
    const sua = { ...ESCOLHAS_TIKTOK_INICIAIS, divulgaMarca: true, marcaPropria: true };
    const parceria = { ...sua, conteudoDeMarca: true };
    expect(rotuloComercial(ESCOLHAS_TIKTOK_INICIAIS)).toBeNull();
    expect(rotuloComercial(sua)).toBe("Conteúdo promocional");
    expect(rotuloComercial(parceria)).toBe("Parceria paga");
    expect(fraseIncluiPoliticaDeMarca(sua)).toBe(false);
    expect(fraseIncluiPoliticaDeMarca(parceria)).toBe(true);
  });
});

describe("podeCancelar", () => {
  it("só enquanto nenhuma rede começou", () => {
    expect(podeCancelar("agendado", [{ status: "pendente" }])).toBe(true);
    expect(podeCancelar("agendado", [{ status: "pendente" }, { status: "publicando" }])).toBe(
      false,
    );
    expect(podeCancelar("publicado", [{ status: "publicado" }])).toBe(false);
  });
});
