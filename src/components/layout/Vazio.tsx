import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Estado vazio de uma tela ou lista.
 *
 * A borda tracejada FICA: ela aparece em 26 lugares do produto e é a convenção
 * da casa para "aqui ainda não tem nada". O que estava divergindo era o resto —
 * as telas vazias tinham três desenhos:
 *
 * 1. caixa com texto centralizado e link solto (Metas, Produtos, Mercado)
 * 2. caixa com uma frase em Fraunces itálico cinza, sem título nem ação
 *    (Clientes, Chamados) — a pior, porque não dizia o que fazer
 * 3. caixa com ícone, título e descrição (Planner) — a mais completa
 *
 * Este componente adota a terceira, alinhada à esquerda como o resto do app, e
 * com a ação no mesmo botão canônico. Estado vazio é a tela que a usuária nova
 * mais vê: se ela não diz o que fazer em seguida, não está fazendo o trabalho.
 *
 * As duas variantes existem porque a auditoria de 03/09/2026 achou dois lugares
 * onde a caixa cheia não cabe, e a saída fácil seria duplicar o componente:
 *
 * - `denso`: container estreito (coluna de kanban, sidesheet). Mesma caixa, com
 *   respiro e título menores.
 * - `semBorda`: já está DENTRO de um cartão (Painel). Caixa dentro de caixa fica
 *   ruidosa, então some a borda tracejada, o fundo e o respiro; o resto fica.
 */
export function Vazio({
  icone: Icone,
  titulo,
  texto,
  acao,
  denso = false,
  semBorda = false,
}: {
  icone?: LucideIcon;
  titulo: string;
  texto?: ReactNode;
  /** Use BTN_ACAO de `lib/botoes`. Estado vazio sem saída é beco. */
  acao?: ReactNode;
  /** Container estreito: coluna de kanban, sidesheet. */
  denso?: boolean;
  /** Já está dentro de um cartão: sem borda, sem fundo, sem respiro. */
  semBorda?: boolean;
}) {
  const caixa = semBorda
    ? ""
    : `rounded-xl border border-dashed border-[var(--line)] bg-white ${
        denso ? "px-4 py-6" : "px-6 py-10"
      }`;
  const compacto = denso || semBorda;
  return (
    <div className={caixa}>
      {Icone && (
        <span
          className={`flex items-center justify-center rounded-lg bg-[var(--secondary-light)] text-[var(--secondary-text)] ${
            compacto ? "mb-3 h-9 w-9" : "mb-4 h-11 w-11"
          }`}
        >
          <Icone size={compacto ? 17 : 20} aria-hidden="true" />
        </span>
      )}
      <p className={`leading-snug text-[var(--ink)] ${compacto ? "text-[15px]" : "text-[18px]"}`}>
        {titulo}
      </p>
      {texto && (
        <p className="mt-1.5 max-w-[52ch] text-[14px] leading-relaxed text-[var(--muted)]">
          {texto}
        </p>
      )}
      {acao && <div className={compacto ? "mt-3" : "mt-5"}>{acao}</div>}
    </div>
  );
}
