// Regras puras da nota fiscal (PAY-32, 12/10/2026). Mesmo padrão do
// stripeWebhookRegras.ts: sem import de runtime, testado pelo Vitest do app
// (src/lib/notaFiscalRegras.test.ts). O stripe-webhook só fala com Stripe,
// NFE.io e banco; o que DECIDE (emite ou não, cancela ou não, o que vai na
// nota) mora aqui.

import { soDigitos, tipoDocumento } from "./documentoFiscal.ts";

export interface FaturaParaNota {
  status?: string | null;
  amount_paid: number;
  currency: string;
}

/** Só fatura paga, em real e com valor. Cupom de 100% (R$ 0) não gera nota. */
export function faturaGeraNota(fatura: FaturaParaNota): boolean {
  return fatura.status === "paid" && fatura.amount_paid > 0 && fatura.currency === "brl";
}

export interface CobrancaReembolsada {
  amount: number;
  amount_refunded: number;
  refunded?: boolean | null;
}

/**
 * "total": devolveu tudo, a nota é cancelada. "parcial": NFS-e não tem
 * cancelamento parcial, então a nota fica e a Sil é avisada. "nenhum": evento
 * sem valor devolvido.
 */
export function tipoDeReembolso(c: CobrancaReembolsada): "total" | "parcial" | "nenhum" {
  if (c.refunded === true || (c.amount > 0 && c.amount_refunded >= c.amount)) return "total";
  if (c.amount_refunded > 0) return "parcial";
  return "nenhum";
}

// Estados da linha em notas_fiscais. "emitida" = a NFE.io aceitou o pedido
// (ela segue processando com a prefeitura e manda o PDF pro e-mail da cliente).
export type StatusNota =
  | "emitindo"
  | "emitida"
  | "erro_emissao"
  | "cancelada"
  | "erro_cancelamento";

/** Pode pedir a nota (de novo)? Nunca pede duas vezes nem emite o que já foi reembolsado. */
export function podeEmitir(linha: { status: StatusNota; nfeio_id: string | null } | null): boolean {
  if (!linha) return true;
  if (linha.nfeio_id) return false;
  return linha.status === "emitindo" || linha.status === "erro_emissao";
}

/** Erro da NFE.io que vale tentar de novo (Stripe reentrega o evento). */
export function erroTemporario(statusHttp: number): boolean {
  return statusHttp === 408 || statusHttp === 429 || statusHttp >= 500;
}

export interface EnderecoStripe {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export interface TaxIdStripe {
  type: string;
  value: string;
}

/** CPF/CNPJ da cliente no Stripe: Tax ID primeiro, metadata.cpf_cnpj de reserva. */
export function documentoDaCliente(
  taxIds: TaxIdStripe[] | null | undefined,
  metadata: Record<string, string> | null | undefined,
): string | null {
  for (const t of taxIds ?? []) {
    if ((t.type === "br_cpf" || t.type === "br_cnpj") && tipoDocumento(t.value)) {
      return soDigitos(t.value);
    }
  }
  const doMeta = metadata?.cpf_cnpj;
  if (doMeta && tipoDocumento(doMeta)) return soDigitos(doMeta);
  return null;
}

/** Chave do campo "CPF ou CNPJ" do Checkout público (só letras e números, regra do Stripe). */
export const CHAVE_CAMPO_DOCUMENTO = "cpfcnpj";

export interface CampoCheckout {
  key: string;
  numeric?: { value?: string | null } | null;
  text?: { value?: string | null } | null;
}

/** CPF/CNPJ digitado no campo do Checkout; null se não veio ou não fecha o dígito. */
export function documentoDoCampo(campos: CampoCheckout[] | null | undefined): string | null {
  const campo = (campos ?? []).find((c) => c.key === CHAVE_CAMPO_DOCUMENTO);
  const valor = campo?.numeric?.value ?? campo?.text?.value ?? null;
  return valor && tipoDocumento(valor) ? soDigitos(valor) : null;
}

/**
 * Separa "Rua X, 123" em rua e número. O Stripe guarda a linha inteira em
 * line1; a nota pede os dois separados. Sem número reconhecível vai "S/N".
 */
export function separarNumero(line1: string): { rua: string; numero: string } {
  const m = line1.trim().match(/^(.*?)[,\s]+(?:n[ºo°.]?\s*)?(\d+[A-Za-z]?)\s*$/i);
  if (m && m[1].trim()) return { rua: m[1].trim().replace(/,$/, ""), numero: m[2] };
  return { rua: line1.trim(), numero: "S/N" };
}

export interface DadosTomador {
  documento: string | null;
  nome: string | null;
  email: string | null;
  endereco: EnderecoStripe | null;
  /** Código IBGE da cidade, achado pelo CEP. Sem ele o endereço não vai. */
  codigoIbge: string | null;
  bairro: string | null;
}

/** Tomador no formato da NFE.io. Sem documento, vai só nome e e-mail ("não identificado"). */
export function montarTomador(d: DadosTomador): Record<string, unknown> {
  const tomador: Record<string, unknown> = {};
  const tipo = d.documento ? tipoDocumento(d.documento) : null;
  if (d.documento && tipo) {
    tomador.type = tipo === "cnpj" ? "LegalEntity" : "NaturalPerson";
    tomador.federalTaxNumber = Number(soDigitos(d.documento));
  }
  if (d.nome) tomador.name = d.nome;
  if (d.email) tomador.email = d.email;
  const e = d.endereco;
  if (e?.line1 && e.postal_code && d.codigoIbge && (e.country ?? "BR") === "BR") {
    const { rua, numero } = separarNumero(e.line1);
    tomador.address = {
      country: "BRA",
      postalCode: soDigitos(e.postal_code),
      street: rua,
      number: numero,
      ...(e.line2 ? { additionalInformation: e.line2 } : {}),
      district: d.bairro ?? "",
      city: { code: d.codigoIbge, name: e.city ?? "" },
      state: e.state ?? "",
    };
  }
  return tomador;
}

/** Valor da fatura em reais, com 2 casas (a NFE.io recebe decimal). */
export function valorEmReais(centavos: number): number {
  return Math.round(centavos) / 100;
}
