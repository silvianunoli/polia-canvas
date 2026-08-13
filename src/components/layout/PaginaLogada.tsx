import type { ReactNode } from "react";

/**
 * Casca única de toda tela da área logada: container, margem, cabeçalho e a
 * posição da ação principal.
 *
 * Existe porque a auditoria de 13/08/2026 mediu **oito larguras de conteúdo em
 * quatorze telas** (de 650px a 1.120px) e **quatro posições diferentes** para o
 * botão principal. Nenhuma dessas diferenças comunicava nada: cada rota tinha
 * declarado o próprio `max-w` sem olhar as vizinhas, e o efeito era o conteúdo
 * saltando de lugar a cada troca de aba.
 *
 * São duas larguras, e só duas, escolhidas pelo tipo de conteúdo:
 * - `larga`   → telas de dado, que ganham com colunas (Painel, Financeiro,
 *               Clientes, Produtos, Calendário, Planner).
 * - `estreita`→ telas de leitura, formulário ou conversa, onde linha comprida
 *               atrapalha (Planejamento, Metas, Caderno, Marca, Aimer, Raio-x).
 *
 * A ação principal fica SEMPRE no topo à direita, alinhada ao título. É o único
 * ponto que não se desloca quando a tela tem ou não subtítulo.
 */

export type LarguraPagina = "larga" | "estreita";

const LARGURA: Record<LarguraPagina, string> = {
  larga: "max-w-[1120px]",
  estreita: "max-w-[720px]",
};

interface PaginaLogadaProps {
  titulo: ReactNode;
  /** Rótulo curto em caixa alta acima do título. */
  eyebrow?: string;
  /** Uma linha explicando a tela. Inter, nunca Fraunces. */
  subtitulo?: ReactNode;
  /** Ação principal da tela. Use BTN_ACAO de `lib/botoes`. */
  acao?: ReactNode;
  largura?: LarguraPagina;
  children: ReactNode;
}

export function PaginaLogada({
  titulo,
  eyebrow,
  subtitulo,
  acao,
  largura = "estreita",
  children,
}: PaginaLogadaProps) {
  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className={`mx-auto w-full ${LARGURA[largura]} px-6 pb-24 pt-12 md:px-10`}>
        <header className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                {eyebrow}
              </p>
            )}
            <h1 className="font-cabinet mt-1 text-balance text-[clamp(28px,5vw,42px)] leading-[1.08] text-[var(--ink)]">
              {titulo}
            </h1>
            {subtitulo && (
              <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-[var(--ink-soft)]">
                {subtitulo}
              </p>
            )}
          </div>
          {acao && <div className="shrink-0 pt-1">{acao}</div>}
        </header>
        {children}
      </div>
    </div>
  );
}
