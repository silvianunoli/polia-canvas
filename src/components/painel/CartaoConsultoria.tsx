import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { BTN_ACAO } from "@/lib/botoes";

/**
 * Fechar o cartão (07/11/2026, pedido da Sil): o X esconde a oferta por 24 horas
 * e ela volta sozinha depois. Fica no localStorage do aparelho, não no banco:
 * é preferência de tela, e perder no outro aparelho não custa nada.
 */
export const CHAVE_CONSULTORIA_FECHADA = "polia-consultoria-fechada-em";
export const ESPERA_CONSULTORIA_MS = 24 * 60 * 60 * 1000;

export function consultoriaVisivel(fechadaEm: string | null, agora: number): boolean {
  const quando = Number(fechadaEm);
  if (!fechadaEm || !Number.isFinite(quando)) return true;
  return agora - quando >= ESPERA_CONSULTORIA_MS;
}

function lerFechadaEm(): string | null {
  try {
    return window.localStorage.getItem(CHAVE_CONSULTORIA_FECHADA);
  } catch {
    return null;
  }
}

/**
 * Número de atendimento da Consultoria (24/10/2026, pedido da Sil). Fica em
 * constante, não em env: é contato público, não segredo.
 */
const WHATSAPP_CONSULTORIA = "5511996963296";
const MENSAGEM_INICIAL = "Oi, vim pelo Painel da Pólia One e quero saber da Consultoria.";

export const LINK_WHATSAPP_CONSULTORIA = `https://wa.me/${WHATSAPP_CONSULTORIA}?text=${encodeURIComponent(MENSAGEM_INICIAL)}`;

/**
 * Cartão do Painel que leva pra Consultoria no WhatsApp. Fundo tinta de
 * propósito: na primeira versão (superfície e borda, igual aos outros) a Sil
 * achou que sumia no meio dos números e parecia parte do Painel. Invertido,
 * ele lê como oferta. Sem gradiente nem sombra, só tokens.
 */
export function CartaoConsultoria() {
  // Lido depois de montar, pra o HTML do servidor e o do navegador saírem iguais.
  // Até lá não desenha nada: melhor aparecer um instante depois do que piscar e sumir.
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    setVisivel(consultoriaVisivel(lerFechadaEm(), Date.now()));
  }, []);

  function fechar() {
    try {
      window.localStorage.setItem(CHAVE_CONSULTORIA_FECHADA, String(Date.now()));
    } catch {
      // Sem armazenamento (aba anônima bloqueada): fecha só nesta visita.
    }
    setVisivel(false);
  }

  if (!visivel) return null;

  return (
    <section
      aria-labelledby="consultoria-titulo"
      className="relative flex flex-col gap-5 rounded-xl bg-[var(--ink)] p-6 text-[var(--bg)] md:flex-row md:items-center md:justify-between md:gap-8 md:pr-16"
    >
      <button
        type="button"
        onClick={fechar}
        aria-label="Fechar a Consultoria por 24 horas"
        className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--bg)] transition-opacity duration-150 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[var(--bg)]"
      >
        <X size={20} aria-hidden="true" />
      </button>
      <div className="max-w-[60ch] pr-8 md:pr-0">
        <span className="inline-flex rounded-full border border-[var(--secondary)] px-3 py-1 text-[10px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--bg)]">
          Consultoria
        </span>
        <h2
          id="consultoria-titulo"
          className="font-cabinet mt-4 text-[24px] leading-tight text-[var(--bg)]"
        >
          A marca não precisa ficar só nas suas costas.
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--line)]">
          A Pólia One mostra os números. Na Consultoria, a Pólia monta com você o que vem em volta
          deles: preço, oferta e o caminho até a cliente chegar. O plano sai pronto e na mão.
        </p>
      </div>
      <a
        href={LINK_WHATSAPP_CONSULTORIA}
        target="_blank"
        rel="noopener noreferrer"
        className={`${BTN_ACAO} min-h-11 shrink-0 self-start focus-visible:!outline-[var(--bg)] md:self-center`}
      >
        Quero a Consultoria <span aria-hidden="true">→</span>
        <span className="sr-only">(abre o WhatsApp em outra aba)</span>
      </a>
    </section>
  );
}
