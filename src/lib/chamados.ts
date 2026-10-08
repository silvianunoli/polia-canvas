// Regras puras dos chamados de suporte (QA-36, 07/10/2026).

export type StatusChamado = "aberto" | "em_andamento" | "resolvido";

/** Rótulo visível de cada status. Fonte única pra lista e pro detalhe. */
export const STATUS_CHAMADO_LABEL: Record<StatusChamado, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
};

/** Status desconhecido (coluna livre no banco) cai em "Aberto", nunca em texto cru. */
export function rotuloStatusChamado(status: string): string {
  return STATUS_CHAMADO_LABEL[status as StatusChamado] ?? STATUS_CHAMADO_LABEL.aberto;
}

interface ChamadoComMensagens {
  created_at: string;
  updated_at: string;
  ticket_messages?: { created_at: string }[] | null;
}

function ms(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Ordena do chamado com atividade mais recente pro mais antigo. Atividade é o
 * maior entre a última mensagem e o updated_at do chamado: a resposta (da
 * cliente ou do suporte) entra em ticket_messages e não mexe no chamado, então
 * ordenar só por updated_at deixava a conversa nova lá embaixo.
 */
export function ordenarPorUltimaAtividade<T extends ChamadoComMensagens>(
  chamados: T[],
): (Omit<T, "ticket_messages"> & { ultimaMensagem: string | null })[] {
  return chamados
    .map(({ ticket_messages, ...resto }) => {
      let ultimaMensagem: string | null = null;
      for (const m of ticket_messages ?? []) {
        if (ultimaMensagem === null || ms(m.created_at) > ms(ultimaMensagem)) {
          ultimaMensagem = m.created_at;
        }
      }
      const atividade = Math.max(
        ms(resto.created_at),
        ms(resto.updated_at),
        ultimaMensagem ? ms(ultimaMensagem) : 0,
      );
      return { item: { ...resto, ultimaMensagem }, atividade };
    })
    .sort((a, b) => b.atividade - a.atividade)
    .map((x) => x.item);
}
