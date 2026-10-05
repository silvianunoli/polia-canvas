import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { perguntarAimer, MENSAGENS_CANONICAS } from "@/lib/aimer.functions";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";

export interface Mensagem {
  id: string;
  autor: "user" | "aimer";
  texto: string;
  hora: Date;
  erro?: boolean;
}

interface AssistenteValor {
  mensagens: Mensagem[];
  pergunta: string;
  setPergunta: (v: string) => void;
  enviando: boolean;
  tetoAtingido: boolean;
  enviar: (textoForcado?: string) => Promise<void>;
  tentarDeNovo: () => void;
  novaConversa: () => void;
  /** Painel flutuante aberto (o balão do canto inferior direito). */
  aberto: boolean;
  setAberto: (v: boolean) => void;
}

const AssistenteCtx = createContext<AssistenteValor | null>(null);

const novoId = () => crypto.randomUUID();

/**
 * A conversa do Assistente mora no layout da área logada (05/10/2026, saiu da
 * sidebar pro balão flutuante): trocar de tela no meio do papo não apaga o
 * histórico, e o balão e a página /aimer mostram a mesma conversa.
 */
export function AssistenteProvider({ children }: { children: ReactNode }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [pergunta, setPergunta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [tetoAtingido, setTetoAtingido] = useState(false);
  const [aberto, setAberto] = useState(false);

  const responder = (texto: string, erro = false) =>
    setMensagens((prev) => [
      ...prev,
      { id: novoId(), autor: "aimer", texto, hora: new Date(), erro },
    ]);

  const enviar = useCallback(
    async (textoForcado?: string) => {
      const texto = (textoForcado ?? pergunta).trim();
      if (!texto || enviando) return;
      const historico = mensagens.slice(-10).map((m) => ({ autor: m.autor, texto: m.texto }));

      setMensagens((prev) => [...prev, { id: novoId(), autor: "user", texto, hora: new Date() }]);
      setPergunta("");
      setEnviando(true);
      setTetoAtingido(false);

      try {
        const resultado = await perguntarAimer({ data: { pergunta: texto, historico } });
        if (resultado.ok) {
          responder(resultado.texto);
          track("aimer_pergunta_respondida");
          void registrar("feature_completed", {
            feature: "aimer",
            propriedades: { acao: "pergunta" },
          });
        } else if (resultado.motivo === "teto_atingido") {
          setTetoAtingido(true);
          responder(MENSAGENS_CANONICAS.tetoAtingido);
        } else if (resultado.motivo === "fora_de_escopo") {
          responder(MENSAGENS_CANONICAS.foraDeEscopo);
        } else if (resultado.motivo === "manutencao") {
          responder(MENSAGENS_CANONICAS.manutencao);
        } else {
          responder(MENSAGENS_CANONICAS.falhaIa, true);
        }
      } catch {
        responder(MENSAGENS_CANONICAS.falhaIa, true);
      } finally {
        setEnviando(false);
      }
    },
    [pergunta, enviando, mensagens],
  );

  const tentarDeNovo = useCallback(() => {
    const ultima = [...mensagens].reverse().find((m) => m.autor === "user")?.texto ?? "";
    setMensagens((prev) => prev.filter((m) => !m.erro));
    void enviar(ultima);
  }, [mensagens, enviar]);

  const novaConversa = useCallback(() => {
    setMensagens([]);
    setTetoAtingido(false);
  }, []);

  const valor = useMemo(
    () => ({
      mensagens,
      pergunta,
      setPergunta,
      enviando,
      tetoAtingido,
      enviar,
      tentarDeNovo,
      novaConversa,
      aberto,
      setAberto,
    }),
    [mensagens, pergunta, enviando, tetoAtingido, enviar, tentarDeNovo, novaConversa, aberto],
  );

  return <AssistenteCtx.Provider value={valor}>{children}</AssistenteCtx.Provider>;
}

export function useAssistente(): AssistenteValor {
  const v = useContext(AssistenteCtx);
  if (!v) throw new Error("useAssistente precisa estar dentro do AssistenteProvider");
  return v;
}
