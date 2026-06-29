import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Sua guia — a Raposa-Companheira da Pólia.
// Gemini nativo (Google AI Studio). O gateway antigo (Lovable) saiu do ar,
// então falamos direto com generativelanguage.googleapis.com.
// Configure GEMINI_API_KEY no .env (dev) e como secret no Worker (prod).

const mensagemSchema = z.object({
  papel: z.enum(["user", "guia"]),
  conteudo: z.string().max(4000),
});

const inputSchema = z.object({
  mensagem: z.string().min(1).max(4000),
  historico: z.array(mensagemSchema).max(40).optional(),
});

const MODELO = "gemini-2.5-flash";

const SYSTEM_PROMPT = `Você é a guia da Pólia — uma companheira de confiança para empreendedoras brasileiras que tocam o próprio negócio sozinhas.

QUEM VOCÊ ESTÁ AJUDANDO:
Uma mulher que já tem um negócio (ateliê, marca, serviço, loja) e quer profissionalizar o dia a dia. Ela é adulta, capaz e ocupada. Não está começando do zero — está organizando o que já existe.

COMO VOCÊ FALA:
- Português do Brasil, caloroso, direto e adulto. Como uma amiga mais experiente, não como um manual.
- Frases curtas. Vá ao ponto. Respostas geralmente de 2 a 5 frases.
- Zero jargão corporativo. Nunca use: KPI, dashboard, pipeline, funil, brand board, ROI, "alavancar", "engajamento", "stakeholder".
- Nada de infantilizar. Sem excesso de fofura, sem ser cheerleader, sem empilhar metáforas. Uma palavra gentil basta.
- Pode usar minúsculas no começo de frases quando soar mais natural e leve.

COMO VOCÊ AJUDA:
- Faça UMA pergunta de cada vez quando precisar entender melhor, em vez de despejar várias.
- Termine quase sempre com um próximo passo concreto e pequeno — algo que ela consiga fazer hoje.
- Fale da operação real do negócio dela: clientes, conteúdo, preço, rotina, decisões, foco, cansaço.
- Não invente dados sobre o negócio dela. Se não souber, pergunte.
- Quando ela estiver sobrecarregada, ajude a escolher só a próxima coisa — não a lista inteira.

Você é a guia. Você caminha do lado dela, não na frente.`;

export type GuiaResposta = { resposta: string | null; error: string | null };

export const conversarComGuia = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<GuiaResposta> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
      return {
        resposta: null,
        error: "A guia ainda não está conectada. (falta configurar a chave da IA)",
      };

    const contents = [
      ...(data.historico ?? []).map((m) => ({
        role: m.papel === "guia" ? "model" : "user",
        parts: [{ text: m.conteudo }],
      })),
      { role: "user", parts: [{ text: data.mensagem }] },
    ];

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 800,
              topP: 0.95,
            },
          }),
        },
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("Gemini error:", res.status, text);
        if (res.status === 429)
          return {
            resposta: null,
            error: "Muitas mensagens em pouco tempo. Tente de novo em instantes.",
          };
        if (res.status === 400 && text.includes("API_KEY"))
          return { resposta: null, error: "A chave da IA não está válida." };
        return {
          resposta: null,
          error: "Não consegui responder agora. Tenta de novo daqui a pouco?",
        };
      }

      const json = await res.json();
      const texto = json?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p?.text ?? "")
        .join("")
        .trim();

      if (!texto) {
        const motivo = json?.candidates?.[0]?.finishReason;
        if (motivo === "SAFETY")
          return {
            resposta: null,
            error: "Prefiro não responder isso. Posso te ajudar com algo do seu negócio?",
          };
        return { resposta: null, error: "A resposta veio vazia. Tenta reformular?" };
      }

      return { resposta: texto, error: null };
    } catch (err) {
      console.error("conversarComGuia error:", err);
      return { resposta: null, error: "Falha de conexão com a guia." };
    }
  });

// Insight curto e contextual (Painel, Foco, Progresso). Stateless: recebe os
// números já calculados no cliente e devolve 1 frase. O cache vive na tabela
// coach_insights (TTL ~6h), gerenciado no cliente.
const insightSchema = z.object({
  contexto: z.string().max(40),
  resumo: z.string().min(1).max(2000),
});

export type InsightResposta = { texto: string | null; error: string | null };

export const gerarInsight = createServerFn({ method: "POST" })
  .inputValidator((input) => insightSchema.parse(input))
  .handler(async ({ data }): Promise<InsightResposta> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { texto: null, error: "IA não conectada." };

    const prompt = `${SYSTEM_PROMPT}

Aqui estão números reais do dia a dia dela (tela: ${data.contexto}):
${data.resumo}

Escreva UM único insight curto pra ela — 1 a 2 frases, no máximo 30 palavras. No seu tom de guia: caloroso, direto, honesto. Sem saudação, sem pergunta, sem emoji. Baseie-se nos números: se estão bons, reconheça; se há algo a melhorar, aponte com gentileza e sugira um próximo passo pequeno.`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 200, topP: 0.95 },
          }),
        },
      );

      if (!res.ok) {
        console.error("Gemini insight error:", res.status, await res.text());
        return { texto: null, error: "Não consegui gerar o insight agora." };
      }

      const json = await res.json();
      const texto = json?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p?.text ?? "")
        .join("")
        .trim();
      if (!texto) return { texto: null, error: "Resposta vazia." };
      return { texto, error: null };
    } catch (err) {
      console.error("gerarInsight error:", err);
      return { texto: null, error: "Falha de conexão." };
    }
  });
