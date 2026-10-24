import { BTN_ACAO } from "@/lib/botoes";

/**
 * Número de atendimento da Consultoria (24/10/2026, pedido da Sil). Fica em
 * constante, não em env: é contato público, não segredo.
 */
const WHATSAPP_CONSULTORIA = "5511996963296";
const MENSAGEM_INICIAL = "Oi, vim pelo Painel da Pólia One e quero saber da Consultoria.";

export const LINK_WHATSAPP_CONSULTORIA = `https://wa.me/${WHATSAPP_CONSULTORIA}?text=${encodeURIComponent(MENSAGEM_INICIAL)}`;

/**
 * Cartão do Painel que leva pra Consultoria no WhatsApp. Sem gradiente nem
 * sombra (a referência que a Sil mandou tinha os dois): superfície e borda de
 * 1px, como os outros cartões do bento, e o botão na forma canônica.
 */
export function CartaoConsultoria() {
  return (
    <section
      aria-labelledby="consultoria-titulo"
      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"
    >
      <span className="inline-flex rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[10px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
        Consultoria
      </span>
      <h2
        id="consultoria-titulo"
        className="font-cabinet mt-4 text-[22px] leading-tight text-[var(--ink)]"
      >
        A marca não precisa ficar só nas suas costas.
      </h2>
      <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-[var(--ink-soft)]">
        A Pólia One mostra os números. Na Consultoria, a Pólia monta com você o que vem em volta
        deles: preço, oferta e o caminho até a cliente chegar. O plano sai pronto e na mão.
      </p>
      <a
        href={LINK_WHATSAPP_CONSULTORIA}
        target="_blank"
        rel="noopener noreferrer"
        className={`${BTN_ACAO} mt-5 min-h-11`}
      >
        Quero a Consultoria <span aria-hidden="true">→</span>
        <span className="sr-only">(abre o WhatsApp em outra aba)</span>
      </a>
    </section>
  );
}
