import { supabase } from "@/integrations/supabase/client";
import {
  FOTO_LADO_MAIOR_MAX,
  FOTO_LADO_MAX,
  MIMES_VIDEO,
  VIDEO_MAX_BYTES,
  pastaDoPost,
  type MidiaPost,
} from "../../../supabase/functions/_shared/redesPosts.ts";

// Arquivos do post da Agenda das redes (ONE-155), no navegador: prepara, mostra a
// prévia e sobe direto pro bucket privado redes-midias, na pasta do post. O
// servidor confere tudo de novo ao agendar.
//
// Foto vira JPEG com o lado menor até 1080 e o maior até 1920 já aqui: o
// Instagram só aceita JPEG, o TikTok recusa foto maior (picture_size_check_failed,
// medido na Fábrica em 24/09/2026) e o publicador roda sem canvas pra converter.
// Fundo branco por baixo, senão a parte transparente de um PNG sai preta.

const BUCKET = "redes-midias";

export type Peca = {
  chave: string;
  arquivo: File;
  previa: string;
  tipo: "video" | "imagem";
  largura: number | null;
  altura: number | null;
  duracaoS: number | null;
};

async function fotoEmJpeg(
  arquivo: File,
): Promise<{ arquivo: File; largura: number; altura: number }> {
  const bitmap = await createImageBitmap(arquivo);
  try {
    const menor = Math.min(bitmap.width, bitmap.height);
    const maior = Math.max(bitmap.width, bitmap.height);
    const escala = Math.min(1, FOTO_LADO_MAX / menor, FOTO_LADO_MAIOR_MAX / maior);
    const largura = Math.round(bitmap.width * escala);
    const altura = Math.round(bitmap.height * escala);
    if (arquivo.type === "image/jpeg" && escala === 1) return { arquivo, largura, altura };

    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("sem canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    if (!blob) throw new Error("sem jpeg");
    const nome = arquivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    return { arquivo: new File([blob], nome, { type: "image/jpeg" }), largura, altura };
  } finally {
    bitmap.close();
  }
}

function dadosDoVideo(url: string): Promise<{ duracaoS: number; largura: number; altura: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () =>
      resolve({ duracaoS: v.duration, largura: v.videoWidth, altura: v.videoHeight });
    v.onerror = () => reject(new Error("vídeo ilegível"));
    v.src = url;
  });
}

/** Prepara um arquivo escolhido. Devolve o erro em frase pronta quando não serve. */
export async function prepararPeca(
  arquivo: File,
): Promise<{ peca: Peca | null; erro: string | null }> {
  const chave = crypto.randomUUID();
  if (arquivo.type.startsWith("image/")) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(arquivo.type))
      return { peca: null, erro: "Use foto em JPG, PNG ou WEBP." };
    try {
      const f = await fotoEmJpeg(arquivo);
      return {
        peca: {
          chave,
          arquivo: f.arquivo,
          previa: URL.createObjectURL(f.arquivo),
          tipo: "imagem",
          largura: f.largura,
          altura: f.altura,
          duracaoS: null,
        },
        erro: null,
      };
    } catch {
      return { peca: null, erro: `A Pólia One não conseguiu abrir a foto ${arquivo.name}.` };
    }
  }
  if (arquivo.type.startsWith("video/")) {
    if (!(MIMES_VIDEO as readonly string[]).includes(arquivo.type))
      return { peca: null, erro: "Use vídeo em MP4 ou MOV." };
    if (arquivo.size > VIDEO_MAX_BYTES) return { peca: null, erro: "O vídeo passa de 50 MB." };
    const previa = URL.createObjectURL(arquivo);
    try {
      const d = await dadosDoVideo(previa);
      return {
        peca: {
          chave,
          arquivo,
          previa,
          tipo: "video",
          largura: d.largura || null,
          altura: d.altura || null,
          duracaoS: d.duracaoS || null,
        },
        erro: null,
      };
    } catch {
      URL.revokeObjectURL(previa);
      return { peca: null, erro: `A Pólia One não conseguiu ler o vídeo ${arquivo.name}.` };
    }
  }
  return { peca: null, erro: "Escolhe fotos ou um vídeo." };
}

/** Sobe na ordem da tela. Se um falhar, apaga os que já subiram. */
export async function subirPecas(
  userId: string,
  postId: string,
  pecas: Peca[],
): Promise<{ midias: MidiaPost[]; erro: string | null }> {
  const pasta = pastaDoPost(userId, postId);
  const subidos: string[] = [];
  const midias: MidiaPost[] = [];
  for (const [ordem, p] of pecas.entries()) {
    const ext = p.tipo === "imagem" ? "jpg" : p.arquivo.type === "video/quicktime" ? "mov" : "mp4";
    const caminho = `${pasta}${String(ordem).padStart(2, "0")}.${ext}`;
    const up = await supabase.storage
      .from(BUCKET)
      .upload(caminho, p.arquivo, { contentType: p.arquivo.type, upsert: false });
    if (up.error) {
      if (subidos.length) await supabase.storage.from(BUCKET).remove(subidos);
      return {
        midias: [],
        erro: "A Pólia One não conseguiu subir os arquivos agora. Tenta de novo.",
      };
    }
    subidos.push(caminho);
    midias.push({
      ordem,
      tipo: p.tipo,
      caminho,
      mime: p.arquivo.type,
      bytes: p.arquivo.size,
      largura: p.largura,
      altura: p.altura,
      duracaoS: p.duracaoS,
    });
  }
  return { midias, erro: null };
}

/** Agendamento recusado: o arquivo sai, pra não ficar pago no Storage. */
export async function apagarPecas(caminhos: string[]) {
  if (caminhos.length) await supabase.storage.from(BUCKET).remove(caminhos);
}
