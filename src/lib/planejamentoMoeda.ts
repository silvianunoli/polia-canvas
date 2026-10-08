// Campo em reais do Planejamento (Módulo 4). QA-15, 07/10/2026.
//
// A máscara antiga tratava todo dígito como centavo: digitar ou colar "3000"
// virava R$ 30,00 (a meta do mês ficava 100 vezes menor no Painel inteiro) e o
// Backspace nunca deixava o campo vazio (parava em R$ 0,00). Agora o número é
// lido como reais, do jeito que se escreve no Brasil:
// - enquanto digita, só limpa: "R$ 3000", "R$ 1234,5" (sem ponto de milhar,
//   pra o cursor não pular e o Backspace apagar o dígito que ela vê);
// - ao sair do campo e ao salvar, normaliza: "R$ 3.000,00".
// O banco lê esse formato (parse_primeiro_numero entende ponto de milhar e
// vírgula decimal), igual ao que a máscara antiga gravava.

/** Teto de dígitos antes da vírgula (R$ 9.999.999.999). */
export const MAX_DIGITOS_REAIS = 10;

interface Partes {
  inteiro: string;
  /** null = sem vírgula; "" = vírgula digitada sem casa ainda. */
  decimais: string | null;
}

function partesDe(entrada: string): Partes | null {
  const texto = entrada.replace(/R\$/gi, "").replace(/\s/g, "");
  let inteiro: string;
  let decimais: string | null = null;

  const ultimaVirgula = texto.lastIndexOf(",");
  if (ultimaVirgula !== -1) {
    // Com vírgula, ela é a decimal e todo ponto é milhar ("1.234,5").
    inteiro = texto.slice(0, ultimaVirgula).replace(/\D/g, "");
    decimais = texto.slice(ultimaVirgula + 1).replace(/\D/g, "");
  } else {
    const pontos = texto.split(".").length - 1;
    const depoisDoPonto = texto.slice(texto.lastIndexOf(".") + 1).replace(/\D/g, "");
    if (pontos === 1 && depoisDoPonto.length <= 2) {
      // Um ponto só, com até 2 casas depois: é decimal ("49.90", teclado do
      // celular que só tem ponto). "3.000" tem 3 casas: é milhar.
      inteiro = texto.slice(0, texto.lastIndexOf(".")).replace(/\D/g, "");
      decimais = depoisDoPonto;
    } else {
      inteiro = texto.replace(/\D/g, "");
    }
  }

  if (!inteiro && !decimais) return null;
  inteiro = inteiro.replace(/^0+(?=\d)/, "").slice(0, MAX_DIGITOS_REAIS) || "0";
  return { inteiro, decimais: decimais === null ? null : decimais.slice(0, 2) };
}

/** O que fica no campo enquanto ela digita. Vazio quando não sobra número. */
export function limparMoedaDigitada(entrada: string): string {
  const p = partesDe(entrada);
  if (!p) return "";
  return `R$ ${p.inteiro}${p.decimais === null ? "" : `,${p.decimais}`}`;
}

/** Formato final, gravado no banco e mostrado ao sair do campo: "R$ 3.000,00". */
export function normalizarMoeda(entrada: string): string {
  const p = partesDe(entrada);
  if (!p) return "";
  const milhar = p.inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${milhar},${(p.decimais ?? "").padEnd(2, "0")}`;
}

/**
 * Onde o cursor deve ficar depois da limpeza: logo após o mesmo número de
 * dígitos que havia antes dele no texto digitado. Sem isso, editar no meio do
 * número jogava o cursor pro fim.
 */
export function posicaoDoCursor(digitado: string, cursorDigitado: number, limpo: string): number {
  const antes = digitado.slice(0, cursorDigitado);
  const digitosAntes = antes.replace(/\D/g, "").length;
  const separadorLogoAntes = /[.,]$/.test(antes);
  if (digitosAntes === 0) return Math.min(limpo.length, 3); // depois de "R$ "
  let vistos = 0;
  for (let i = 0; i < limpo.length; i++) {
    if (/\d/.test(limpo[i])) vistos++;
    if (vistos === digitosAntes) {
      const pos = i + 1;
      return separadorLogoAntes && limpo[pos] === "," ? pos + 1 : pos;
    }
  }
  return limpo.length;
}
