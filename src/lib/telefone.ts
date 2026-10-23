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

// WhatsApp da conta (cadastro e Configurações, 23/10/2026): a Pólia manda
// lembrete de tarefa por lá. Diferente de normalizarTelefone, aqui o número
// precisa fechar (DDD válido, celular com o 9) porque ela vai esperar receber:
// número que não fecha volta null e a tela pede pra conferir. Mesmo padrão do
// check profiles_whatsapp_check.
const WHATSAPP_CONTA = /^55[1-9][1-9](9\d{8}|[2-8]\d{7})$/;

export function whatsappDaConta(bruto: string): string | null {
  let d = bruto.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  const numero = `55${d}`;
  return WHATSAPP_CONTA.test(numero) ? numero : null;
}

/** "5511988880000" vira "(11) 98888-0000", pra mostrar o número salvo no campo. */
export function whatsappParaCampo(digitos: string | null | undefined): string {
  if (!digitos) return "";
  return mascararTelefone(digitos.startsWith("55") ? digitos.slice(2) : digitos);
}
