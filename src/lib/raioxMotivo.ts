// Partes puras do raio-x que a tela e o servidor dividem (QA-30, 07/10/2026).
// Fica fora de raiox.functions.ts pra a tela não importar nada de servidor.
import { temProjete } from "@/lib/planos";

/** Teto único de gerações de raio-x por mês do calendário (ia_uso). */
export const LIMITE_RAIOX_MENSAL = 3;

/** Pro e beta (acesso total) geram raio-x; o resto não. */
export function planoGeraRaioX(plano: string | null | undefined): boolean {
  return temProjete(plano);
}

export type MotivoRaioX =
  | "manutencao"
  | "teto_atingido"
  | "falha_ia"
  | "dado_insuficiente"
  | "mes_nao_fechado"
  | "plano_insuficiente";

/**
 * Texto curto pra quando o pedido de raio-x volta recusado e já existe um
 * raio-x na tela. Antes o motivo era guardado e nunca mostrado nesse caso, e
 * "Gerar outro" parecia não fazer nada.
 */
export function avisoDoMotivoRaioX(motivo: MotivoRaioX): string {
  switch (motivo) {
    case "teto_atingido":
      return `As ${LIMITE_RAIOX_MENSAL} gerações de raio-x deste mês já foram usadas. Renovam no dia 1º, e este raio-x continua aqui pra reler.`;
    case "dado_insuficiente":
      return "Esse mês tem pouco registrado pra uma leitura nova. O raio-x anterior continua aqui.";
    case "mes_nao_fechado":
      return "O mês ainda está correndo. Tenta de novo pra ler o que tem até aqui.";
    case "manutencao":
      return "O raio-x está em manutenção agora. Tenta de novo mais tarde, este continua aqui.";
    case "plano_insuficiente":
      return "A Pólia One não encontrou o plano Pro ativo nesta conta, então não gerou outro raio-x.";
    case "falha_ia":
      return "A Pólia One não conseguiu ler o seu mês agora. Tenta de novo.";
  }
}
