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

// Conta criada pelo webhook do Stripe (compra em /planos sem conta) nasce sem
// senha: o convite só faz login. O webhook grava esta marca no user_metadata e
// o guarda da área logada manda pra /auth/criar-senha até ela sumir. Mesmo
// nome literal em supabase/functions/stripe-webhook/index.ts (Deno não importa
// de src/).
export const META_PRECISA_CRIAR_SENHA = "precisa_criar_senha";

export function precisaCriarSenha(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.[META_PRECISA_CRIAR_SENHA] === true;
}
