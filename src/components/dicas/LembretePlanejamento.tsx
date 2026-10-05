import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Modal } from "@/components/ui/Modal";
import { supabase } from "@/integrations/supabase/client";
import { useDicasVistas } from "@/hooks/useDicasVistas";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { track } from "@/lib/analytics";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { dataLocal, deveLembrarHoje, progressoPlanejamento } from "@/lib/lembretePlanejamento";

const chaveDoDia = (userId: string) => `polia:lembrete-planejamento:${userId}`;

function lerUltimo(userId: string): string | null {
  try {
    return window.localStorage.getItem(chaveDoDia(userId));
  } catch {
    return null;
  }
}

function gravarHoje(userId: string) {
  try {
    window.localStorage.setItem(chaveDoDia(userId), dataLocal(new Date()));
  } catch {
    /* sem storage (aba anônima): o lembrete só volta a aparecer, nada quebra */
  }
}

/**
 * No primeiro acesso do dia, quem não fechou os 6 módulos do Planejamento vê
 * em qual parou e vai direto pra ele (pedido da Sil, 05/10/2026).
 * Não aparece junto com o tour de boas-vindas (o primeiro dia já é dele) nem
 * dentro do próprio Planejamento ou do onboarding. O "já lembrei hoje" fica no
 * aparelho: é conveniência, não dado que precise viajar com a conta.
 */
export function LembretePlanejamento({ pathname }: { pathname: string }) {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const navigate = useNavigate();
  const { pronto, mostrar } = useDicasVistas();
  const [aberto, setAberto] = useState(false);

  const foraDeContexto =
    pathname === "/onboarding" ||
    pathname === "/assinar" ||
    pathname === "/upgrade" ||
    pathname.startsWith("/planejamento");

  const secoesQuery = useQuery({
    queryKey: ["lembrete-planejamento", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planejamento_secoes" as never)
        .select("secao, concluido")
        .eq("user_id", userId!)
        .eq("concluido", true);
      if (error) throw error;
      return new Set(((data ?? []) as { secao: string }[]).map((s) => s.secao));
    },
  });

  const progresso = secoesQuery.data ? progressoPlanejamento(secoesQuery.data) : null;

  useEffect(() => {
    if (!userId || !pronto || foraDeContexto || !progresso || aberto) return;
    if (mostrar("tour")) return; // primeiro dia: quem apresenta é o tour
    if (!deveLembrarHoje(lerUltimo(userId), dataLocal(new Date()))) return;
    gravarHoje(userId);
    setAberto(true);
    void track("lembrete_planejamento_exibido", { modulo: progresso.modulo });
  }, [userId, pronto, foraDeContexto, progresso, aberto, mostrar]);

  if (!progresso) return null;

  const faltam = progresso.total - progresso.feitas;
  const descricao =
    progresso.feitas === 0
      ? `O Módulo ${progresso.modulo}, ${progresso.nome}, ainda não começou. São ${progresso.total} seções curtas.`
      : `No Módulo ${progresso.modulo}, ${progresso.nome}, ${progresso.feitas} de ${progresso.total} seções já estão feitas. ${faltam === 1 ? "Falta 1" : `Faltam ${faltam}`} pra fechar o módulo.`;

  return (
    <Modal
      open={aberto}
      onOpenChange={setAberto}
      title={`O Planejamento parou no Módulo ${progresso.modulo}`}
      description={descricao}
      footer={
        <>
          <button type="button" onClick={() => setAberto(false)} className={BTN_ACAO_CONTORNO}>
            Agora não
          </button>
          <button
            type="button"
            onClick={() => {
              setAberto(false);
              void track("lembrete_planejamento_continuar", { modulo: progresso.modulo });
              void navigate({
                to: "/planejamento/modulo/$n",
                params: { n: String(progresso.modulo) },
                search: { secao: undefined },
              });
            }}
            className={BTN_ACAO}
          >
            Continuar o Módulo {progresso.modulo}
            <span aria-hidden="true">→</span>
          </button>
        </>
      }
    />
  );
}
