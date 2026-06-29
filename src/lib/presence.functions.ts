import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gerarJsonIA, type JsonSchema } from "./gemini";

const inputSchema = z.object({
  main_channel: z.string().min(1).max(2000),
  visual_presence: z.string().min(1).max(2000),
  purchase_path: z.string().min(1).max(2000),
  business_name: z.string().max(200).optional(),
});

export type GuiaPresenca = {
  canal_principal: string;
  aparencia_guia: string;
  caminho_resumido: string;
  bio_sugerida: string;
};

const schema: JsonSchema = {
  type: "object",
  properties: {
    canal_principal: { type: "string" },
    aparencia_guia: { type: "string" },
    caminho_resumido: { type: "string" },
    bio_sugerida: { type: "string" },
  },
  required: ["canal_principal", "aparencia_guia", "caminho_resumido", "bio_sugerida"],
};

export const gerarGuiaPresenca = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ guia: GuiaPresenca | null; error: string | null }> => {
    const prompt = `Você é consultora de marketing digital especializada em pequenas empreendedoras brasileiras.

CANAL PRINCIPAL:
"${data.main_channel}"

APARÊNCIA ONLINE:
"${data.visual_presence}"

CAMINHO DE COMPRA:
"${data.purchase_path}"

Gere o guia de primeira impressão. O canal_principal deve ter 1 frase identificando o canal mais forte e por quê. A aparencia_guia deve ter 2-3 frases descrevendo como ela aparece e o que funciona. O caminho_resumido deve ser um passo a passo simplificado do processo de compra, máximo 3 passos numerados. A bio_sugerida deve ter até 150 caracteres pra redes sociais, sem emoji, com posicionamento claro. Sem traço longo. Sem emojis.`;

    const { data: guia, error } = await gerarJsonIA<GuiaPresenca>(prompt, schema, {
      maxOutputTokens: 1536,
    });
    return { guia, error };
  });
