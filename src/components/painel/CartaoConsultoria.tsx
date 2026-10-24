import { BTN_ACAO } from "@/lib/botoes";

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
  return (
    <section
      aria-labelledby="consultoria-titulo"
      className="flex flex-col gap-5 rounded-xl bg-[var(--ink)] p-6 text-[var(--bg)] md:flex-row md:items-center md:justify-between md:gap-8"
    >
      <div className="max-w-[60ch]">
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
