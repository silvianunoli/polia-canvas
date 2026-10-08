import { ehBeta, tierDoPlano } from "@/lib/planos";

/**
 * A usuária está no plano Grátis, do jeito que a trava de rota entende
 * (08/10/2026). Usado pelas cotas de Produtos, Caderno, Planner e Calculadora.
 *
 * Existe porque essas telas checavam `plano === "confere"`:
 *  - conta cancelada (plano "cancelada") passava como paga e ficava sem cota,
 *    enquanto o resto do app a trata como Grátis (tierDoPlano);
 *  - enquanto o perfil carrega, `plano` cai no padrão "confere", e o cadeado
 *    de cota piscava pra quem paga. Sem saber o plano, a resposta é "não".
 * Beta é acesso total e nunca é Grátis.
 */
export function ehPlanoGratis(meta: { plano: string | null | undefined; carregando: boolean }) {
  if (meta.carregando) return false;
  if (ehBeta(meta.plano)) return false;
  return tierDoPlano(meta.plano) === "confere";
}
