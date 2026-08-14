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
 * São duas larguras, e só duas. O critério é este, e não "leitura vs. dado":
 *
 *   Tem cartão, grade, lista ou formulário?  → `larga`
 *   É prosa corrida, do começo ao fim?       → `estreita`
 *
 * A primeira versão classificou por "leitura vs. dado" e errou seis telas
 * (Metas, Planner, Chamados, Plano de conteúdo, Projeção, Configurações): são
 * listas e formulários, e a 720px ficavam espremidos com metade da tela vazia
 * ao lado — no Planner cabiam 2 quadros por linha em vez de 3, e no Plano de
 * conteúdo o próprio h1 quebrava em duas linhas.
 *
 * `estreita` fica só onde a medida curta É a função: Marca, Mapa de Mercado,
 * Raio-x (parágrafo gerado) e o módulo do Planejamento. Nessas, alargar aumenta
 * a linha para 110+ caracteres e o olho perde onde estava.
 *
 * O Documento do Planejamento saiu dessa lista: parece prosa, mas é um bento de
 * cartões com um bloco de destaque que já trava em 46ch no próprio parágrafo.
 * Quando o texto tem trava própria, a largura do container não piora leitura.
 *
 * Caso misto: a Aimer usa `larga` na caixa e trava a bolha da conversa em 68ch
 * por dentro — o container acompanha a tela, a linha continua legível.
 *
 * A ação principal fica SEMPRE no topo à direita, alinhada ao título. É o único
 * ponto que não se desloca quando a tela tem ou não subtítulo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EXCEÇÕES DECLARADAS (decisão da fundadora, 13/08/2026). Não são esquecimento:
 *
 * - `/painel` — já está em 1.120px com o cabeçalho reescrito nesta mesma
 *   auditoria (saudação, manchete que muda com o dado, botão da ação principal
 *   e linha de contexto). Cabe no padrão sem usar o componente, e converter só
 *   por simetria desfaria trabalho que já foi medido e verificado.
 *
 * - `/planner/$slug` (o quadro) — é full-bleed de 1.400px com rolagem
 *   horizontal. Kanban precisa da largura toda; enfiar num container de 1.120px
 *   cortaria coluna. A rolagem lateral é a natureza da tela, não um defeito.
 *
 * - `/onboarding` — fluxo de tela cheia, fora da barra lateral e do container.
 *
 * Qualquer OUTRA tela logada deve usar este componente. Se aparecer um
 * `mx-auto max-w-[...]` novo numa rota, é regressão.
 * ─────────────────────────────────────────────────────────────────────────────
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
