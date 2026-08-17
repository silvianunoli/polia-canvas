// Gera as imagens derivadas do SEO (handoff 7). Roda à mão, não entra na build:
//
//   node scripts/gerar-imagens-seo.mjs
//
// Usa o sharp que já vem instalado como dependência do @cloudflare/vite-plugin
// (via miniflare), de propósito: não entra no package.json nem no bundle do
// Worker. Se um dia o sharp sumir do node_modules, este script para de rodar e
// nada do site quebra, porque a saída dele é commitada em public/marketing/.
import { createRequire } from "node:module";
import { mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MARKETING = resolve(RAIZ, "public/marketing");

function kb(bytes) {
  return `${(bytes / 1024).toFixed(0)}KB`;
}

async function tamanho(caminho) {
  try {
    return (await stat(caminho)).size;
  } catch {
    return 0;
  }
}

/**
 * Imagem de compartilhamento (og:image), 1200x630.
 *
 * A origem é fechamento.jpg (2544x1456, proporção 1,747 contra 1,905 do alvo),
 * então precisa de recorte de verdade: 121px de altura saem, distribuídos pra
 * manter a figura e o triângulo amarelo inteiros e centrados. Nada de logo,
 * wordmark ou texto por cima: aplicação de logo não entra neste handoff.
 */
async function gerarOgImage() {
  const origem = resolve(MARKETING, "fechamento.jpg");
  const destino = resolve(MARKETING, "og-compartilhamento.jpg");

  const antes = await tamanho(origem);
  await sharp(origem)
    // Conteúdo (figura + triângulo) mora entre y=89 e y=1270 do original.
    // Recorte de 20 a 1355 mantém os dois inteiros, com margem em cima e
    // embaixo, e chega na proporção do alvo sem distorcer.
    .extract({ left: 0, top: 20, width: 2544, height: 1335 })
    .resize(1200, 630, { fit: "cover" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(destino);

  const depois = await tamanho(destino);
  console.log(`og:image  fechamento.jpg ${kb(antes)} -> og-compartilhamento.jpg ${kb(depois)}`);
  if (depois > 300 * 1024) {
    throw new Error(`og:image passou de 300KB (${kb(depois)})`);
  }
}

/**
 * Versões WebP das duas fotos pesadas que estão em uso na /sobre, em dois
 * tamanhos. O arquivo original continua no repositório como fallback do <img>
 * dentro do <picture>.
 */
const PARA_WEBP = [
  { arquivo: "sobre-hero.png", base: "sobre-hero" },
  { arquivo: "sobre-manifesto.jpg", base: "sobre-manifesto" },
];
const LARGURAS = [1024, 640];

async function gerarWebp() {
  for (const { arquivo, base } of PARA_WEBP) {
    const origem = resolve(MARKETING, arquivo);
    const antes = await tamanho(origem);

    for (const largura of LARGURAS) {
      const destino = resolve(MARKETING, `${base}-${largura}.webp`);
      await sharp(origem)
        .resize({ width: largura, withoutEnlargement: true })
        .webp({ quality: 78, effort: 6 })
        .toFile(destino);

      const depois = await tamanho(destino);
      console.log(`webp      ${arquivo} ${kb(antes)} -> ${base}-${largura}.webp ${kb(depois)}`);
      if (largura === 1024 && depois > 150 * 1024) {
        throw new Error(`${base}-1024.webp passou de 150KB (${kb(depois)})`);
      }
    }
  }
}

await mkdir(MARKETING, { recursive: true });
await gerarOgImage();
await gerarWebp();
