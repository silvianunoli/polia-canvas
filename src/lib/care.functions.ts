import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gerarJsonIA, type JsonSchema } from "./gemini";

const inputSchema = z.object({
  welcome_protocol: z.string().min(1).max(2000),
  issue_handling: z.string().min(1).max(2000),
  loyalty_strategy: z.string().min(1).max(2000),
  business_name: z.string().max(200).optional(),
});

export type ProtocoloCuidado = {
  boas_vindas: string;
  resolucao: string;
  fidelizacao: string;
  mensagem_pos_entrega: string;
};

const schema: JsonSchema = {
  type: "object",
  properties: {
    boas_vindas: { type: "string" },
    resolucao: { type: "string" },
    fidelizacao: { type: "string" },
    mensagem_pos_entrega: { type: "string" },
  },
  required: ["boas_vindas", "resolucao", "fidelizacao", "mensagem_pos_entrega"],
};

export const gerarProtocoloCuidado = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(
    async ({ data }): Promise<{ protocolo: ProtocoloCuidado | null; error: string | null }> => {
      const prompt = `Você é consultora de atendimento e experiência do cliente, especializada em pequenas empreendedoras brasileiras.

COMO VOCÊ RECEBE NOVAS CLIENTES:
"${data.welcome_protocol}"

COMO RESOLVE PROBLEMAS:
"${data.issue_handling}"

COMO FIDELIZA:
"${data.loyalty_strategy}"

Gere o protocolo de cuidado. boas_vindas deve ter 2-3 frases descrevendo o protocolo de boas-vindas em forma de guia prático. resolucao deve ter 2-3 frases sobre o protocolo de resolução de problemas. fidelizacao deve ter 2-3 frases sobre as ações de fidelização mais eficazes. mensagem_pos_entrega deve ser uma mensagem de WhatsApp de 2-3 linhas pra enviar após a entrega, calorosa, natural, sem emoji, sem traço longo.`;

      const { data: protocolo, error } = await gerarJsonIA<ProtocoloCuidado>(prompt, schema, {
        maxOutputTokens: 1536,
      });
      return { protocolo, error };
    },
  );
