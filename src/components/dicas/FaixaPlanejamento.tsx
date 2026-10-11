import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { LinkInterno } from "@/components/ui/LinkInterno";
import { track } from "@/lib/analytics";
import { BTN_MIUDO } from "@/lib/botoes";
import { dataLocal, deveLembrarHoje, type ProgressoPlanejamento } from "@/lib/lembretePlanejamento";

const chaveDoDia = (userId: string) => `polia:faixa-planejamento:${userId}`;

function lerFechadoEm(userId: string): string | null {
  try {
    return window.localStorage.getItem(chaveDoDia(userId));
  } catch {
    return null;
  }
}

function gravarFechadoHoje(userId: string) {
  try {
    window.localStorage.setItem(chaveDoDia(userId), dataLocal(new Date()));
  } catch {
    /* sem storage (aba anônima): a faixa só volta no próximo load, nada quebra */
  }
}

/**
 * Lembrete do Planejamento em faixa no topo do Painel (11/10/2026, ONE-112).
 * Era um modal no primeiro acesso de cada dia, em qualquer tela: fechado por
 * reflexo, sem ser lido. O texto é o mesmo. Fechar esconde até o dia seguinte
 * (fica no aparelho: é conveniência, não dado que precise viajar com a conta).
 *
 * O Painel só usa a faixa depois do Módulo 4: antes disso a própria manchete
 * já aponta o módulo em andamento, e a faixa repetiria o recado.
 */
export function FaixaPlanejamento({
  userId,
  progresso,
}: {
  userId: string;
  progresso: ProgressoPlanejamento;
}) {
  // Decide no cliente (localStorage), depois de montar, pra não divergir do SSR.
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    setVisivel(deveLembrarHoje(lerFechadoEm(userId), dataLocal(new Date())));
  }, [userId]);

  useEffect(() => {
    if (visivel) void track("lembrete_planejamento_exibido", { modulo: progresso.modulo });
  }, [visivel, progresso.modulo]);

  if (!visivel) return null;

  const faltam = progresso.total - progresso.feitas;
  const texto =
    progresso.feitas === 0
      ? `O Módulo ${progresso.modulo}, ${progresso.nome}, ainda não começou. São ${progresso.total} seções curtas.`
      : `No Módulo ${progresso.modulo}, ${progresso.nome}, ${progresso.feitas} de ${progresso.total} seções já estão feitas. ${faltam === 1 ? "Falta 1" : `Faltam ${faltam}`} pra fechar o módulo.`;

  return (
    <div
      role="status"
      className="mb-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-[var(--secondary-light)] py-2 pl-4 pr-2 text-[14px] text-[var(--ink)]"
    >
      <p className="min-w-0 flex-1">{texto}</p>
      <div className="flex items-center gap-1">
        <LinkInterno
          href={`/planejamento/modulo/${progresso.modulo}`}
          onClick={() =>
            void track("lembrete_planejamento_continuar", { modulo: progresso.modulo })
          }
          className={BTN_MIUDO}
        >
          Continuar o Módulo {progresso.modulo}
          <span aria-hidden="true">→</span>
        </LinkInterno>
        <button
          type="button"
          onClick={() => {
            gravarFechadoHoje(userId);
            setVisivel(false);
          }}
          aria-label="Fechar o lembrete até amanhã"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--ink-soft)] transition-colors hover:bg-white"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
