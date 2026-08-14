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
 */
export function Vazio({
  icone: Icone,
  titulo,
  texto,
  acao,
}: {
  icone?: LucideIcon;
  titulo: string;
  texto?: ReactNode;
  /** Use BTN_ACAO de `lib/botoes`. Estado vazio sem saída é beco. */
  acao?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--line)] bg-white px-6 py-10">
      {Icone && (
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--secondary-light)] text-[var(--secondary-text)]">
          <Icone size={20} aria-hidden="true" />
        </span>
      )}
      <p className="text-[18px] leading-snug text-[var(--ink)]">{titulo}</p>
      {texto && (
        <p className="mt-1.5 max-w-[52ch] text-[14px] leading-relaxed text-[var(--muted)]">
          {texto}
        </p>
      )}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}
