// Telefone digitado em formulário público vem de todo jeito: com parêntese,
// traço, espaço, +55, sem DDD. Aqui vira um formato só, o mesmo que o CRM usa
// em crm_contatos.telefone e que o link wa.me aceita: dígitos com 55 na frente.
//
// Campo opcional (decisão da Sil, 18/09/2026): número que não dá pra usar volta
// nulo em vez de barrar o cadastro. Perder o telefone é chato; perder a lead
// porque ela digitou o número errado é pior.

export function normalizarTelefone(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  const digitos = bruto.replace(/\D/g, "");
  // Menos de 10 dígitos não é telefone brasileiro com DDD.
  if (digitos.length < 10) return null;
  if (digitos.startsWith("55")) {
    // 55 + DDD + 8 ou 9 dígitos. Mais que isso é engano de digitação.
    return digitos.length >= 12 && digitos.length <= 13 ? digitos : null;
  }
  if (digitos.length > 11) return null;
  return `55${digitos}`;
}

// Máscara só pra exibição enquanto a pessoa digita: (11) 99999-9999.
export function mascararTelefone(bruto: string): string {
  const d = bruto.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
