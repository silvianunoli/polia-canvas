// Loja da marca (white label, lojas_marca): o que a dona edita na Pólia One sem
// pedir pra ninguém (Sil, 22/11/2026): título dos carrosséis, banners e capa das
// coleções. Puro: a tela e o banco usam as mesmas regras, e a função
// loja_marca_salvar_vitrine confere tudo de novo no servidor.

export const MAX_BANNERS_LOJA_MARCA = 5;
export const MAX_TITULO = 60;
export const MAX_ALT = 160;

/** Blocos da página inicial que têm título, com o padrão que a loja usa quando fica vazio. */
export const TITULOS_DA_LOJA = [
  { bloco: "produtos", nome: "Primeiro carrossel", padrao: "Mais vendidos" },
  { bloco: "atalhos", nome: "Cartões das coleções", padrao: "Explore por coleção" },
  { bloco: "destaques", nome: "Segundo carrossel", padrao: "Destaques" },
  { bloco: "rotina", nome: "Carrossel com botões de categoria", padrao: "Complete seu pedido" },
  { bloco: "universos", nome: "Coleções em cartão alto", padrao: "Coleções" },
  { bloco: "depoimentos", nome: "Depoimentos", padrao: "Depoimentos" },
  { bloco: "instagram", nome: "Posts do Instagram", padrao: "No Instagram" },
] as const;

export type BlocoComTitulo = (typeof TITULOS_DA_LOJA)[number]["bloco"];

export interface TituloDoBloco {
  titulo: string;
  acima: string;
}

export interface BannerDaLoja {
  imagemPath: string;
  celularPath: string | null;
  link: string;
  alt: string;
}

/** Só os blocos que a loja mostra hoje, na ordem dela. */
export function titulosVisiveis(blocos: unknown): Array<(typeof TITULOS_DA_LOJA)[number]> {
  const lista = Array.isArray(blocos)
    ? blocos.filter((b): b is string => typeof b === "string")
    : [];
  if (!lista.length) return TITULOS_DA_LOJA.slice(0, 4);
  return lista.flatMap((b) => TITULOS_DA_LOJA.filter((t) => t.bloco === b));
}

const texto = (v: unknown) => (typeof v === "string" ? v : "");

/** Lê os títulos gravados; o que faltar volta vazio (vazio = padrão da loja). */
export function lerTitulos(rotulos: unknown): Record<BlocoComTitulo, TituloDoBloco> {
  const r = rotulos && typeof rotulos === "object" ? (rotulos as Record<string, unknown>) : {};
  return Object.fromEntries(
    TITULOS_DA_LOJA.map(({ bloco }) => {
      const um =
        r[bloco] && typeof r[bloco] === "object" ? (r[bloco] as Record<string, unknown>) : {};
      return [bloco, { titulo: texto(um.titulo), acima: texto(um.acima) }];
    }),
  ) as Record<BlocoComTitulo, TituloDoBloco>;
}

export function lerBanners(banners: unknown): BannerDaLoja[] {
  if (!Array.isArray(banners)) return [];
  return banners.flatMap((b) => {
    if (!b || typeof b !== "object") return [];
    const o = b as Record<string, unknown>;
    const imagemPath = texto(o.imagem_path).trim();
    if (!imagemPath) return [];
    return [
      {
        imagemPath,
        celularPath: texto(o.imagem_celular_path).trim() || null,
        link: texto(o.link),
        alt: texto(o.alt),
      },
    ];
  });
}

/** Mesma regra da loja: caminho interno (/produtos) ou endereço https. Vazio pode. */
export function problemaDoLink(link: string): string | null {
  const v = link.trim();
  if (!v) return null;
  if (v.length > 300) return "O link passa de 300 caracteres.";
  if (/^\/(?!\/)/.test(v) || /^https:\/\//.test(v)) return null;
  return "Use um caminho da loja, como /produtos, ou um endereço que comece com https://";
}

/** O motivo que impede salvar, ou null. */
export function problemaParaSalvar(
  titulos: Record<string, TituloDoBloco>,
  banners: BannerDaLoja[],
): string | null {
  for (const t of Object.values(titulos)) {
    if (t.titulo.trim().length > MAX_TITULO || t.acima.trim().length > MAX_TITULO)
      return `Cada título vai até ${MAX_TITULO} caracteres.`;
  }
  if (banners.length > MAX_BANNERS_LOJA_MARCA)
    return `A loja leva até ${MAX_BANNERS_LOJA_MARCA} banners.`;
  for (const [i, b] of banners.entries()) {
    const p = problemaDoLink(b.link);
    if (p) return `Banner ${i + 1}: ${p}`;
    if (b.alt.trim().length > MAX_ALT)
      return `Banner ${i + 1}: a descrição vai até ${MAX_ALT} caracteres.`;
  }
  return null;
}

/** O corpo da função loja_marca_salvar_vitrine. */
export function corpoDaVitrine(titulos: Record<string, TituloDoBloco>, banners: BannerDaLoja[]) {
  return {
    p_rotulos: Object.fromEntries(
      Object.entries(titulos).map(([k, t]) => [
        k,
        { titulo: t.titulo.trim(), acima: t.acima.trim() },
      ]),
    ),
    p_banners: banners.map((b) => ({
      imagem_path: b.imagemPath,
      imagem_celular_path: b.celularPath,
      link: b.link.trim() || null,
      alt: b.alt.trim(),
    })),
  };
}

/** Arquivos que saíram da loja depois de salvar: podem ser apagados do Storage. */
export function arquivosQueSairam(antes: BannerDaLoja[], depois: BannerDaLoja[]): string[] {
  const ficam = new Set(depois.flatMap((b) => [b.imagemPath, b.celularPath ?? ""]));
  return antes
    .flatMap((b) => [b.imagemPath, b.celularPath ?? ""])
    .filter((p) => p && !ficam.has(p));
}
