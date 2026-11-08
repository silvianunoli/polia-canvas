// Configuração de envio da loja de marca (ONE-189, frete pelo Melhor Envio). Puro: o
// formulário do card "Envio da loja" e o servidor validam pelas mesmas regras. No banco
// fica em lojas_marca.envio, com nomes em snake_case, e nada daqui sai na vitrine.

import { z } from "zod";

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const soDigitos = (v: string) => v.replace(/\D/g, "");

/** "05583-000" vira "05583000". Null se não tem 8 dígitos. */
export function normalizarCep(v: string): string | null {
  const d = soDigitos(v);
  return d.length === 8 ? d : null;
}

function digitoCpf(base: string, peso: number): number {
  const soma = [...base].reduce((s, c, i) => s + Number(c) * (peso - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

export function cpfValido(v: string): boolean {
  const d = soDigitos(v);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  return digitoCpf(d.slice(0, 9), 10) === Number(d[9]) && digitoCpf(d.slice(0, 10), 11) === Number(d[10]);
}

function digitoCnpj(base: string): number {
  const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = [...base].reduce((s, c, i) => s + Number(c) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(v: string): boolean {
  const d = soDigitos(v);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  return digitoCnpj(d.slice(0, 12)) === Number(d[12]) && digitoCnpj(d.slice(0, 13)) === Number(d[13]);
}

const texto = (max: number) => z.string().trim().max(max).default("");
const medida = (max: number) =>
  z.union([z.number(), z.null()]).refine((v) => v == null || (v > 0 && v <= max), "fora_do_limite").default(null);

export const envioSchema = z.object({
  cepOrigem: texto(9),
  caixaPadrao: z
    .object({ pesoKg: medida(100), alturaCm: medida(200), larguraCm: medida(200), comprimentoCm: medida(200) })
    .default({ pesoKg: null, alturaCm: null, larguraCm: null, comprimentoCm: null }),
  retirada: z.object({ ativa: z.boolean().default(false), instrucoes: texto(600) }).default({ ativa: false, instrucoes: "" }),
  remetente: z
    .object({
      nome: texto(120),
      documento: texto(18),
      telefone: texto(20),
      email: texto(200),
      cep: texto(9),
      rua: texto(160),
      numero: texto(20),
      complemento: texto(80),
      bairro: texto(80),
      cidade: texto(80),
      uf: texto(2),
    })
    .default({
      nome: "", documento: "", telefone: "", email: "", cep: "", rua: "", numero: "",
      complemento: "", bairro: "", cidade: "", uf: "",
    }),
});
export type EnvioLoja = z.infer<typeof envioSchema>;

export const envioVazio = (): EnvioLoja => envioSchema.parse({});

/** O que está errado no que foi preenchido. Campo vazio não é erro: é pendência. */
export function problemasDoEnvio(e: EnvioLoja): string[] {
  const p: string[] = [];
  if (e.cepOrigem && !normalizarCep(e.cepOrigem)) p.push("O CEP de origem precisa ter 8 números.");
  const doc = soDigitos(e.remetente.documento);
  if (doc && !(doc.length === 11 ? cpfValido(doc) : doc.length === 14 ? cnpjValido(doc) : false))
    p.push("Confira o CPF ou CNPJ do remetente.");
  const fone = soDigitos(e.remetente.telefone);
  if (fone && (fone.length < 10 || fone.length > 11)) p.push("O telefone do remetente precisa de DDD e número.");
  if (e.remetente.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.remetente.email))
    p.push("Confira o e-mail do remetente.");
  if (e.remetente.cep && !normalizarCep(e.remetente.cep)) p.push("O CEP do remetente precisa ter 8 números.");
  if (e.remetente.uf && !(UFS as readonly string[]).includes(e.remetente.uf.toUpperCase()))
    p.push("Confira a UF do remetente.");
  if (e.retirada.ativa && !e.retirada.instrucoes.trim()) p.push("Escreva como funciona a retirada.");
  return p;
}

/** O que falta para a loja cotar frete e comprar etiqueta. */
export function pendenciasDoEnvio(e: EnvioLoja): string[] {
  const f: string[] = [];
  if (!normalizarCep(e.cepOrigem)) f.push("CEP de origem");
  const c = e.caixaPadrao;
  if (!c.pesoKg || !c.alturaCm || !c.larguraCm || !c.comprimentoCm) f.push("caixa padrão");
  const r = e.remetente;
  if (!r.nome || !r.documento || !r.telefone || !r.email || !r.cep || !r.rua || !r.numero || !r.bairro || !r.cidade || !r.uf)
    f.push("remetente");
  return f;
}

type Bruto = Record<string, unknown>;
const obj = (v: unknown): Bruto => (v && typeof v === "object" ? (v as Bruto) : {});
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** lojas_marca.envio (snake_case) para o formulário. Dado torto vira vazio. */
export function envioDoBanco(bruto: unknown): EnvioLoja {
  const b = obj(bruto);
  const c = obj(b.caixa_padrao);
  const r = obj(b.retirada);
  const m = obj(b.remetente);
  const lido = envioSchema.safeParse({
    cepOrigem: str(b.cep_origem),
    caixaPadrao: { pesoKg: num(c.peso_kg), alturaCm: num(c.altura_cm), larguraCm: num(c.largura_cm), comprimentoCm: num(c.comprimento_cm) },
    retirada: { ativa: r.ativa === true, instrucoes: str(r.instrucoes) },
    remetente: {
      nome: str(m.nome), documento: str(m.documento), telefone: str(m.telefone), email: str(m.email),
      cep: str(m.cep), rua: str(m.rua), numero: str(m.numero), complemento: str(m.complemento),
      bairro: str(m.bairro), cidade: str(m.cidade), uf: str(m.uf),
    },
  });
  return lido.success ? lido.data : envioVazio();
}

/** Formulário para o banco, já limpo: só dígitos em CEP, documento e telefone. */
export function envioParaBanco(e: EnvioLoja) {
  const r = e.remetente;
  return {
    cep_origem: normalizarCep(e.cepOrigem) ?? "",
    caixa_padrao: {
      peso_kg: e.caixaPadrao.pesoKg,
      altura_cm: e.caixaPadrao.alturaCm,
      largura_cm: e.caixaPadrao.larguraCm,
      comprimento_cm: e.caixaPadrao.comprimentoCm,
    },
    retirada: { ativa: e.retirada.ativa, instrucoes: e.retirada.instrucoes.trim() },
    remetente: {
      nome: r.nome.trim(),
      documento: soDigitos(r.documento),
      telefone: soDigitos(r.telefone),
      email: r.email.trim().toLowerCase(),
      cep: normalizarCep(r.cep) ?? "",
      rua: r.rua.trim(),
      numero: r.numero.trim(),
      complemento: r.complemento.trim(),
      bairro: r.bairro.trim(),
      cidade: r.cidade.trim(),
      uf: r.uf.trim().toUpperCase(),
    },
  };
}

/** Texto de medida do formulário ("1,5") em número. Vazio vira null; inválido, NaN. */
export function lerMedida(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
}
