// Guia de senha da criação de conta: requisitos visíveis desde o início (não
// é erro até o submit), barra de 3 segmentos sem vermelho (pendente = --muted).
export const REQUISITOS = [
  { id: "len", label: "Pelo menos 8 caracteres", teste: (v: string) => v.length >= 8 },
  { id: "num", label: "Pelo menos 1 número", teste: (v: string) => /\d/.test(v) },
  { id: "up", label: "Pelo menos 1 letra maiúscula", teste: (v: string) => /[A-Z]/.test(v) },
];

export function senhaCumpreRequisitos(password: string): boolean {
  return REQUISITOS.every((r) => r.teste(password));
}
