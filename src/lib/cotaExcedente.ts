/**
 * Quais itens passaram da cota do plano Grátis (ex.: depois de um downgrade do
 * Premium com 3 quadros, sobram 2 acima do limite de 1).
 *
 * Mesma regra da trigger assert_cota_confere (migração 20260727130000): os N
 * itens mais antigos por created_at ficam dentro da cota, com o id como
 * desempate quando dois nasceram no mesmo instante. O resto é excedente:
 * continua visível, mas só leitura.
 *
 * Lógica pura, sem React nem Supabase. Quem chama decide se a cota se aplica
 * (só o plano Grátis, chave interna "confere", tem cota).
 */
export interface ItemComCriacao {
  id: string;
  created_at: string;
}

export function idsAcimaDaCota(itens: readonly ItemComCriacao[], limite: number): Set<string> {
  const ordenados = [...itens].sort((a, b) => {
    const porData = a.created_at.localeCompare(b.created_at);
    if (porData !== 0) return porData;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return new Set(ordenados.slice(Math.max(0, limite)).map((i) => i.id));
}
