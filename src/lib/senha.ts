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

// Régua de senha dita por extenso, igual nas telas que criam ou trocam senha
// (redefinir, criar pela compra, Configurações).
export const MSG_REQUISITOS_SENHA =
  "A senha precisa de 8 caracteres, com pelo menos 1 número e 1 letra maiúscula.";

type ErroDoAuth = { code?: string | null; message?: string | null } | null | undefined;

/**
 * Erro do supabase.auth.updateUser({ password }) que tem saída do lado dela:
 * senha igual à atual, senha fraca demais ou troca que pede entrada recente.
 * Devolve a mensagem pro campo; null quando o erro não é desses (aí a tela
 * mostra o "tenta de novo" de sempre). A mensagem do Supabase vem em inglês e
 * técnica e nunca vai crua pra tela.
 */
export function mensagemErroNovaSenha(error: ErroDoAuth): string | null {
  if (!error) return null;
  const code = error.code ?? "";
  const msg = error.message ?? "";
  if (code === "same_password" || /different from the old password/i.test(msg)) {
    return "A senha nova precisa ser diferente da atual.";
  }
  if (code === "weak_password" || /known to be weak|weak password/i.test(msg)) {
    return "Essa senha é fácil de adivinhar. Tenta uma mais longa, misturando letras, números e maiúsculas.";
  }
  if (code === "reauthentication_needed" || /requires reauthentication/i.test(msg)) {
    return "Por segurança, a troca de senha pede uma entrada recente. Sai da conta, entra de novo e troca a senha.";
  }
  return null;
}
