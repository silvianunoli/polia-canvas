/**
 * Pool de frases manuscritas que aparecem na lateral/canto de um CadernoCard
 * em contexto de retorno. Marcador exclusivo nº3 da virada terrena (Caderno Vivido).
 *
 * Regra: marginalia só aparece quando há sinal de revisita (visits > 1 ou
 * createdAt > X dias). Nunca em primeiro contato — quebra o efeito "caderno usado".
 */

export interface MarginaliaContext {
  /** ISO date da primeira interação com o item (ex: created_at). */
  primeiraVez?: string | null;
  /** ISO date da última visita registrada. */
  ultimaVisita?: string | null;
  /** Quantidade de visitas/aberturas registradas. */
  visitas?: number;
}

const DIA_MS = 86_400_000;

function diasAtras(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DIA_MS);
}

function diaDaSemana(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][
    d.getDay()
  ];
}

/**
 * Retorna a frase de marginalia mais apropriada pro contexto, ou null
 * quando não houver nada relevante pra dizer (primeiro contato).
 *
 * Pool foi calibrado pra voz Aimer — coloquial, curto, sem jargão.
 * Cf. [[feedback-linguagem-aimer]] e [[feedback-copy-infantil]].
 */
export function getMarginalia(ctx: MarginaliaContext): string | null {
  const { visitas = 0 } = ctx;
  const diasDesdePrimeira = diasAtras(ctx.primeiraVez);
  const diasDesdeUltima = diasAtras(ctx.ultimaVisita);
  const diaUltimaVisita = diaDaSemana(ctx.ultimaVisita);

  // primeiro contato — sem marginalia
  if (visitas <= 1 && (diasDesdePrimeira ?? 0) < 2) return null;

  // hoje mesmo (cara visitou de novo agora)
  if (diasDesdeUltima === 0 && visitas >= 2) {
    if (visitas >= 5) return `voltei aqui ${visitas}x esse mês`;
    return "voltei aqui hoje";
  }

  // ontem
  if (diasDesdeUltima === 1) return "última vez: ontem";

  // 2–6 dias
  if (diasDesdeUltima !== null && diasDesdeUltima >= 2 && diasDesdeUltima <= 6) {
    if (diaUltimaVisita) return `última vez: ${diaUltimaVisita}`;
    return `${diasDesdeUltima} dias atrás`;
  }

  // 1+ semanas — usa primeira vez como âncora
  if (diasDesdePrimeira !== null && diasDesdePrimeira >= 7) {
    if (diasDesdePrimeira < 30) {
      return `começou isso há ${diasDesdePrimeira} dias`;
    }
    const meses = Math.floor(diasDesdePrimeira / 30);
    return meses === 1 ? "tá aqui há 1 mês" : `tá aqui há ${meses} meses`;
  }

  // fallback genérico baseado em visitas
  if (visitas >= 3) return `voltei ${visitas}x`;

  return null;
}

/** Variação ligeiramente diferente pra usar em cards de etapa (foco em progresso). */
export function getMarginaliaEtapa(ctx: MarginaliaContext): string | null {
  const { visitas = 0 } = ctx;
  const diasDesdeUltima = diasAtras(ctx.ultimaVisita);

  if (visitas <= 1) return null;

  if (diasDesdeUltima === 0) return "parei aqui hoje";
  if (diasDesdeUltima === 1) return "ontem eu estava aqui";
  if (diasDesdeUltima !== null && diasDesdeUltima <= 6) {
    return `tô voltando depois de ${diasDesdeUltima} dias`;
  }
  if (diasDesdeUltima !== null && diasDesdeUltima >= 7) {
    return "fazia tempo que eu não vinha";
  }
  return null;
}
